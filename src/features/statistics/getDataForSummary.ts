import { Trades } from "@/types";

interface DensePoint {
    date: Date;
    timeStr: string;
    result: number;
    symbolName: string;
}

export interface AnalyticsRange {
    start?: Date;
    end?: Date;
}

export type AnalyticsClose = {
    id: string;
    date: string;
    time: string;
    result: number;
    symbolName: string;
    positionType: string;
    source: "event" | "legacy";
    trade: Trades;
};

/** Parses a local date & time without UTC time-zone shifts. */
export function parseStatisticsDate(dateStr: string, timeStr: string = "00:00"): Date {
    if (!dateStr) return new Date();
    const datePart = dateStr.split("T")[0];
    const [y, m, d] = datePart.split("-").map(Number);
    const timeClean = (timeStr || "00:00").trim();
    const [h, min] = timeClean.split(":").map(Number);
    return new Date(
        y, 
        m - 1, 
        d, 
        isNaN(h) ? 0 : h, 
        isNaN(min) ? 0 : min
    );
}

export function isDateInAnalyticsRange(date: Date, range?: AnalyticsRange): boolean {
    if (!range?.start && !range?.end) return true;
    if (!Number.isFinite(date.getTime())) return false;
    if (range.start && date < range.start) return false;
    if (range.end && date > range.end) return false;
    return true;
}

export function getAnalyticsCloses(
    trades: Trades[],
    range?: AnalyticsRange
): AnalyticsClose[] {
    const closes: AnalyticsClose[] = [];

    for (const trade of trades) {
        if (trade.closeEvents && trade.closeEvents.length > 0) {
            for (const [index, event] of trade.closeEvents.entries()) {
                if (!event.date) continue;
                const quantityChange =
                    event.quantityChange ?? -(event.quantitySold ?? 0);
                if (quantityChange >= 0) continue;

                const date = parseStatisticsDate(event.date, event.time);
                if (!isDateInAnalyticsRange(date, range)) continue;

                closes.push({
                    id: event.id || `${trade.id}-event-${index}`,
                    date: event.date,
                    time: event.time || "00:00",
                    result: Number(event.result) || 0,
                    symbolName: trade.symbolName,
                    positionType: trade.positionType,
                    source: "event",
                    trade,
                });
            }
        } else if (trade.closeDate) {
            const date = parseStatisticsDate(trade.closeDate, trade.closeTime);
            if (!isDateInAnalyticsRange(date, range)) continue;

            closes.push({
                id: `legacy-${trade.id}`,
                date: trade.closeDate,
                time: trade.closeTime || "00:00",
                result: Number(trade.result) || 0,
                symbolName: trade.symbolName,
                positionType: trade.positionType,
                source: "legacy",
                trade,
            });
        }
    }

    return closes.sort((a, b) => {
        const dateDiff =
            parseStatisticsDate(a.date, a.time).getTime() -
            parseStatisticsDate(b.date, b.time).getTime();
        return dateDiff || a.time.localeCompare(b.time);
    });
}

/**
 * Scopes analytics by each realized event's own date. A parent campaign can
 * straddle a range boundary, so filtering the parent trade first is incorrect.
 */
export function scopeTradesToAnalyticsRange(
    trades: Trades[],
    range?: AnalyticsRange
): Trades[] {
    if (!range?.start && !range?.end) return trades;

    return trades.flatMap((trade) => {
        if (trade.closeEvents && trade.closeEvents.length > 0) {
            const closeEvents = trade.closeEvents.filter((event) => {
                if (!event.date) return false;
                const inRange = isDateInAnalyticsRange(
                    parseStatisticsDate(event.date, event.time),
                    range
                );
                return inRange && (event.quantityChange ?? -(event.quantitySold ?? 0)) < 0;
            });
            return closeEvents.length > 0 ? [{ ...trade, closeEvents }] : [];
        }

        if (trade.closeDate) {
            return isDateInAnalyticsRange(
                parseStatisticsDate(trade.closeDate, trade.closeTime),
                range
            )
                ? [trade]
                : [];
        }

        return isDateInAnalyticsRange(
            parseStatisticsDate(trade.openDate, trade.openTime),
            range
        )
            ? [trade]
            : [];
    });
}

