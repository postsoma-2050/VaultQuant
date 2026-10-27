"use server";

import { db } from "@/drizzle/db";
import { TradeTable } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { newTradeFormSchema, adjustPositionSchema } from "@/zodSchema/schema";
import { z } from "zod";
import { Trades } from "@/types";
import { CloseEvent } from "@/types/dbSchema.types";
import { ensureLocalUser } from "./user";
import { v4 as uuidv4 } from "uuid";
import { revalidatePath } from "next/cache";

const QUANTITY_EPSILON = 0.000001;

type ReplayResult = {
    events: CloseEvent[];
    quantity: number;
    entryPrice: number;
    realizedResult: number;
    closedQuantity: number;
    closeEvent?: CloseEvent;
    isClosed: boolean;
};

class LifecycleError extends Error {}

function finiteNumber(value: unknown, fallback = 0): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
}

function roundMoney(value: number): number {
    const rounded = Math.round((value + Number.EPSILON) * 100) / 100;
    return Object.is(rounded, -0) ? 0 : rounded;
}

function formatQuantity(value: number): string {
    const normalized = Math.abs(value) <= QUANTITY_EPSILON ? 0 : value;
    return String(Number(normalized.toFixed(8)));
}

function formatPrice(value: number): string {
    return String(Number(value.toFixed(10)));
}

function getEventQuantityChange(event: CloseEvent): number {
    if (event.quantityChange !== undefined) {
        return finiteNumber(event.quantityChange);
    }
    if (event.quantitySold !== undefined) {
        return -Math.abs(finiteNumber(event.quantitySold));
    }
    return 0;
}

function getEventPrice(event: CloseEvent): number {
    if (event.price !== undefined) return finiteNumber(event.price);
    if (event.sellPrice !== undefined) return finiteNumber(event.sellPrice);
    return 0;
}

function getDatePart(value: string): string {
    return (value || "").split("T")[0].split(" ")[0];
}

function eventSortKey(event: CloseEvent): string {
    const date = getDatePart(event.date);
    const time = (event.time || "00:00").trim().padStart(5, "0");
    return `${date} ${time}`;
}

function sortEventsChronologically(events: CloseEvent[]): CloseEvent[] {
    return events
        .map((event, index) => ({ event, index, key: eventSortKey(event) }))
        .sort((a, b) => a.key.localeCompare(b.key) || a.index - b.index)
        .map(({ event }) => event);
}

function getLastClosingEvent(events: CloseEvent[]): CloseEvent | undefined {
    const closingEvents = sortEventsChronologically(events).filter(
        (event) => getEventQuantityChange(event) < 0
    );
    return closingEvents[closingEvents.length - 1];
}

function syncFinalClosingEvent(
    events: CloseEvent[],
    parent: {
        closeDate?: string;
        closeTime?: string;
        sellPrice?: string;
    }
): CloseEvent[] {
    const finalEvent = getLastClosingEvent(events);
    if (!finalEvent) return events;

    const closeDate = parent.closeDate || finalEvent.date;
    const closeTime = parent.closeTime || finalEvent.time;
    const sellPrice =
        parent.sellPrice !== undefined && parent.sellPrice !== ""
            ? finiteNumber(parent.sellPrice, NaN)
            : getEventPrice(finalEvent);

    if (!Number.isFinite(sellPrice) || sellPrice <= 0) {
        throw new LifecycleError("Final exit price must be greater than zero.");
    }

    return events.map((event) =>
        event.id === finalEvent.id
            ? {
                  ...event,
                  date: closeDate,
                  time: closeTime,
                  price: sellPrice,
                  sellPrice,
              }
            : event
    );
}

function getAggregateQuantitySold(events: CloseEvent[]): number {
    return events.reduce((total, event) => {
        const quantityChange = getEventQuantityChange(event);
        return quantityChange < 0 ? total + Math.abs(quantityChange) : total;
    }, 0);
}

