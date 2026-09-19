"use server";

import { db } from "@/drizzle/db";
import { TradeTable } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { newTradeFormSchema, adjustPositionSchema } from "@/zodSchema/schema";
import { z } from "zod";
import { Trades } from "@/types";
import { ensureLocalUser } from "./user";
import { v4 as uuidv4 } from "uuid";
import { revalidatePath } from "next/cache";

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
        
        revalidatePath("/private/history");
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
): Promise<{ error: boolean } | undefined> {
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

        // Destructure notes out — notes are managed exclusively by updateTradeNotes()
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { notes: _notes, ...tradeFields } = data;

        const closeEvents = existingTrade.closeEvents || [];
        if (closeEvents.length > 0) {
            // If the trade has scale-in/scale-out events:
            // Treat tradeFields.quantity & entryPrice as the new initial entry values
            const initialQty = Number(tradeFields.quantity || "0");
            const initialEntryPrice = Number(tradeFields.entryPrice || "0");

            const updatedOpenOtherDetails = {
                ...(existingTrade.openOtherDetails || {}),
                initialQty: String(initialQty),
                initialEntryPrice: String(initialEntryPrice),
            };

            let qty = initialQty;
            let price = initialEntryPrice;

            for (const event of closeEvents) {
                const qChange = event.quantityChange !== undefined ? event.quantityChange : (event.quantitySold !== undefined ? -event.quantitySold : 0);
                const eventPrice = event.price !== undefined ? event.price : (event.sellPrice !== undefined ? event.sellPrice : 0);

                if (qChange > 0) {
                    const newQty = qty + qChange;
                    price = newQty > 0 ? (price * qty + eventPrice * qChange) / newQty : price;
                    qty = newQty;
                } else if (qChange < 0) {
                    qty = qty + qChange;
                }
            }

            const updatedDeposit = qty * price;
            const isClosed = qty <= 0;

            await db
                .update(TradeTable)
                .set({
                    ...tradeFields,
                    quantity: qty.toString(),
                    entryPrice: price.toString(),
                    openOtherDetails: updatedOpenOtherDetails,
                    deposit: updatedDeposit > 0 ? updatedDeposit.toString() : null,
                    isActiveTrade: !isClosed,
                })
                .where(eq(TradeTable.id, tradeId));
        } else {
            // No position history events — regular simple update
            await db
                .update(TradeTable)
                .set({ ...tradeFields })
                .where(eq(TradeTable.id, tradeId));
        }

        revalidatePath("/private/history");
    } catch (err) {
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

        const currentLiveQty = Number(existingTrade.quantity || "0");
        const adjustQty = Number(data.adjustQty);
        const adjustPrice = Number(data.adjustPrice);
        const adjustDate = data.adjustDate;
        const adjustTime = data.adjustTime;

        if (adjustPrice <= 0) {
            return { error: true, message: "Price must be greater than 0." };
        }

        if (adjustQty < 0 && Math.abs(adjustQty) > currentLiveQty + 0.000001) {
            return { error: true, message: `Cannot reduce more than current position size (${currentLiveQty}).` };
        }

        // Merge extraFields (except closeEvents) into existingTrade to support updating other fields
        const mergedTrade = {
            ...existingTrade,
            ...extraFields,
        };

        // 2. Read or initialize initialQty and initialEntryPrice in openOtherDetails
        let openOtherDetails = mergedTrade.openOtherDetails || {};
        let initialQtyStr = openOtherDetails.initialQty;
        let initialEntryPriceStr = openOtherDetails.initialEntryPrice;

        const existingEvents = mergedTrade.closeEvents || [];

        if (initialQtyStr === undefined || initialEntryPriceStr === undefined) {
            const existingEventsQtyChange = existingEvents.reduce((sum, e) => {
                const qChange = e.quantityChange !== undefined ? e.quantityChange : (e.quantitySold !== undefined ? -e.quantitySold : 0);
                return sum + qChange;
            }, 0);

            const computedInitialQty = currentLiveQty - existingEventsQtyChange;

            initialQtyStr = String(computedInitialQty > 0 ? computedInitialQty : currentLiveQty);
            initialEntryPriceStr = mergedTrade.entryPrice || "0";

            openOtherDetails = {
                ...openOtherDetails,
                initialQty: initialQtyStr,
                initialEntryPrice: initialEntryPriceStr,
            };
        }

        const initialQty = Number(initialQtyStr);
        const initialEntryPrice = Number(initialEntryPriceStr);

        // 3. Construct the new adjustment event
        let realizedPnL = 0;
        let determinedEventType: "add" | "reduce" | "close" = "add";

        if (adjustQty > 0) {
            determinedEventType = "add";
        } else {
            const currentAvgEntry = Number(mergedTrade.entryPrice || 0);
            const isBuy = mergedTrade.positionType === "buy";
            realizedPnL = (adjustPrice - currentAvgEntry) * Math.abs(adjustQty) * (isBuy ? 1 : -1);

            const isClosing = Math.abs(adjustQty) >= currentLiveQty - 0.000001;
            determinedEventType = data.eventType || (isClosing ? "close" : "reduce");
        }

        const newEvent = {
            id: uuidv4(),
            date: adjustDate,
            time: adjustTime,
            quantityChange: adjustQty,
            price: adjustPrice,
            result: adjustQty < 0 ? Number(realizedPnL.toFixed(2)) : 0,
            eventType: determinedEventType,
            // compatibility fields:
            quantitySold: adjustQty < 0 ? Math.abs(adjustQty) : 0,
            sellPrice: adjustQty < 0 ? adjustPrice : 0,
        };

        const updatedEvents = [...existingEvents, newEvent];

        // 4. Sequentially recalculate the parent trade's live quantity and entry price
        let qty = initialQty;
        let price = initialEntryPrice;

        for (const event of updatedEvents) {
            const qChange = event.quantityChange !== undefined ? event.quantityChange : (event.quantitySold !== undefined ? -event.quantitySold : 0);
            const eventPrice = event.price !== undefined ? event.price : (event.sellPrice !== undefined ? event.sellPrice : 0);

            if (qChange > 0) {
                // scale-in (add): recalculate VWAP average entry price
                const newQty = qty + qChange;
                price = newQty > 0 ? (price * qty + eventPrice * qChange) / newQty : price;
                qty = newQty;
            } else if (qChange < 0) {
                // scale-out (reduce/close): reduces remaining qty, average entry price is unchanged
                qty = qty + qChange;
            }
        }

        const updatedDeposit = qty * price;
        const isClosed = qty <= 0.000001;
        const finalCleanQty = isClosed ? 0 : Number(qty.toFixed(8));

        const updatedFields = {
            ...extraFields,
            quantity: finalCleanQty.toString(),
            entryPrice: price.toString(),
            closeEvents: updatedEvents,
            isActiveTrade: !isClosed,
            openOtherDetails,
            deposit: updatedDeposit > 0 ? updatedDeposit.toString() : null,
            // If fully closed:
            closeDate: isClosed ? adjustDate : null,
            closeTime: isClosed ? adjustTime : null,
            sellPrice: isClosed ? adjustPrice.toString() : null,
            quantitySold: isClosed ? initialQty.toString() : null,
            result: isClosed ? Number(updatedEvents.reduce((sum, e) => sum + (e.result || 0), 0).toFixed(2)).toString() : null,
        };

        await db
            .update(TradeTable)
            .set(updatedFields)
            .where(eq(TradeTable.id, tradeId));

        try {
            revalidatePath("/private/history");
        } catch {
            // Context outside HTTP request (e.g. tests/scripts)
        }

        const [updatedRawTrade] = await db
            .select()
            .from(TradeTable)
            .where(eq(TradeTable.id, tradeId));

        const updatedTrade = processTradeRow(updatedRawTrade);
        return { error: false, updatedTrade };
    } catch (err) {
        console.error("Error adjusting position:", err);
        return { error: true, message: "Internal error adjusting position." };
    }
}

