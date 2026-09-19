import { Trades } from "@/types";

interface DensePoint {
    date: Date;
    timeStr: string;
    result: number;
    symbolName: string;
}

/** Parses a local date & time without UTC time-zone shifts. */
function parseLocalDate(dateStr: string, timeStr: string = "00:00"): Date {
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

export function getDataForSummaryChartGridPageOne(
    trades: Trades[],
    capital?: string | undefined
): { date: Date; capital: number; pnl: number; symbolName: string; sp500?: number }[] {
    if (!Array.isArray(trades) || trades.length === 0) {
        return [];
    }

    const initialCapital = parseFloat(capital || "0") || 0;
    const realisedEvents: DensePoint[] = [];

    // Traverse trades to collect individual close events (transaction level)
    for (const trade of trades) {
        if (trade.closeEvents && trade.closeEvents.length > 0) {
            // Trade with adjustment/close events (each recorded on its actual date)
            for (const ev of trade.closeEvents) {
                const evResult = ev.result || 0;
                if (evResult === 0 || !ev.date) continue;
                realisedEvents.push({
                    date: parseLocalDate(ev.date, ev.time || "00:00"),
                    timeStr: ev.time || "00:00",
                    result: evResult,
                    symbolName: trade.symbolName,
                });
            }
        } else if (trade.closeDate && trade.closeDate !== "") {
            // Legacy fully-closed trade without closeEvents
            realisedEvents.push({
                date: parseLocalDate(trade.closeDate, trade.closeTime || "00:00"),
                timeStr: trade.closeTime || "00:00",
                result: parseFloat(trade.result as unknown as string) || 0,
                symbolName: trade.symbolName,
            });
        }
    }

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

export function getOtherDataForGridPageOne(trades: Trades[]) {
    if (trades.length === 0)
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

    const closedTrades = trades.filter((trade) => Boolean(trade.closeDate));
    const closedBuyTrades = closedTrades.filter((trade) => trade.positionType === "buy");
    const closedSellTrades = closedTrades.filter((trade) => trade.positionType === "sell");

    const succesfullPositions = closedTrades.filter(
        (trade) => Number(trade.result) > 0
    ).length;
    const succesfullBuyPositions = closedBuyTrades.filter(
        (trade) => Number(trade.result) > 0
    ).length;
    const succesfullSellPositions = closedSellTrades.filter(
        (trade) => Number(trade.result) > 0
    ).length;

    // Use actual earliest openDate instead of relying on array order
    const earliestOpenDate = trades.reduce(
        (earliest, t) => (t.openDate < earliest ? t.openDate : earliest),
        trades[0]?.openDate || ""
    );
    const totalMonthFromFirstTrade = calculateMonthsDifference(earliestOpenDate);

    const closedBuyWithTimeCount = closedBuyTrades.filter(
        (trade) => Boolean(trade.closeTime)
    ).length;
    const closedSellWithTimeCount = closedSellTrades.filter(
        (trade) => Boolean(trade.closeTime)
    ).length;

    const averageTimeInBuyPosition =
        closedBuyWithTimeCount > 0
            ? Math.floor(
                  calculateTotalTimeInPositionHours(trades, "buy") /
                      closedBuyWithTimeCount
              )
            : 0;

    const averageTimeInSellPosition =
        closedSellWithTimeCount > 0
            ? Math.floor(
                  calculateTotalTimeInPositionHours(trades, "sell") /
                      closedSellWithTimeCount
              )
            : 0;

    const sequenceProfitLost = sequenceOfProfitableLostTrades(trades);

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

function sequenceOfProfitableLostTrades(trades: Trades[]) {
    if (trades.length === 0) return { profitable: 0, lost: 0 };

    const tradesCopy = [...trades].filter(
        (trade): trade is Trades & { closeDate: string } =>
            Boolean(trade.closeDate)
    );

    const sortedTrades = tradesCopy.sort((a, b) => {
        const dateA = new Date(a.closeDate).getTime();
        const dateB = new Date(b.closeDate).getTime();
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
        if (Number(sortedTrades[i].result) > 0) {
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