function hasUnsupportedQuantitySoldEdit({
    requested,
    existing,
    events,
}: {
    requested?: string;
    existing?: string | null;
    events: CloseEvent[];
}): boolean {
    if (requested === undefined || requested.trim() === "") return false;

    const requestedValue = Number(requested);
    if (!Number.isFinite(requestedValue)) return true;

    const existingValue = Number(existing);
    if (
        existing !== undefined &&
        existing !== null &&
        existing.trim() !== "" &&
        Number.isFinite(existingValue) &&
        Math.abs(requestedValue - existingValue) <= QUANTITY_EPSILON
    ) {
        return false;
    }

    // Allow a stale aggregate field to be corrected to the event-derived value.
    return (
        Math.abs(requestedValue - getAggregateQuantitySold(events)) >
        QUANTITY_EPSILON
    );
}

/**
 * Replays a campaign from its initial open through every event in date/time order.
 * Scale-ins change VWAP; scale-outs use the VWAP immediately before that event.
 */
function replayTradeLifecycle({
    initialQuantity,
    initialEntryPrice,
    positionType,
    events,
}: {
    initialQuantity: number;
    initialEntryPrice: number;
    positionType: string;
    events: CloseEvent[];
}): ReplayResult {
    if (!Number.isFinite(initialQuantity) || initialQuantity <= QUANTITY_EPSILON) {
        throw new LifecycleError("Initial position quantity must be greater than zero.");
    }
    if (!Number.isFinite(initialEntryPrice) || initialEntryPrice < 0) {
        throw new LifecycleError("Initial entry price is invalid.");
    }

    const isBuy = positionType.trim().toLowerCase() !== "sell";
    let quantity = initialQuantity;
    let entryPrice = initialEntryPrice;
    let realizedResult = 0;
    let closedQuantity = 0;
    let closeEvent: CloseEvent | undefined;

    const replayedEvents = sortEventsChronologically(events).map((event) => {
        const quantityChange = getEventQuantityChange(event);
        const eventPrice = getEventPrice(event);

        if (Math.abs(quantityChange) <= QUANTITY_EPSILON) {
            return {
                ...event,
                result: 0,
            };
        }

        if (quantityChange > 0) {
            if (quantity <= QUANTITY_EPSILON) {
                throw new LifecycleError(
                    `Cannot add ${formatQuantity(quantityChange)} units to a closed position on ${getDatePart(event.date)}.`
                );
            }

            const nextQuantity = quantity + quantityChange;
            entryPrice =
                (entryPrice * quantity + eventPrice * quantityChange) / nextQuantity;
            quantity = nextQuantity;

            return {
                ...event,
                quantityChange,
                price: eventPrice,
                quantitySold: 0,
                sellPrice: 0,
                result: 0,
                eventType: "add" as const,
            };
        }

        const reducingQuantity = Math.abs(quantityChange);
        if (reducingQuantity > quantity + QUANTITY_EPSILON) {
            throw new LifecycleError(
                `Cannot reduce ${formatQuantity(reducingQuantity)} units when only ${formatQuantity(quantity)} remain on ${getDatePart(event.date)}.`
            );
        }

        const eventResult = roundMoney(
            (eventPrice - entryPrice) * reducingQuantity * (isBuy ? 1 : -1)
        );
        quantity = Math.max(0, quantity - reducingQuantity);
        realizedResult = roundMoney(realizedResult + eventResult);
        closedQuantity += reducingQuantity;

        const replayedEvent: CloseEvent = {
            ...event,
            quantityChange,
            price: eventPrice,
            quantitySold: reducingQuantity,
            sellPrice: eventPrice,
            result: eventResult,
            eventType: quantity <= QUANTITY_EPSILON ? "close" : "reduce",
        };
        closeEvent = replayedEvent;

        return replayedEvent;
    });

    return {
        events: replayedEvents,
        quantity: quantity <= QUANTITY_EPSILON ? 0 : quantity,
        entryPrice,
        realizedResult,
        closedQuantity,
        closeEvent,
        isClosed: quantity <= QUANTITY_EPSILON,
    };
}

