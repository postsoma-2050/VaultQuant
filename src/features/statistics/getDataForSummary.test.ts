import assert from "node:assert/strict";

import { Trades } from "@/types";
import {
    getAnalyticsCloses,
    getDataForSummaryChartGridPageOne,
    getOtherDataForGridPageOne,
    parseStatisticsDate,
    scopeTradesToAnalyticsRange,
} from "./getDataForSummary";
import { getOtherDataForGridPageTwo } from "./getDataForDetails";

const baseTrade = (overrides: Partial<Trades>): Trades => ({
    id: "trade",
    notes: undefined,
    positionType: "buy",
    openDate: "2025-12-01",
    openTime: "09:30",
    isActiveTrade: false,
    symbolName: "AAPL",
    entryPrice: "100",
    quantity: "0",
    rating: 0,
    ...overrides,
});

const januaryPartial = baseTrade({
    id: "straddling",
    closeDate: "2026-10-20",
    closeTime: "16:00",
    result: "300",
    sellPrice: "120",
    quantitySold: "30",
    closeEvents: [
        {
            id: "jan-event",
            date: "2026-01-15",
            time: "10:00",
            quantityChange: -10,
            price: 110,
            result: 100,
            eventType: "reduce",
        },
        {
            id: "oct-event",
            date: "2026-10-20",
            time: "16:00",
            quantityChange: -20,
            price: 110,
            result: 200,
            eventType: "close",
        },
    ],
});

const lastMonth = new Date(2026, 8, 24);
const recentRange = { start: lastMonth };

const recentCloses = getAnalyticsCloses([januaryPartial], recentRange);
assert.deepEqual(
    recentCloses.map((close) => close.id),
    ["oct-event"],
    "1M includes only the recent event, not the January partial"
);

const scoped = scopeTradesToAnalyticsRange([januaryPartial], recentRange);
assert.equal(scoped.length, 1);
assert.deepEqual(
    scoped[0].closeEvents?.map((event) => event.id),
    ["oct-event"],
    "parent campaign remains but its out-of-range events are removed"
);
assert.equal(januaryPartial.closeEvents?.length, 2, "scoping does not mutate Redux input");

const allTime = getAnalyticsCloses([januaryPartial]);
assert.deepEqual(
    allTime.map((close) => close.result),
    [100, 200],
    "all-time explicitly keeps both events"
);

const chart = getDataForSummaryChartGridPageOne(
    [januaryPartial],
    "1000",
    recentRange
);
assert.equal(chart.length, 1);
assert.equal(chart[0].pnl, 200);
assert.equal(chart[0].capital, 1200);

const zeroTrade = baseTrade({
    id: "zero",
    closeDate: "2026-10-21",
    closeTime: "16:00",
    result: "0",
    sellPrice: "100",
    quantitySold: "1",
});
assert.equal(
    getAnalyticsCloses([zeroTrade], recentRange)[0].result,
    0,
    "closed zero-result trade is a realized close"
);
assert.equal(
    getOtherDataForGridPageOne([zeroTrade], recentRange).chartOne.allPositions,
    1,
    "zero-result close is counted in closed-position denominator"
);

const dateOnly = baseTrade({
    id: "date-only",
    closeDate: "2026-10-24",
    closeTime: undefined,
    result: "5",
});
const localMidnight = new Date(2026, 9, 24);
assert.equal(
    parseStatisticsDate("2026-10-24", "").getTime(),
    localMidnight.getTime(),
    "date-only values use local midnight instead of UTC shift"
);
assert.equal(
    getAnalyticsCloses([dateOnly], {
        start: new Date(2026, 9, 24),
        end: new Date(2026, 9, 24, 23, 59, 59, 999),
    }).length,
    1,
    "date-only close remains inside its local calendar day"
);

const shortTrade = baseTrade({
    id: "short",
    positionType: "sell",
    closeDate: "2026-10-22",
    closeTime: "15:00",
    result: "100",
    quantitySold: "10",
    closeEvents: [
        {
            id: "short-close",
            date: "2026-10-22",
            time: "15:00",
            quantityChange: -10,
            price: 90,
            result: 100,
            eventType: "close",
        },
    ],
});
const directionData = getOtherDataForGridPageOne([shortTrade], recentRange);
assert.equal(directionData.chartThree.allSellPositions, 1);
assert.equal(directionData.chartThree.succesfullSellPositions, 100);
assert.equal(directionData.chartTwo.allBuyPositions, 0);

const detailData = getOtherDataForGridPageTwo(
    [januaryPartial],
    "1000",
    recentRange
);
assert.deepEqual(
    detailData.chartThree.results,
    [200],
    "Details top trades use in-range events only"
);
assert.deepEqual(detailData.chartThree.dates, ["2026-10-20"]);

console.log("Statistics range assertions passed");