export function getDataForSummaryChartGridPageOne(
    trades: Trades[],
    capital?: string | undefined,
    range?: AnalyticsRange
): { date: Date; capital: number; pnl: number; symbolName: string; sp500?: number }[] {
    if (!Array.isArray(trades) || trades.length === 0) {
        return [];
    }

    const initialCapital = parseFloat(capital || "0") || 0;
    const realisedEvents: DensePoint[] = getAnalyticsCloses(trades, range)
        .filter((close) => close.result !== 0)
        .map((close) => ({
            date: parseStatisticsDate(close.date, close.time),
            timeStr: close.time,
            result: close.result,
            symbolName: close.symbolName,
        }));

    // Sort events chronologically (date, then time)
    realisedEvents.sort((a, b) => {
        const diff = a.date.getTime() - b.date.getTime();
        if (diff !== 0) return diff;
        return a.timeStr.localeCompare(b.timeStr);
    });

    if (realisedEvents.length === 0) {
        return [];
    }

    // Accumulate capital step-by-step
    let runningCapital = initialCapital;
    const resultArray: { date: Date; capital: number; pnl: number; symbolName: string }[] = [];

    for (const ev of realisedEvents) {
        runningCapital += ev.result;
        resultArray.push({
            date: ev.date,
            capital: runningCapital,
            pnl: ev.result,
            symbolName: ev.symbolName,
        });
    }

    const earliestCloseDate = resultArray[0].date;

    const resultArrayWithSP500 = resultArray.map((item) => {
        const msDiff = item.date.getTime() - earliestCloseDate.getTime();
        const yearsDiff = msDiff / (365.25 * 24 * 3600 * 1000);
        const spValue = initialCapital * Math.pow(1 + 0.1, yearsDiff);
        return {
            ...item,
            sp500: Math.floor(spValue),
        };
    });

    return resultArrayWithSP500;
}

export function getOtherDataForGridPageOne(
    trades: Trades[],
    range?: AnalyticsRange
) {
    const scopedTrades = scopeTradesToAnalyticsRange(trades, range);
    const analyticsCloses = getAnalyticsCloses(trades, range);
    if (scopedTrades.length === 0)
        return {
            chartOne: {
                succesfullPositions: 0,
                allPositions: 0,
            },
            chartTwo: {
                succesfullBuyPositions: 0,
                allBuyPositions: 0,
            },
            chartThree: {
                succesfullSellPositions: 0,
                allSellPositions: 0,
            },
            chartFour: {
                allBuyPositions: 0,
                averageBuyPositionsPerMonth: 0,
            },
            chartFive: {
                allSellPositions: 0,
                averageSellPositionsPerMonth: 0,
            },
            chartSix: {
                averageTimeInBuyPosition: 0,
                averageTimeInSellPosition: 0,
            },
            chartSeven: {
                sequenceProfitable: 0,
                sequenceLost: 0,
            },
        };

    const closedTrades = analyticsCloses;
    const closedBuyTrades = closedTrades.filter((trade) => trade.positionType === "buy");
    const closedSellTrades = closedTrades.filter((trade) => trade.positionType === "sell");

    const succesfullPositions = closedTrades.filter(
        (close) => close.result > 0
    ).length;
    const succesfullBuyPositions = closedBuyTrades.filter(
        (close) => close.result > 0
    ).length;
    const succesfullSellPositions = closedSellTrades.filter(
        (close) => close.result > 0
    ).length;

    // Use actual earliest openDate instead of relying on array order
    const earliestOpenDate = scopedTrades.reduce(
        (earliest, t) => (t.openDate < earliest ? t.openDate : earliest),
        scopedTrades[0]?.openDate || ""
    );
    const totalMonthFromFirstTrade = calculateMonthsDifference(earliestOpenDate);

    const closedBuyWithTimeCount = closedBuyTrades.filter(
        (close) => Boolean(close.time)
    ).length;
    const closedSellWithTimeCount = closedSellTrades.filter(
        (close) => Boolean(close.time)
    ).length;

    const averageTimeInBuyPosition =
        closedBuyWithTimeCount > 0
            ? Math.floor(
                  calculateTotalTimeInPositionHours(scopedTrades, "buy") /
                      closedBuyWithTimeCount
              )
            : 0;

    const averageTimeInSellPosition =
        closedSellWithTimeCount > 0
            ? Math.floor(
                  calculateTotalTimeInPositionHours(scopedTrades, "sell") /
                      closedSellWithTimeCount
              )
            : 0;

    const sequenceProfitLost = sequenceOfProfitableLostCloses(analyticsCloses);

    return {
        chartOne: {
            succesfullPositions: Math.floor(
                (succesfullPositions / (closedTrades.length || 1)) * 100
            ),
            allPositions: closedTrades.length,
        },
        chartTwo: {
            succesfullBuyPositions: Math.floor(
                (succesfullBuyPositions / (closedBuyTrades.length || 1)) * 100
            ),
            allBuyPositions: closedBuyTrades.length,
        },
        chartThree: {
            succesfullSellPositions: Math.floor(
                (succesfullSellPositions / (closedSellTrades.length || 1)) * 100
            ),
            allSellPositions: closedSellTrades.length,
        },
        // Using closed counts so Win Rate denominators are consistent
        chartFour: {
            allBuyPositions: closedBuyTrades.length,
            averageBuyPositionsPerMonth: Math.floor(
                closedBuyTrades.length / (totalMonthFromFirstTrade || 1)
            ),
        },
        chartFive: {
            allSellPositions: closedSellTrades.length,
            averageSellPositionsPerMonth: Math.floor(
                closedSellTrades.length / (totalMonthFromFirstTrade || 1)
            ),
        },
        chartSix: {
            averageTimeInBuyPosition,
            averageTimeInSellPosition,
        },
        chartSeven: {
            sequenceProfitable: sequenceProfitLost.profitable,
            sequenceLost: sequenceProfitLost.lost,
        },
    };
}