function getInitialPosition(
    trade: typeof TradeTable.$inferSelect,
    events: CloseEvent[]
): { quantity: number; entryPrice: number; openOtherDetails: Record<string, string> } {
    const openOtherDetails = { ...(trade.openOtherDetails || {}) };
    const storedQuantity = finiteNumber(openOtherDetails.initialQty, NaN);
    const storedEntryPrice = finiteNumber(openOtherDetails.initialEntryPrice, NaN);

    if (storedQuantity > QUANTITY_EPSILON && storedEntryPrice >= 0) {
        return {
            quantity: storedQuantity,
            entryPrice: storedEntryPrice,
            openOtherDetails,
        };
    }

    // Older rows may not have initial fields. Reverse the stored events from the
    // current snapshot to recover the initial quantity and price.
    let quantity = finiteNumber(trade.quantity);
    let entryPrice = finiteNumber(trade.entryPrice);

    for (const event of [...sortEventsChronologically(events)].reverse()) {
        const quantityChange = getEventQuantityChange(event);
        const eventPrice = getEventPrice(event);

        if (quantityChange > 0) {
            const previousQuantity = quantity - quantityChange;
            if (previousQuantity > QUANTITY_EPSILON) {
                entryPrice =
                    (entryPrice * quantity - eventPrice * quantityChange) /
                    previousQuantity;
            }
            quantity = previousQuantity;
        } else if (quantityChange < 0) {
            quantity += Math.abs(quantityChange);
        }
    }

    if (quantity > QUANTITY_EPSILON) {
        openOtherDetails.initialQty = formatQuantity(quantity);
        openOtherDetails.initialEntryPrice = formatPrice(entryPrice);
    }

    return { quantity, entryPrice, openOtherDetails };
}

function getReplayFields(
    replay: ReplayResult,
    openOtherDetails: Record<string, string>
) {
    const deposit = replay.quantity * replay.entryPrice;
    return {
        quantity: formatQuantity(replay.quantity),
        entryPrice: formatPrice(replay.entryPrice),
        closeEvents: replay.events,
        isActiveTrade: !replay.isClosed,
        openOtherDetails: {
            ...openOtherDetails,
            initialQty: openOtherDetails.initialQty,
            initialEntryPrice: openOtherDetails.initialEntryPrice,
        },
        deposit: deposit > QUANTITY_EPSILON ? formatPrice(deposit) : null,
        closeDate: replay.isClosed ? replay.closeEvent?.date || null : null,
        closeTime: replay.isClosed ? replay.closeEvent?.time || null : null,
        sellPrice: replay.isClosed
            ? formatPrice(getEventPrice(replay.closeEvent || ({} as CloseEvent)))
            : null,
        quantitySold: replay.isClosed ? formatQuantity(replay.closedQuantity) : null,
        result: replay.isClosed ? String(roundMoney(replay.realizedResult)) : null,
    };
}

function processTradeRow(trade: typeof TradeTable.$inferSelect): Trades {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { userId, ...rest } = trade;
    return {
        ...rest,
        notes: rest.notes ?? undefined,
        result: rest.result ?? undefined,
        closeDate: rest.closeDate ?? undefined,
        closeTime: rest.closeTime ?? undefined,
        entryPrice: rest.entryPrice ?? undefined,
        totalCost: rest.totalCost ?? undefined,
        quantity: rest.quantity ?? undefined,
        sellPrice: rest.sellPrice ?? undefined,
        quantitySold: rest.quantitySold ?? undefined,
        strategyId: rest.strategyId ?? undefined,
        appliedOpenRules: rest.appliedOpenRules ?? undefined,
        appliedCloseRules: rest.appliedCloseRules ?? undefined,
        deposit: rest.deposit ?? undefined,
        instrumentName: rest.instrumentName ?? undefined,
        closeEvents: rest.closeEvents ?? undefined,
        openOtherDetails: rest.openOtherDetails ?? undefined,
        closeOtherDetails: rest.closeOtherDetails ?? undefined,
    };
}

