"use client";

import OdometerConditionalRendering from "@/components/statistics/OdometerConditionalRendering";
import { StatsGridPageOne } from "@/components/StatsGridPageOne";
import { StatsGridPageTwo } from "@/components/StatsGridPageTwo";
import { getOtherDataForGridPageTwo } from "@/features/statistics/getDataForDetails";
import {
    getDataForSummaryChartGridPageOne,
    getOtherDataForGridPageOne,
} from "@/features/statistics/getDataForSummary";
import { useAppSelector } from "@/redux/store";
import { getCapital } from "@/server/actions/user";
import { useEffect, useState, useMemo } from "react";
import { useMarketPrices } from "@/hooks/useMarketPrices";

type RangeKey = "1M" | "3M" | "6M" | "YTD" | "ALL";

const RANGE_OPTIONS: { value: RangeKey; label: string }[] = [
    { value: "1M", label: "1M" },
    { value: "3M", label: "3M" },
    { value: "6M", label: "6M" },
    { value: "YTD", label: "YTD" },
    { value: "ALL", label: "All" },
];

function getRangeStart(range: RangeKey, now = new Date()) {
    if (range === "1M") return new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    if (range === "3M") return new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
    if (range === "6M") return new Date(now.getFullYear(), now.getMonth() - 6, now.getDate());
    if (range === "YTD") return new Date(now.getFullYear(), 0, 1);
    return undefined;
}

function getRangeLabel(range: RangeKey) {
    if (range === "ALL") return "All time";
    if (range === "YTD") return "Year to date";
    return `Last ${range.slice(0, -1)} month${range === "1M" ? "" : "s"}`;
}

