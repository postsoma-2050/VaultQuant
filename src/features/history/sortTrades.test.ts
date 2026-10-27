import assert from "node:assert/strict";

import { Trades } from "@/types";
import {
    filterTradesBySymbolsAndDate,
    parseCalendarDate,
    sortTrades,
} from "./sortTrades";

const localDate = (offsetDays = 0): string => {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + offsetDays);
    return [
        date.getFullYear(),
        String(date.getMonth() + 1).padStart(2, "0"),
        String(date.getDate()).padStart(2, "0"),
    ].join("-");
};

const trade = (
    id: string,
    symbolName: string,
    openDate: string,
    closeDate?: string,
    result?: string
): Trades => ({
    id,
    notes: undefined,
    openDate,
    openTime: "09:30",
    closeDate,
    closeTime: closeDate ? "16:00" : undefined,
    positionType: "buy",
    isActiveTrade: !closeDate,
    symbolName,
    entryPrice: "100",
    quantity: "1",
    rating: null,
    result,
});

const today = localDate();
const yesterday = localDate(-1);
const dateOrUndefined = (value: string): Date | undefined =>
    parseCalendarDate(value) ?? undefined;

const sameDay = filterTradesBySymbolsAndDate({
    trades: [trade("1", "AAPL", today, today, "10")],
    selectedSymbols: null,
    dateRange: {
        from: dateOrUndefined(today),
        to: dateOrUndefined(today),
    },
});
assert.equal(sameDay.length, 1, "same-day range includes a date-only close");

const openToday = filterTradesBySymbolsAndDate({
    trades: [trade("2", "MSFT", today)],
    selectedSymbols: null,
    dateRange: {
        from: dateOrUndefined(today),
        to: dateOrUndefined(today),
    },
});
assert.equal(openToday.length, 1, "open trade date falls inside custom range");

const todayPreset = sortTrades({
    timeframe: "today",
    sortBy: "openDate",
    tradesToSort: [
        trade("3", "NVDA", today),
        trade("4", "OLD", yesterday, yesterday, "1"),
    ],
});
assert.deepEqual(
    todayPreset.map((item) => item.id),
    ["3"],
    "open trade falls inside today preset using openDate"
);

const noSymbols = filterTradesBySymbolsAndDate({
    trades: [trade("5", "AAPL", today, today, "10")],
    selectedSymbols: [],
    dateRange: null,
});
assert.equal(noSymbols.length, 0, "explicit empty symbol selection matches nothing");

const selectionAcrossDates = filterTradesBySymbolsAndDate({
    trades: [
        trade("6", "AAPL", today, today, "10"),
        trade("7", "MSFT", today, today, "20"),
    ],
    selectedSymbols: ["AAPL"],
    dateRange: {
        from: dateOrUndefined(today),
        to: dateOrUndefined(today),
    },
});
assert.deepEqual(
    selectionAcrossDates.map((item) => item.id),
    ["6"],
    "selected symbols remain authoritative when date changes"
);

const explicitResultSort = sortTrades({
    sortBy: "result",
    timeframe: "allHistory",
    tradesToSort: [
        trade("8", "AAPL", today, today, "5"),
        trade("9", "MSFT", today, today, "20"),
    ],
});
assert.deepEqual(
    explicitResultSort.map((item) => item.id),
    ["9", "8"],
    "explicit toolbar sort is preserved"
);

console.log("sortTrades edge assertions passed");