export async function createNewTradeRecord(
    unsafeData: z.input<typeof newTradeFormSchema>,
    id: string
): Promise<{ error: boolean; message?: string } | undefined> {
    const userId = "local-user";
    await ensureLocalUser();

    const { success, data } = newTradeFormSchema.safeParse(unsafeData);
    if (!success) {
        return { error: true };
    }

    let notes = data.notes;
    if (notes && notes.trim() !== "") {
        try {
            JSON.parse(notes);
        } catch {
            notes = JSON.stringify([{
                id: uuidv4(),
                createdAt: new Date().toISOString(),
                text: notes,
                category: "general"
            }]);
        }
    }

    try {
        if (!data.closeDate || data.closeDate === "") {
            const cleanSym = data.symbolName.trim().toUpperCase();
            const posType = data.positionType.toLowerCase();

            const existingTrades = await db
                .select()
                .from(TradeTable)
                .where(eq(TradeTable.userId, userId));

            const existingActive = existingTrades.find((t) => {
                const isActive = t.isActiveTrade !== false && (!t.closeDate || t.closeDate === "");
                return isActive &&
                       (t.symbolName || "").trim().toUpperCase() === cleanSym &&
                       (t.positionType || "").toLowerCase() === posType;
            });

            if (existingActive) {
                return {
                    error: true,
                    message: `An active position for ${cleanSym} (${posType === 'buy' ? 'Long' : 'Short'}) already exists. Please adjust the existing position.`
                };
            }
        }

        await db.insert(TradeTable).values({ ...data, notes, userId, id });
        try {
            revalidatePath("/private/history");
        } catch {}
    } catch (err) {
        console.error("Error creating trade:", err);
        return { error: true, message: "Internal error creating trade." };
    }
}

export async function updateTradeNotes(
    tradeId: string,
    notesJson: string
): Promise<{ success: boolean; error?: string }> {
    await ensureLocalUser();
    try {
        await db
            .update(TradeTable)
            .set({ notes: notesJson })
            .where(eq(TradeTable.id, tradeId));
        
        try {
            revalidatePath("/private/history");
        } catch {
            // Context outside HTTP request (e.g. tests/scripts)
        }
        return { success: true };
    } catch (err) {
        console.error("Error updating trade notes:", err);
        return { success: false, error: "Failed to update notes" };
    }
}

export async function getAllTradeRecords(): Promise<Trades[]> {
    const userId = "local-user";
    await ensureLocalUser();

    const data = await db.query.TradeTable.findMany({
        where: eq(TradeTable.userId, userId),
    });

    const processedData = data.map((trade) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { userId, ...rest } = trade;
        return {
            ...rest,
            notes: rest.notes ?? undefined,
            result: rest.result ?? undefined,
            closeDate: rest.closeDate ?? undefined,
            closeTime: rest.closeTime ?? undefined,
            entryPrice: rest.entryPrice ?? undefined,
            totalCost: rest.totalCost ?? undefined,
            quantity: rest.quantity ?? undefined,
            sellPrice: rest.sellPrice ?? undefined,
            quantitySold: rest.quantitySold ?? undefined,
            strategyId: rest.strategyId ?? undefined,
            appliedOpenRules: rest.appliedOpenRules ?? undefined,
            appliedCloseRules: rest.appliedCloseRules ?? undefined,
            deposit: rest.deposit ?? undefined,
            instrumentName: rest.instrumentName ?? undefined,
            closeEvents: rest.closeEvents ?? undefined,
            openOtherDetails: rest.openOtherDetails ?? undefined,
            closeOtherDetails: rest.closeOtherDetails ?? undefined,
        };
    });

    return [...processedData].reverse();
}