export default function Page() {
    const [start, setStart] = useState<string | undefined>();
    const [isSwitchChartsActive, setIsSwitchChartsActive] = useState(false);
    const [range, setRange] = useState<RangeKey>("ALL");


    const allTrades = useAppSelector((state) => state.tradeRecords.listOfTrades);
    const filteredTrades = useAppSelector((state) => state.history.filteredTrades);
    // Analytics follow the symbol filter. Account Overview intentionally uses all dates.
    const trades = useMemo(() => filteredTrades ?? allTrades ?? [], [filteredTrades, allTrades]);
    const rangeStart = useMemo(() => getRangeStart(range), [range]);
    const analyticsRange = useMemo(
        () => (rangeStart ? { start: rangeStart } : undefined),
        [rangeStart]
    );
    const rangeLabel = getRangeLabel(range);
    const localCapital = useAppSelector((state) => state.statistics.capital);
    const startValueToUse = localCapital ?? start;

    // Get symbols for open positions to fetch live prices
    const openTrades = useMemo(() => {
        return (trades || []).filter((t) => !t.closeDate || t.closeDate === "");
    }, [trades]);

    const openSymbols = useMemo(() => {
        return [...new Set(openTrades.map((t) => t.symbolName).filter(Boolean))];
    }, [openTrades]);

    const {
        prices,
        loading: pricesLoading,
        lastUpdated: pricesLastUpdated,
        error: pricesError,
    } = useMarketPrices(openSymbols);
    const quotesSettled =
        openSymbols.length === 0 ||
        (!pricesLoading && (pricesLastUpdated !== null || pricesError));

    // Live account overview calculations
    const accountOverview = useMemo(() => {
        const capitalNum = parseFloat(startValueToUse || "0") || 0;
        let netRealizedPnL = 0;
        let totalUnrealizedPnL = 0;
        let openPositionExposure = 0;
        let unpricedOpenLots = 0;

        for (const trade of trades || []) {
            const isClosed = Boolean(trade.closeDate && trade.closeDate !== "");
            if (isClosed) {
                netRealizedPnL += parseFloat(String(trade.result || "0")) || 0;
            } else {
                // Open trade: sum partial close results
                const closeEvents = trade.closeEvents || [];
                const partialPnL = closeEvents.reduce((sum, e) => sum + (e.result || 0), 0);
                netRealizedPnL += partialPnL;

                // Calculate remaining quantity and entry price
                const remainingQty = parseFloat(String(trade.quantity || "0")) || 0;

                if (remainingQty > 0) {
                    const entryPrice = parseFloat(String(trade.entryPrice || "0")) || 0;
                    const currentPrice =
                        prices[trade.symbolName] !== null &&
                        Number.isFinite(prices[trade.symbolName])
                            ? prices[trade.symbolName]
                            : null;

                    if (currentPrice !== null && !isNaN(entryPrice) && entryPrice > 0) {
                        const isSell = trade.positionType?.trim().toLowerCase() === "sell";
                        const pnl = (currentPrice - entryPrice) * remainingQty * (isSell ? -1 : 1);
                        totalUnrealizedPnL += pnl;
                    }

                    if (currentPrice === null && quotesSettled) {
                        unpricedOpenLots += 1;
                    }

                    const priceForExposure = currentPrice !== null ? currentPrice : entryPrice;
                    const exposure = remainingQty * priceForExposure;
                    openPositionExposure += exposure;
                }
            }
        }

        const currentEquity = capitalNum + netRealizedPnL + totalUnrealizedPnL;
        const exposureMultiple = currentEquity > 0 ? openPositionExposure / currentEquity : 0;

        return {
            startingCapital: capitalNum,
            currentEquity,
            netRealizedPnL,
            unrealizedPnL: totalUnrealizedPnL,
            openPositionExposure,
            exposureMultiple,
            unpricedOpenLots,
        };
    }, [trades, startValueToUse, prices, quotesSettled]);

    const tradingData = useMemo(
        () => getDataForSummaryChartGridPageOne(trades, startValueToUse, analyticsRange),
        [trades, startValueToUse, analyticsRange]
    );

    const otherData = useMemo(
        () => getOtherDataForGridPageOne(trades, analyticsRange),
        [trades, analyticsRange]
    );

    useEffect(() => {
        async function fetchData() {
            const response = await getCapital();
            if (response && typeof response === "string") {
                setStart(response);
            }
        }

        fetchData();
    }, []);

    const endValue = useMemo(() => {
        if (startValueToUse === undefined) return undefined;
        const reducedTotal = trades.reduce((acc, cur) => {
            // Only count closed trades for total account balance
            if (!cur.closeDate || cur.closeDate === "") return acc;
            const resultVal = Number(cur.result);
            return acc + (isNaN(resultVal) ? 0 : resultVal);
        }, 0);
        return (Number(startValueToUse) + reducedTotal).toString();
    }, [startValueToUse, trades]);

    const otherDataPageTwo = useMemo(
        () => getOtherDataForGridPageTwo(trades, startValueToUse, analyticsRange),
        [trades, startValueToUse, analyticsRange]
    );
    const closedTradeCount = useMemo(
        () =>
            trades.filter(
                (trade) => Boolean(trade.closeDate && trade.closeDate !== "")
            ).length,
        [trades]
    );

    return (
        <div className="w-full max-w-none p-6 md:p-8 flex flex-col gap-6 bg-zinc-50/50 min-h-full">
            {/* Account Overview Metrics Grid */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Account Overview</h2>
                        <p className="text-xs text-zinc-500">
                            Current account · selected symbols · all dates
                        </p>
                    </div>
                </div>
                {accountOverview.unpricedOpenLots > 0 && (
                    <p className="text-xs text-amber-700">
                        {accountOverview.unpricedOpenLots} open {accountOverview.unpricedOpenLots === 1 ? "lot has" : "lots have"} no live quote. Exposure includes cost estimates; unrealized P&amp;L excludes unpriced lots.
                    </p>
                )}
                <div className="mt-2">
                    <OdometerConditionalRendering
                        startingCapital={accountOverview.startingCapital}
                        currentEquity={accountOverview.currentEquity}
                        netRealizedPnL={accountOverview.netRealizedPnL}
                        unrealizedPnL={accountOverview.unrealizedPnL}
                        openPositionExposure={accountOverview.openPositionExposure}
                        exposureMultiple={accountOverview.exposureMultiple}
                        hasCapital={startValueToUse !== undefined}
                    />
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200/80 px-4 mt-2">
                <div className="flex gap-6">
                    <button
                        onClick={() => setIsSwitchChartsActive(false)}
                        aria-pressed={!isSwitchChartsActive}
                        className={`pb-3 text-sm font-semibold transition-all relative ${
                            !isSwitchChartsActive
                                ? "text-zinc-900 font-bold"
                                : "text-zinc-400 hover:text-zinc-600"
                        }`}
                    >
                        Summary
                        {!isSwitchChartsActive && (
                            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-900 rounded-full animate-in fade-in duration-200" />
                        )}
                    </button>
                    <button
                        onClick={() => setIsSwitchChartsActive(true)}
                        aria-pressed={isSwitchChartsActive}
                        className={`pb-3 text-sm font-semibold transition-all relative ${
                            isSwitchChartsActive
                                ? "text-zinc-900 font-bold"
                                : "text-zinc-400 hover:text-zinc-600"
                        }`}
                    >
                        Details
                        {isSwitchChartsActive && (
                            <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-zinc-900 rounded-full animate-in fade-in duration-200" />
                        )}
                    </button>
                </div>
                <div className="mb-2 flex flex-wrap items-center gap-3">
                    <div>
                        <span className="text-xs text-zinc-500">
                            Analytics range <span className="font-medium text-zinc-800">{rangeLabel}</span>
                        </span>
                        <p className="text-[11px] text-zinc-400">Applies to the analytics below only.</p>
                    </div>
                    <div className="flex items-center rounded-lg border border-zinc-200 bg-white p-0.5" role="group" aria-label="Statistics period">
                        {RANGE_OPTIONS.map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => setRange(option.value)}
                                aria-pressed={range === option.value}
                                className={`min-w-9 rounded-md px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 ${
                                    range === option.value
                                        ? "bg-zinc-900 text-white"
                                        : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800"
                                }`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {isSwitchChartsActive ? (
                <StatsGridPageTwo
                    start={startValueToUse}
                    end={endValue}
                    oterData={otherDataPageTwo}
                    closedTradeCount={closedTradeCount}
                />
            ) : (
                <StatsGridPageOne
                    tradingData={tradingData}
                    otherData={otherData}
                    scopeLabel={rangeLabel}
                />
            )}
        </div>
    );
}
