import { Trades } from "@/types";
import dayjs from "dayjs";

export type CalendarEventType = "open" | "add" | "reduce" | "close";

// A unified display item for the calendar TradeList - supports open, add, reduce, close
export interface TradeDisplayItem {
    id: string;
    tradeId: string;
    symbolName: string;
    positionType: string;
    eventType: CalendarEventType;
    quantity?: string | number;
    entryPrice?: string | number;
    price?: string | number;
    result?: number;
    time?: string;
    isPartialClose?: boolean;
    originalTrade: Trades;
}

/**
 * Get all trade events (Open, Add, Reduce, Close) that happened on a specific day
 */
export function getCalendarEventsForDay(
    allTrades: Trades[],
    dayKey: string // format: "DD-MM-YYYY"
): TradeDisplayItem[] {
    const items: TradeDisplayItem[] = [];

    for (const trade of allTrades) {
        // 1. Initial Open Event
        if (trade.openDate) {
            const openDayKey = dayjs(trade.openDate).format("DD-MM-YYYY");
            if (openDayKey === dayKey) {
                const initQty = trade.openOtherDetails?.initialQty || trade.quantity;
                const initPrice = trade.openOtherDetails?.initialEntryPrice || trade.entryPrice;
                items.push({
                    id: `open-${trade.id}`,
                    tradeId: trade.id,
                    symbolName: trade.symbolName,
                    positionType: trade.positionType,
                    eventType: "open",
                    quantity: initQty,
                    entryPrice: initPrice,
                    price: initPrice,
                    result: undefined,
                    time: trade.openTime || "00:00",
                    isPartialClose: false,
                    originalTrade: trade,
                });
            }
        }

        // 2. Adjustment Events (from closeEvents: add, reduce, close)
        if (trade.closeEvents && trade.closeEvents.length > 0) {
            for (let i = 0; i < trade.closeEvents.length; i++) {
                const event = trade.closeEvents[i];
                if (!event.date) continue;
                const eventDayKey = dayjs(event.date).format("DD-MM-YYYY");
                if (eventDayKey === dayKey) {
                    const qChange = event.quantityChange !== undefined 
                        ? event.quantityChange 
                        : (event.quantitySold !== undefined ? -event.quantitySold : 0);
                    const evQty = Math.abs(qChange > 0 ? qChange : (event.quantitySold || qChange));
                    const evPrice = event.price ?? event.sellPrice ?? trade.entryPrice;
                    
                    let detType: CalendarEventType = "reduce";
                    if (event.eventType) {
                        detType = event.eventType;
                    } else if (qChange > 0) {
                        detType = "add";
                    }

                    items.push({
                        id: event.id || `event-${trade.id}-${i}`,
                        tradeId: trade.id,
                        symbolName: trade.symbolName,
                        positionType: trade.positionType,
                        eventType: detType,
                        quantity: evQty,
                        entryPrice: trade.entryPrice,
                        price: evPrice,
                        result: event.result,
                        time: event.time || "00:00",
                        isPartialClose: detType === "reduce",
                        originalTrade: trade,
                    });
                }
            }
        } else if (trade.closeDate) {
            // 3. Legacy Final Close (without closeEvents array)
            const closeDayKey = dayjs(trade.closeDate).format("DD-MM-YYYY");
            if (closeDayKey === dayKey) {
                const numericResult = Number(trade.result);
                if (Number.isFinite(numericResult) && numericResult !== 0) {
                    items.push({
                        id: `close-${trade.id}`,
                        tradeId: trade.id,
                        symbolName: trade.symbolName,
                        positionType: trade.positionType,
                        eventType: "close",
                        quantity: trade.quantitySold || trade.quantity,
                        entryPrice: trade.entryPrice,
                        price: trade.sellPrice || trade.entryPrice,
                        result: numericResult,
                        time: trade.closeTime || "00:00",
                        isPartialClose: false,
                        originalTrade: trade,
                    });
                }
            }
        }
    }

    // Sort chronologically by time
    items.sort((a, b) => (a.time || "").localeCompare(b.time || ""));

    return items;
}

/**
 * Backward-compatible helper for retrieving closed/adjustment events for a day
 */
export function getClosedTradesForDay(
    allTrades: Trades[],
    dayKey: string
): TradeDisplayItem[] {
    return getCalendarEventsForDay(allTrades, dayKey).filter((e) => e.eventType !== "open");
}

/**
 * Backward-compatible helper for retrieving open events for a day
 */
export function getOpenTradesForDay(
    allTrades: Trades[],
    dayKey: string
): TradeDisplayItem[] {
    return getCalendarEventsForDay(allTrades, dayKey).filter((e) => e.eventType === "open");
}