export async function updateTradeRecord(
    unsafeData: z.infer<typeof newTradeFormSchema>,
    tradeId: string
): Promise<{ error: boolean; message?: string } | undefined> {
    await ensureLocalUser();

    const { success, data } = newTradeFormSchema.safeParse(unsafeData);
    if (!success) {
        return { error: true };
    }

    try {
        const [existingTrade] = await db
            .select()
            .from(TradeTable)
            .where(eq(TradeTable.id, tradeId));

        if (!existingTrade) {
            return { error: true };
        }

        // Destructure notes out - notes are managed exclusively by updateTradeNotes().
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { notes: _notes, ...tradeFields } = data;

        const closeEvents = existingTrade.closeEvents || [];
        if (closeEvents.length > 0) {
            const initialQty = Number(tradeFields.quantity || "0");
            const initialEntryPrice = Number(tradeFields.entryPrice || "0");
            if (
                hasUnsupportedQuantitySoldEdit({
                    requested: tradeFields.quantitySold,
                    existing: existingTrade.quantitySold,
                    events: closeEvents,
                })
            ) {
                return {
                    error: true,
                    message:
                        "Editing aggregate quantity sold is not supported for a trade with position events.",
                };
            }

            const updatedOpenOtherDetails = {
                ...(tradeFields.openOtherDetails || existingTrade.openOtherDetails || {}),
                initialQty: String(initialQty),
                initialEntryPrice: String(initialEntryPrice),
            };

            const syncedEvents = syncFinalClosingEvent(closeEvents, {
                closeDate: tradeFields.closeDate,
                closeTime: tradeFields.closeTime,
                sellPrice: tradeFields.sellPrice,
            });
            const replay = replayTradeLifecycle({
                initialQuantity: initialQty,
                initialEntryPrice,
                positionType: tradeFields.positionType,
                events: syncedEvents,
            });

            await db.transaction(async (tx) => {
                await tx
                    .update(TradeTable)
                    .set({
                        ...tradeFields,
                        ...getReplayFields(replay, updatedOpenOtherDetails),
                    })
                    .where(eq(TradeTable.id, tradeId));
            });
        } else {
            // No position history events — regular simple update
            await db
                .update(TradeTable)
                .set({ ...tradeFields })
                .where(eq(TradeTable.id, tradeId));
        }

        try {
            revalidatePath("/private/history");
        } catch {
            // Context outside HTTP request (e.g. tests/scripts)
        }
    } catch (err) {
        if (err instanceof LifecycleError) {
            return { error: true, message: err.message };
        }
        console.error("Error updating trade record:", err);
        return { error: true };
    }
    return;
}

export async function deleteTradeRecord(
    recordId: string
): Promise<{ error: boolean } | undefined> {
    try {
        await db.delete(TradeTable).where(eq(TradeTable.id, recordId));
    } catch (err) {
        console.error(err);
        return { error: true };
    }
    return;
}