export async function deletePositionEvent(
    tradeId: string,
    eventId: string
): Promise<{ error: boolean; updatedTrade?: Trades } | undefined> {
    await ensureLocalUser();

    try {
        const [existingTrade] = await db
            .select()
            .from(TradeTable)
            .where(eq(TradeTable.id, tradeId));

        if (!existingTrade) return { error: true };

        const rawEvents = existingTrade.closeEvents || [];
        const updatedEvents = rawEvents.filter((e) => e.id !== eventId);

        let openOtherDetails = existingTrade.openOtherDetails || {};
        let initialQtyStr = openOtherDetails.initialQty;
        let initialEntryPriceStr = openOtherDetails.initialEntryPrice;

        if (initialQtyStr === undefined || initialEntryPriceStr === undefined) {
            const rawEventsQtyChange = rawEvents.reduce((sum, e) => {
                const qChange = e.quantityChange !== undefined ? e.quantityChange : (e.quantitySold !== undefined ? -e.quantitySold : 0);
                return sum + qChange;
            }, 0);
            const currentQty = Number(existingTrade.quantity || "0");
            const computedInitialQty = currentQty - rawEventsQtyChange;

            initialQtyStr = String(computedInitialQty > 0 ? computedInitialQty : currentQty);
            initialEntryPriceStr = existingTrade.entryPrice || "0";

            openOtherDetails = {
                ...openOtherDetails,
                initialQty: initialQtyStr,
                initialEntryPrice: initialEntryPriceStr,
            };
        }

        const initialQty = Number(initialQtyStr);
        const initialEntryPrice = Number(initialEntryPriceStr);

        let qty = initialQty;
        let price = initialEntryPrice;

        for (const event of updatedEvents) {
            const qChange = event.quantityChange !== undefined ? event.quantityChange : (event.quantitySold !== undefined ? -event.quantitySold : 0);
            const eventPrice = event.price !== undefined ? event.price : (event.sellPrice !== undefined ? event.sellPrice : 0);

            if (qChange > 0) {
                const newQty = qty + qChange;
                price = newQty > 0 ? (price * qty + eventPrice * qChange) / newQty : price;
                qty = newQty;
            } else if (qChange < 0) {
                qty = qty + qChange;
            }
        }

        const updatedDeposit = qty * price;
        const isClosed = qty <= 0;

        const updatedFields = {
            quantity: qty.toString(),
            entryPrice: price.toString(),
            closeEvents: updatedEvents,
            isActiveTrade: !isClosed,
            openOtherDetails,
            deposit: updatedDeposit > 0 ? updatedDeposit.toString() : null,
            closeDate: isClosed ? (updatedEvents[updatedEvents.length - 1]?.date || new Date().toISOString()) : null,
            closeTime: isClosed ? (updatedEvents[updatedEvents.length - 1]?.time || "16:00") : null,
            sellPrice: isClosed ? (updatedEvents[updatedEvents.length - 1]?.price?.toString() || null) : null,
            quantitySold: isClosed ? initialQty.toString() : null,
            result: isClosed ? updatedEvents.reduce((sum, e) => sum + (e.result || 0), 0).toString() : null,
        };

        await db.update(TradeTable).set(updatedFields).where(eq(TradeTable.id, tradeId));
        try {
            revalidatePath("/private/history");
        } catch {
            // Context outside HTTP request (e.g. tests/scripts)
        }

        const [updatedRawTrade] = await db.select().from(TradeTable).where(eq(TradeTable.id, tradeId));
        const updatedTrade = processTradeRow(updatedRawTrade);
        return { error: false, updatedTrade };
    } catch (err) {
        console.error("Error deleting position event:", err);
        return { error: true };
    }
}

