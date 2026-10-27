import { Trades } from "@/types";
import { helperFunctionSP500vsYourReturns } from "./helperFunctionSP500vsYourReturns";
import {
    AnalyticsRange,
    AnalyticsClose,
    getAnalyticsCloses,
    scopeTradesToAnalyticsRange,
} from "./getDataForSummary";

export const getOtherDataForGridPageTwo = (
    trades: Trades[],
    capital: string | undefined,
    range?: AnalyticsRange
) => {
    const scopedTrades = scopeTradesToAnalyticsRange(trades, range);
    if (!capital || scopedTrades.length === 0) {
        return {
            chartOne: {
                capitalChanges: [],
                dateLabels: [],
                sp500Alternative: [],
            },
            chartTwo: {
                topTrades: [],
            },
            chartThree: {
                results: [],
                dates: [],
            },
            chartFour: [],
        };
    }
    const [capitalChanges, dateLabels, sp500Alternative] =
        helperFunctionSP500vsYourReturns(scopedTrades, capital);

    const analyticsCloses = getAnalyticsCloses(trades, range);
    const topTrades = getTopTrades(analyticsCloses);

    const topTenTrades = [...analyticsCloses]
        .sort((a, b) => Math.abs(b.result) - Math.abs(a.result))
        .slice(0, 10);

    const results = topTenTrades.map((close) => close.result);
    const dates = topTenTrades
        .map((close) => close.date.split("T")[0]);

    const convertedTopInstruments = topTrades
        .filter((trade) => trade.label !== "Other")
        .map((trade) => trade.label);

    const topInstrumentsByDay = getTopInstrumentsByDay(
        analyticsCloses,
        convertedTopInstruments
    );

    return {
        chartOne: {
            capitalChanges,
            dateLabels,
            sp500Alternative,
        },
        chartTwo: {
            topTrades,
        },
        chartThree: {
            results,
            dates,
        },
        chartFour: [
            {
                data: Object.values(
                    topInstrumentsByDay[0] || { "No data": Array(7).fill(0) }
                )[0],
                color: "#9999FF",
                label: Object.keys(
                    topInstrumentsByDay[0] || { "No data": Array(7).fill(0) }
                )[0],
            },
            {
                data: Object.values(
                    topInstrumentsByDay[1] || { "No data": Array(7).fill(0) }
                )[0],
                color: "#FAC666",
                label: Object.keys(
                    topInstrumentsByDay[1] || { "No data": Array(7).fill(0) }
                )[0],
            },
            {
                data: Object.values(
                    topInstrumentsByDay[2] || { "No data": Array(7).fill(0) }
                )[0],
                color: "#E16540",
                label: Object.keys(
                    topInstrumentsByDay[2] || { "No data": Array(7).fill(0) }
                )[0],
            },
        ],
    };
};

const getTopTrades = (closes: AnalyticsClose[]) => {
    const topTrades: { [key: string]: number } = {};
    for (let i = 0; i < closes.length; i++) {
        const name = closes[i].symbolName;
        if (topTrades[name]) {
            topTrades[name] += 1;
        } else {
            topTrades[name] = 1;
        }
    }

    const entries = Object.entries(topTrades).sort((a, b) => b[1] - a[1]);

    const topThree = entries.slice(0, 3);

    const sumTopThree = topThree.reduce((sum, [, count]) => sum + count, 0);

    const otherCount = closes.length - sumTopThree;

    const resultArray = topThree.map(([label, value], idx) => {
        return {
            id: idx,
            value: value,
            label: label,
        };
    });
    resultArray.push({
        id: 3,
        value: otherCount,
        label: "Other",
    });

    return resultArray;
};

function getTopInstrumentsByDay(
    closes: AnalyticsClose[],
    topInstruments: string[]
): { [instrument: string]: number[] }[] {
    const instrumentData: { [instrument: string]: number[] } = {};
    topInstruments.forEach((instrument) => {
        instrumentData[instrument] = Array(7).fill(0);
    });

    closes
        .forEach((close) => {
            const datePart = close.date.split("T")[0].split(" ")[0];
            const [year, month, day] = datePart.split("-").map(Number);
            const date = new Date(year, month - 1, day);
            const dayIndex = date.getDay();
            const mappedDayIndex = dayIndex === 0 ? 6 : dayIndex - 1;

            if (topInstruments.includes(close.symbolName)) {
                instrumentData[close.symbolName][mappedDayIndex]++;
            }
        });

    const result = Object.entries(instrumentData).map(([instrument, data]) => ({
        [instrument]: data,
    }));

    return result;
}