export async function adjustTradePosition(
    tradeId: string,
    unsafeData: z.infer<typeof adjustPositionSchema>,
    extraFields?: Partial<Trades>
): Promise<{ error: boolean; message?: string; updatedTrade?: Trades } | undefined> {
    await ensureLocalUser();

    const { success, data } = adjustPositionSchema.safeParse(unsafeData);
    if (!success) {
        return { error: true, message: "Invalid input data." };
    }

    try {
        // 1. Retrieve the existing trade
        const [existingTrade] = await db
            .select()
            .from(TradeTable)
            .where(eq(TradeTable.id, tradeId));

        if (!existingTrade) {
            return { error: true, message: "Trade not found." };
        }

        // Validate active status
        if (existingTrade.isActiveTrade === false || (existingTrade.closeDate && existingTrade.closeDate !== "")) {
            return { error: true, message: "Cannot adjust a closed position." };
        }

        const adjustQty = Number(data.adjustQty);
        const adjustPrice = Number(data.adjustPrice);
        const adjustDate = data.adjustDate;
        const adjustTime = data.adjustTime;

        if (adjustPrice <= 0) {
            return { error: true, message: "Price must be greater than 0." };
        }

        // Merge extraFields (except closeEvents) into existingTrade to support updating other fields
        const mergedTrade = {
            ...existingTrade,
            ...extraFields,
        };

        const existingEvents = mergedTrade.closeEvents || [];
        const initialPosition = getInitialPosition(existingTrade, existingEvents);
        const existingReplay = replayTradeLifecycle({
            initialQuantity: initialPosition.quantity,
            initialEntryPrice: initialPosition.entryPrice,
            positionType: mergedTrade.positionType,
            events: existingEvents,
        });
        const currentLiveQty = existingReplay.quantity;

        if (adjustQty < 0 && Math.abs(adjustQty) > currentLiveQty + QUANTITY_EPSILON) {
            return { error: true, message: `Cannot reduce more than current position size (${formatQuantity(currentLiveQty)}).` };
        }

        // 3. Construct the new adjustment event
        let determinedEventType: "add" | "reduce" | "close" = "add";

        if (adjustQty > 0) {
            determinedEventType = "add";
        } else {
            const isClosing = Math.abs(adjustQty) >= currentLiveQty - QUANTITY_EPSILON;
            determinedEventType = data.eventType || (isClosing ? "close" : "reduce");
        }

        const newEvent = {
            id: uuidv4(),
            date: adjustDate,
            time: adjustTime,
            quantityChange: adjustQty,
            price: adjustPrice,
            result: 0,
            eventType: determinedEventType,
            // compatibility fields:
            quantitySold: adjustQty < 0 ? Math.abs(adjustQty) : 0,
            sellPrice: adjustQty < 0 ? adjustPrice : 0,
        };

        const updatedEvents = [...existingEvents, newEvent];
        const replay = replayTradeLifecycle({
            initialQuantity: initialPosition.quantity,
            initialEntryPrice: initialPosition.entryPrice,
            positionType: mergedTrade.positionType,
            events: updatedEvents,
        });

        const updatedFields = {
            ...extraFields,
            ...getReplayFields(replay, initialPosition.openOtherDetails),
        };

        const updatedTrade = await db.transaction(async (tx) => {
            await tx
                .update(TradeTable)
                .set(updatedFields)
                .where(eq(TradeTable.id, tradeId));

            const [updatedRawTrade] = await tx
                .select()
                .from(TradeTable)
                .where(eq(TradeTable.id, tradeId));

            return processTradeRow(updatedRawTrade);
        });

        try {
            revalidatePath("/private/history");
        } catch {
            // Context outside HTTP request (e.g. tests/scripts)
        }

        return { error: false, updatedTrade };
    } catch (err) {
        if (err instanceof LifecycleError) {
            return { error: true, message: err.message };
        }
        console.error("Error adjusting position:", err);
        return { error: true, message: "Internal error adjusting position." };
    }
}

export async function deletePositionEvent(
    tradeId: string,
    eventId: string
): Promise<{ error: boolean; message?: string; updatedTrade?: Trades } | undefined> {
    await ensureLocalUser();

    try {
        const [existingTrade] = await db
            .select()
            .from(TradeTable)
            .where(eq(TradeTable.id, tradeId));

        if (!existingTrade) return { error: true, message: "Trade not found." };

        const rawEvents = existingTrade.closeEvents || [];
        if (!rawEvents.some((event) => event.id === eventId)) {
            return { error: true, message: "Position event not found." };
        }
        const updatedEvents = rawEvents.filter((e) => e.id !== eventId);
        const initialPosition = getInitialPosition(existingTrade, rawEvents);
        const replay = replayTradeLifecycle({
            initialQuantity: initialPosition.quantity,
            initialEntryPrice: initialPosition.entryPrice,
            positionType: existingTrade.positionType,
            events: updatedEvents,
        });
        const updatedFields = getReplayFields(replay, initialPosition.openOtherDetails);

        const updatedTrade = await db.transaction(async (tx) => {
            await tx
                .update(TradeTable)
                .set(updatedFields)
                .where(eq(TradeTable.id, tradeId));

            const [updatedRawTrade] = await tx
                .select()
                .from(TradeTable)
                .where(eq(TradeTable.id, tradeId));

            return processTradeRow(updatedRawTrade);
        });

        try {
            revalidatePath("/private/history");
        } catch {
            // Context outside HTTP request (e.g. tests/scripts)
        }

        return { error: false, updatedTrade };
    } catch (err) {
        if (err instanceof LifecycleError) {
            return { error: true, message: err.message };
        }
        console.error("Error deleting position event:", err);
        return { error: true };
    }
}

