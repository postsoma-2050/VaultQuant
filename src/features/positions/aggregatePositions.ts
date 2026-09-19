import { Trades } from "@/types";
import { CloseEvent } from "@/types/dbSchema.types";

export interface PositionEventTimelineItem {
    id: string;
    tradeId: string;
    date: string;
    time: string;
    eventType: "open" | "add" | "reduce" | "close";
    quantity: number;
    price: number;
    result?: number;
    notes?: string;
    isInitialOpen?: boolean;
    sourceTradeSymbol?: string;
}

export interface AggregatedPosition {
    key: string;
    userId?: string;
    symbolName: string;
    positionType: "buy" | "sell";
    totalQuantity: number;
    totalCost: number;
    avgEntryPrice: number;
    isMultiple: boolean;
    constituentTradeIds: string[];
    constituentTrades: Trades[];
    primaryTrade: Trades;
    allEvents: PositionEventTimelineItem[];
    openDate: string; // Earliest open date among constituent trades
    openTime: string;
}

/**
 * Normalizes a symbol to a clean uppercase string (e.g. "  ada-usd " -> "ADA-USD")
 */
export function normalizeSymbol(symbol: string): string {
    return (symbol || "").trim().toUpperCase();
}

/**
 * Generates an aggregation key for a position
 */
export function getPositionKey(userId: string | undefined, symbol: string, positionType: string): string {
    const cleanUser = (userId || "local-user").trim().toLowerCase();
    const cleanSymbol = normalizeSymbol(symbol);
    const cleanType = (positionType || "buy").trim().toLowerCase();
    return `${cleanUser}_${cleanSymbol}_${cleanType}`;
}

/**
 * Parses numeric value safely
 */
function safeNumber(val: unknown, fallback = 0): number {
    const num = Number(val);
    return Number.isFinite(num) ? num : fallback;
}

/**
 * Aggregates a list of trades into unified positions (strictly read-only).
 * Filters for active trades (isActiveTrade !== false, no closeDate, remaining quantity > 0)
 * and groups by userId + normalizedSymbol + positionType.
 */
export function aggregateOpenPositions(allTrades: Trades[]): AggregatedPosition[] {
    if (!allTrades || allTrades.length === 0) {
        return [];
    }

    // 1. Filter active trades
    const activeTrades = allTrades.filter((t) => {
        const isNotClosed = !t.closeDate || t.closeDate === "";
        const isActive = t.isActiveTrade !== false;
        const hasQty = safeNumber(t.quantity) > 0;
        return isNotClosed && isActive && hasQty;
    });

    // 2. Group by Key
    const groups: Record<string, Trades[]> = {};
    for (const trade of activeTrades) {
        const key = getPositionKey(trade.userId, trade.symbolName, trade.positionType);
        if (!groups[key]) {
            groups[key] = [];
        }
        groups[key].push(trade);
    }

    // 3. Aggregate each group
    const aggregated: AggregatedPosition[] = [];

    for (const [key, groupTrades] of Object.entries(groups)) {
        if (groupTrades.length === 0) continue;

        // Sort constituent trades chronologically (earliest open first)
        groupTrades.sort((a, b) => {
            const dateDiff = new Date(a.openDate).getTime() - new Date(b.openDate).getTime();
            if (dateDiff !== 0) return dateDiff;
            return (a.openTime || "").localeCompare(b.openTime || "");
        });

        const primaryTrade = groupTrades[0];
        const normalizedSym = normalizeSymbol(primaryTrade.symbolName);
        const posType = primaryTrade.positionType.toLowerCase() === "sell" ? "sell" : "buy";

        let totalQty = 0;
        let totalCost = 0;
        const allEvents: PositionEventTimelineItem[] = [];

        for (const trade of groupTrades) {
            const liveQty = safeNumber(trade.quantity);
            const liveEntryPrice = safeNumber(trade.entryPrice);
            totalQty += liveQty;
            totalCost += liveQty * liveEntryPrice;

            // Extract initial open event
            const initialQty = safeNumber(trade.openOtherDetails?.initialQty, liveQty);
            const initialPrice = safeNumber(trade.openOtherDetails?.initialEntryPrice, liveEntryPrice);

            allEvents.push({
                id: `open-${trade.id}`,
                tradeId: trade.id,
                date: trade.openDate,
                time: trade.openTime || "00:00",
                eventType: "open",
                quantity: initialQty,
                price: initialPrice,
                isInitialOpen: true,
                sourceTradeSymbol: trade.symbolName,
            });

            // Extract adjustment events from closeEvents
            if (trade.closeEvents && trade.closeEvents.length > 0) {
                for (let i = 0; i < trade.closeEvents.length; i++) {
                    const ev: CloseEvent = trade.closeEvents[i];
                    const qChange = ev.quantityChange !== undefined
                        ? ev.quantityChange
                        : (ev.quantitySold !== undefined ? -ev.quantitySold : 0);
                    const evPrice = safeNumber(ev.price ?? ev.sellPrice);
                    const evQty = Math.abs(qChange > 0 ? qChange : (ev.quantitySold || qChange));
                    
                    let determinedType: "add" | "reduce" | "close" = "reduce";
                    if (ev.eventType) {
                        determinedType = ev.eventType;
                    } else if (qChange > 0) {
                        determinedType = "add";
                    }

                    allEvents.push({
                        id: ev.id || `event-${trade.id}-${i}`,
                        tradeId: trade.id,
                        date: ev.date,
                        time: ev.time || "00:00",
                        eventType: determinedType,
                        quantity: evQty,
                        price: evPrice,
                        result: ev.result,
                        notes: ev.notes,
                        sourceTradeSymbol: trade.symbolName,
                    });
                }
            }
        }

        // Sort all constituent events chronologically
        allEvents.sort((a, b) => {
            const dateA = new Date(a.date).getTime();
            const dateB = new Date(b.date).getTime();
            if (dateA !== dateB) return dateA - dateB;
            return (a.time || "").localeCompare(b.time || "");
        });

        const avgEntryPrice = totalQty > 0 ? totalCost / totalQty : 0;

        aggregated.push({
            key,
            userId: primaryTrade.userId,
            symbolName: normalizedSym,
            positionType: posType,
            totalQuantity: totalQty,
            totalCost,
            avgEntryPrice,
            isMultiple: groupTrades.length > 1,
            constituentTradeIds: groupTrades.map((t) => t.id),
            constituentTrades: groupTrades,
            primaryTrade,
            allEvents,
            openDate: primaryTrade.openDate,
            openTime: primaryTrade.openTime || "00:00",
        });
    }

    return aggregated;
}

/**
 * Calculates unrealized P&L and Market Value for an aggregated position.
 */
export function calculatePositionPnL(
    pos: AggregatedPosition,
    markPrice: number | null | undefined
): {
    pnl: number | null;
    pnlPercent: number | null;
    marketValue: number;
} {
    if (markPrice === null || markPrice === undefined || isNaN(markPrice)) {
        return {
            pnl: null,
            pnlPercent: null,
            marketValue: pos.totalCost,
        };
    }

    const isBuy = pos.positionType === "buy";
    const pnl = (markPrice - pos.avgEntryPrice) * pos.totalQuantity * (isBuy ? 1 : -1);
    const pnlPercent = pos.avgEntryPrice > 0 
        ? ((markPrice - pos.avgEntryPrice) / pos.avgEntryPrice) * 100 * (isBuy ? 1 : -1)
        : 0;
    const marketValue = markPrice * pos.totalQuantity;

    return {
        pnl,
        pnlPercent,
        marketValue,
    };
}
