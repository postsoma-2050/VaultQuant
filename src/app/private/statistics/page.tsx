"use client";

import AddCapitalDialog from "@/components/statistics/AddCapitalDialog";
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
import { useEffect, useRef, useState, useMemo } from "react";
import { useMarketPrices } from "@/hooks/useMarketPrices";

export default function Page() {
    const [start, setStart] = useState<string | undefined>();
    const buttonRef = useRef<HTMLDivElement | null>(null);

    const [isSwitchChartsActive, setIsSwitchChartsActive] = useState(false);

    const handleSwitch = () => {
        if (buttonRef.current && !isSwitchChartsActive) {
            buttonRef.current.style.boxShadow =
                "0 0 0 1px #70451a3d, 0 1px 2px #70451a0d, 2px 3px 5px #70451a29, 4px 6px 5px #70451a14, 8px 12px 8px #70451a14,8px 0 0.5px #70451a33 inset, 20px 20px 25px 25px #70451a33 inset";
        } else if (buttonRef.current && isSwitchChartsActive) {
            buttonRef.current.style.boxShadow =
                "0 0 0 1px #70451a3d, 0 1px 2px #70451a0d, 2px 3px 5px #70451a29, 4px 6px 5px #70451a14, 8px 12px 8px #70451a14,8px 0 0.5px #70451a33 inset, 10px 0 4px -6px #70451a33 inset";
        }
        setIsSwitchChartsActive((prev) => !prev);
    };

    const trades = useAppSelector((state) => state.tradeRecords.listOfTrades);
    // Statistics always operates on the full trade history so that Account
    // Overview and all charts share one consistent data scope. The History
    // page filter (filteredTrades) is intentionally NOT applied here.
    const localCapital = useAppSelector((state) => state.statistics.capital);
    const tradesToSort = useMemo(() => trades || [], [trades]);
    const startValueToUse = localCapital ?? start;

    // Get symbols for open positions to fetch live prices
    const openTrades = useMemo(() => {
        return (trades || []).filter((t) => !t.closeDate || t.closeDate === "");
    }, [trades]);

    const openSymbols = useMemo(() => {
        return [...new Set(openTrades.map((t) => t.symbolName).filter(Boolean))];
    }, [openTrades]);

    const { prices } = useMarketPrices(openSymbols);

    // Live account overview calculations
    const accountOverview = useMemo(() => {
        const capitalNum = parseFloat(startValueToUse || "0") || 0;
        let netRealizedPnL = 0;
        let totalUnrealizedPnL = 0;
        let openPositionExposure = 0;

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
                    const currentPrice = prices[trade.symbolName] ?? null;

                    if (currentPrice !== null && !isNaN(entryPrice) && entryPrice > 0) {
                        const isSell = trade.positionType?.trim().toLowerCase() === "sell";
                        const pnl = (currentPrice - entryPrice) * remainingQty * (isSell ? -1 : 1);
                        totalUnrealizedPnL += pnl;
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
        };
    }, [trades, startValueToUse, prices]);

    const tradingData = useMemo(
        () => getDataForSummaryChartGridPageOne(tradesToSort, startValueToUse),
        [tradesToSort, startValueToUse]
    );

    const otherData = useMemo(
        () => getOtherDataForGridPageOne(tradesToSort),
        [tradesToSort]
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
        const reducedTotal = (trades || []).reduce((acc, cur) => {
            // Only count closed trades for total account balance
            if (!cur.closeDate || cur.closeDate === "") return acc;
            const resultVal = Number(cur.result);
            return acc + (isNaN(resultVal) ? 0 : resultVal);
        }, 0);
        return (Number(startValueToUse) + reducedTotal).toString();
    }, [startValueToUse, trades]);

    const otherDataPageTwo = useMemo(
        () => getOtherDataForGridPageTwo(tradesToSort, startValueToUse),
        [tradesToSort, startValueToUse]
    );

    return (
        <div className="w-full max-w-none p-6 md:p-8 flex flex-col gap-6 bg-zinc-50/50 min-h-full">
            {/* Account Overview Metrics Grid */}
            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-zinc-900 tracking-tight">Account Overview</h2>
                        <p className="text-xs text-zinc-500">Real-time starting capital, current equity, and exposure metrics.</p>
                    </div>
                </div>
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

            <div className="flex items-center justify-between border-b border-zinc-200/80 px-4 mt-2">
                <div className="flex gap-6">
                    <button
                        onClick={() => setIsSwitchChartsActive(false)}
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
            </div>

            {isSwitchChartsActive ? (
                <StatsGridPageTwo
                    start={startValueToUse}
                    end={endValue}
                    oterData={otherDataPageTwo}
                />
            ) : (
                <StatsGridPageOne
                    tradingData={tradingData}
                    otherData={otherData}
                />
            )}
        </div>
    );
}
