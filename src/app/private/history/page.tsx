"use client";

import { sortTrades } from "@/features/history/sortTrades";
import { useAppSelector } from "@/redux/store";
import { Trades } from "@/types";
import { useMemo } from "react";

import { OpenTradesTable } from "@/components/history/OpenTradesTable";
import { CloseTradesTable } from "@/components/history/CloseTradesTable";


export default function Page() {
    const trades = useAppSelector((state) => state.tradeRecords.listOfTrades);
    const filteredTrades = useAppSelector(
        (state) => state.history.filteredTrades
    );

    const sortBy = useAppSelector((state) => state.history.sortBy);
    const timeframe = useAppSelector((state) => state.history.timeframe);

    const activeTab = useAppSelector((state) => state.history.activeTab);

    const tradesToSort = useMemo(
        () => filteredTrades || trades || [],
        [filteredTrades, trades]
    );

    const sortedTrades = useMemo(() => {
        return sortTrades({
            sortBy,
            timeframe,
            tradesToSort,
        });
    }, [sortBy, timeframe, tradesToSort]);

    // Fully closed trades: have closeDate
    const closedTrades = useMemo(() => {
        return sortedTrades
            .filter((trade): trade is Trades & { closeDate: string; closeTime: string; result: string } =>
                Boolean(trade.closeDate && trade.closeDate !== "" &&
                    trade.closeTime && trade.closeTime !== "" &&
                    trade.result && trade.result !== ""))
            // Ensure closed trades are sorted by closeDate (newest first)
            .sort((a, b) => {
                const dateDiff = new Date(b.closeDate).getTime() - new Date(a.closeDate).getTime();
                if (dateDiff !== 0) return dateDiff;
                // If same date, sort by time
                const parseTime = (time: string) => {
                    const parts = time.split(":");
                    return Number(parts[0] || 0) * 60 + Number(parts[1] || 0);
                };
                const aMinutes = a.closeTime ? parseTime(a.closeTime) : 0;
                const bMinutes = b.closeTime ? parseTime(b.closeTime) : 0;
                return bMinutes - aMinutes;
            });
    }, [sortedTrades]);

    const total = useMemo(() => {
        return closedTrades.reduce((acc, trade) => acc + (Number(trade.result) || 0), 0);
    }, [closedTrades]);

    // Open trades: no closeDate OR have remaining quantity
    const openTrades = useMemo(() => {
        return sortedTrades.filter((trade) => {
            const isNotClosed = !trade.closeDate || trade.closeDate === "";
            return isNotClosed;
        });
    }, [sortedTrades]);

    if (closedTrades.length === 0 && openTrades.length === 0) {
        return (
            <div className="flex items-center justify-center h-[60vh] bg-zinc-50/50 w-full">
                <div className="border border-zinc-200/80 rounded-xl p-8 text-center bg-white shadow-xs">
                    <p className="text-zinc-800 font-medium mb-1">No trades found</p>
                    <p className="text-xs text-zinc-500 font-mono">Add some trades to see your history</p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 w-full max-w-none bg-zinc-50/50 min-h-full">
            {activeTab === "openTrades" && (
                openTrades.length > 0 ? (
                    <OpenTradesTable trades={openTrades} />
                ) : (
                    <div className="flex items-center justify-center h-[60vh] w-full">
                        <div className="border border-zinc-200/80 rounded-xl p-8 text-center bg-white shadow-xs">
                            <p className="text-zinc-800 font-medium mb-1">No open trades</p>
                            <p className="text-xs text-zinc-500 font-mono">All your positions are closed</p>
                        </div>
                    </div>
                )
            )}

            {activeTab === "closedTrades" && (
                closedTrades.length > 0 ? (
                    <CloseTradesTable trades={closedTrades} total={total} />
                ) : (
                    <div className="flex items-center justify-center h-[60vh] w-full">
                        <div className="border border-zinc-200/80 rounded-xl p-8 text-center bg-white shadow-xs">
                            <p className="text-zinc-800 font-medium mb-1">No closed trades</p>
                            <p className="text-xs text-zinc-500 font-mono">Complete some trades to see your results</p>
                        </div>
                    </div>
                )
            )}
        </div>
    );
}
