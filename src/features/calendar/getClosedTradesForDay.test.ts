import assert from "node:assert/strict";

import { Trades } from "@/types";
import {
    getCalendarEventsForDay,
    getClosedTradesForDay,
} from "./getClosedTradesForDay";

const legacyTrade: Trades = {
    id: "legacy-zero",
    notes: undefined,
    positionType: "buy",
    openDate: "2026-01-02",
    openTime: "09:30",
    closeDate: "2026-01-05",
    closeTime: "16:00",
    isActiveTrade: false,
    symbolName: "ZERO",
    entryPrice: "100",
    quantity: "1",
    sellPrice: "100",
    quantitySold: "1",
    result: "0",
    rating: 0,
};

const legacyLoss: Trades = {
    ...legacyTrade,
    id: "legacy-loss",
    symbolName: "LOSS",
    sellPrice: "90",
    result: "-10",
};

const partialTrade: Trades = {
    ...legacyTrade,
    id: "partial",
    symbolName: "PARTIAL",
    closeDate: "2026-01-20",
    isActiveTrade: true,
    closeEvents: [
        {
            id: "partial-close",
            date: "2026-01-05",
            time: "11:30",
            quantityChange: -2,
            price: 115,
            result: 30,
            eventType: "reduce",
        },
    ],
};

const zeroItems = getClosedTradesForDay([legacyTrade], "05-01-2026");
assert.equal(zeroItems.length, 1, "a real zero-result close remains visible");
assert.equal(zeroItems[0].result, 0);
assert.equal(zeroItems[0].eventType, "close");

const dayItems = getClosedTradesForDay(
    [legacyTrade, legacyLoss, partialTrade],
    "05-01-2026"
);
assert.deepEqual(
    dayItems.map((item) => item.id),
    ["partial-close", "close-legacy-zero", "close-legacy-loss"],
    "same-day events are sorted by local time"
);

const calendarItems = getCalendarEventsForDay(
    [legacyTrade, partialTrade],
    "05-01-2026"
);
assert.equal(calendarItems.length, 2);
assert.equal(calendarItems[0].tradeId, "partial");
assert.equal(calendarItems[0].quantity, 2);
assert.equal(calendarItems[0].price, 115);
assert.equal(calendarItems[0].result, 30);
assert.equal(calendarItems[1].tradeId, "legacy-zero");
assert.equal(calendarItems[1].originalTrade.id, "legacy-zero");

assert.equal(
    getClosedTradesForDay([legacyTrade], "06-01-2026").length,
    0,
    "date-only close does not shift across local timezone boundaries"
);

console.log("Calendar close-event assertions passed");
