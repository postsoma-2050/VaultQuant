import { Trades } from "@/types";
import dayjs from "dayjs";

type TradeDetails = { result: number; win: number; lost: number };

function getDateKey(dateInput: string | Date): string {
    return dayjs(dateInput).format("DD-MM-YYYY");
}

function addTradeToDay(
    acc: { [key: string]: TradeDetails },
    dateKey: string,
    pnlResult: number
) {
    if (acc[dateKey]) {
        acc[dateKey] = {
            result: acc[dateKey].result + 1,
            win: pnlResult >= 0 ? acc[dateKey].win + 1 : acc[dateKey].win,
            lost: pnlResult < 0 ? acc[dateKey].lost + 1 : acc[dateKey].lost,
        };
    } else {
        acc[dateKey] = {
            result: 1,
            win: pnlResult >= 0 ? 1 : 0,
            lost: pnlResult < 0 ? 1 : 0,
        };
    }
}

export function getTradeDetailsForEachDay(data: Trades[]): {
    [key: string]: TradeDetails;
} {
    return data.reduce(
        (acc: { [key: string]: TradeDetails }, trade) => {
            // Process partial closes and adjustments (closeEvents) - each on its own date
            if (trade.closeEvents && trade.closeEvents.length > 0) {
                for (const event of trade.closeEvents) {
                    if (!event.date || event.result === undefined || !Number.isFinite(event.result)) continue;
                    const dateKey = getDateKey(event.date);
                    addTradeToDay(acc, dateKey, event.result);
                }
            } else if (trade.closeDate) {
                // Legacy close without closeEvents
                const numericResult = Number(trade.result);
                if (Number.isFinite(numericResult) && numericResult !== 0) {
                    const dateKey = getDateKey(trade.closeDate);
                    addTradeToDay(acc, dateKey, numericResult);
                }
            }

            return acc;
        },
        {}
    );
}