function calculateMonthsDifference(openDateString: string) {
    if (!openDateString) return 0;
    const openDate = new Date(openDateString);
    const today = new Date();

    const yearDifference = today.getFullYear() - openDate.getFullYear();
    const monthDifference = today.getMonth() - openDate.getMonth();

    const totalMonths = yearDifference * 12 + monthDifference;

    return totalMonths;
}

function calculateTotalTimeInPositionHours(
    trades: Trades[],
    filter: "buy" | "sell"
): number {
    if (trades.length === 0) return 0;
    const filteredTrades = trades.filter(
        (trade): trade is Trades & { closeDate: string; closeTime: string } =>
            trade.positionType === filter &&
            Boolean(trade.closeDate) &&
            Boolean(trade.closeTime)
    );

    const totalTimeInPositionHours = filteredTrades.reduce((acc, trade) => {
        const openDatePart = trade.openDate.split("T")[0];
        const closeDatePart = trade.closeDate.split("T")[0];

        const [openHour, openMinute] = trade.openTime.split(":").map(Number);
        const [closeHour, closeMinute] = trade.closeTime.split(":").map(Number);

        const openDateTime = new Date(openDatePart);
        openDateTime.setHours(openHour, openMinute, 0, 0);

        const closeDateTime = new Date(closeDatePart);
        closeDateTime.setHours(closeHour, closeMinute, 0, 0);

        const diffMs = closeDateTime.getTime() - openDateTime.getTime();
        const diffHours = diffMs / (1000 * 60 * 60);

        return acc + diffHours;
    }, 0);

    return totalTimeInPositionHours;
}

function sequenceOfProfitableLostCloses(closes: AnalyticsClose[]) {
    if (closes.length === 0) return { profitable: 0, lost: 0 };

    const sortedTrades = [...closes].sort((a, b) => {
        const dateA = parseStatisticsDate(a.date, a.time).getTime();
        const dateB = parseStatisticsDate(b.date, b.time).getTime();
        return dateA - dateB;
    });

    let profitableTemp = 0;
    let lostTemp = 0;

    const sequences = {
        profitable: 0,
        lost: 0,
    };

    for (let i = 0; i < sortedTrades.length; i++) {
        // Break-even (result === 0) is treated as a loss to keep streak definition
        // unambiguous: only strictly positive results extend a win streak.
        if (sortedTrades[i].result > 0) {
            profitableTemp++;

            sequences.lost = Math.max(sequences.lost, lostTemp);
            lostTemp = 0;
        } else {
            lostTemp++;

            sequences.profitable = Math.max(
                sequences.profitable,
                profitableTemp
            );
            profitableTemp = 0;
        }
    }

    sequences.profitable = Math.max(sequences.profitable, profitableTemp);
    sequences.lost = Math.max(sequences.lost, lostTemp);
    return sequences;
}
