import { Trades } from "@/types";
import dayjs from "dayjs";

function getDateKey(dateInput: string | Date, groupBy: "day" | "month" | "year" | "total"): string {
    const d = dayjs(dateInput);
    if (groupBy === "year") {
        return d.format("YYYY");
    } else if (groupBy === "month") {
        return `${d.month() + 1}-${d.year()}`;
    } else if (groupBy === "day") {
        return d.format("DD-MM-YYYY");
    } else {
        return "total";
    }
}

function addToAccumulator(acc: { [key: string]: number }, key: string, value: number) {
    if (acc[key]) {
        acc[key] += value;
    } else {
        acc[key] = value;
    }
}

export function getTradeSummary(
    groupBy: "day" | "month" | "year" | "total",
    data: Trades[]
): { [key: string]: number } {
    return data.reduce((acc: { [key: string]: number }, trade) => {
        // Process partial closes and adjustments (closeEvents) - each on its own date
        if (trade.closeEvents && trade.closeEvents.length > 0) {
            for (const event of trade.closeEvents) {
                if (!event.date || event.result === undefined || !Number.isFinite(event.result)) continue;
                const dateKey = getDateKey(event.date, groupBy);
                addToAccumulator(acc, dateKey, event.result);
            }
        } else if (trade.closeDate) {
            // Legacy close without closeEvents
            const numericResult = Number(trade.result);
            if (Number.isFinite(numericResult) && numericResult !== 0) {
                const dateKey = getDateKey(trade.closeDate, groupBy);
                addToAccumulator(acc, dateKey, numericResult);
            }
        }

        return acc;
    }, {});
}
