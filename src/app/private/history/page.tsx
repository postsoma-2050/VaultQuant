"use client";

import { parseCalendarDate, sortTrades } from "@/features/history/sortTrades";
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

    const hasActiveFilters = Boolean(
        timeframe !== "allHistory" ||
        (filteredTrades && filteredTrades.length !== (trades ?? []).length)
    );

    // A close date is sufficient for legacy rows. closeTime is optional.
    const closedTrades = useMemo(() => {
        const normalizedTrades = sortedTrades
            .filter((trade): trade is Trades & {
                closeDate: string;
                closeTime: string;
                result: string;
            } => Boolean(trade.closeDate && trade.closeDate !== ""))
            .map((trade) => ({
                ...trade,
                closeTime: trade.closeTime ?? "",
                result: trade.result ?? "",
            }));

        if (sortBy) return normalizedTrades;

        return normalizedTrades.sort((a, b) => {
            const dateDiff =
                (parseCalendarDate(b.closeDate)?.getTime() ?? 0) -
                (parseCalendarDate(a.closeDate)?.getTime() ?? 0);
            if (dateDiff !== 0) return dateDiff;

            return (b.closeTime || "").localeCompare(a.closeTime || "");
        });
    }, [sortedTrades, sortBy]);

    const total = useMemo(() => {
        return closedTrades.reduce((acc, trade) => acc + (Number(trade.result) || 0), 0);
    }, [closedTrades]);

    const openTrades = useMemo(() => {
        return sortedTrades.filter((trade) => {
            return !trade.closeDate || trade.closeDate === "";
        });
    }, [sortedTrades]);

    if (closedTrades.length === 0 && openTrades.length === 0) {
        return (
            <div className="flex items-center justify-center h-[60vh] bg-zinc-50/50 w-full">
                <div className="border border-zinc-200 rounded-lg p-8 text-center bg-white">
                    <p className="text-zinc-800 font-medium mb-1">
                        {hasActiveFilters ? "No matching trades" : "No trades found"}
                    </p>
                    <p className="text-[13px] text-zinc-500">
                        {hasActiveFilters
                            ? "Adjust or clear the filters to see more trades."
                            : "Add some trades to see your history."}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-4 lg:p-6 w-full max-w-none bg-zinc-50/50 min-h-full">
            {activeTab === "openTrades" && (
                openTrades.length > 0 ? (
                    <OpenTradesTable trades={openTrades} />
                ) : (
                    <div className="flex items-center justify-center h-[60vh] w-full">
                        <div className="border border-zinc-200 rounded-lg p-8 text-center bg-white">
                            <p className="text-zinc-800 font-medium mb-1">
                                {hasActiveFilters ? "No matching trades" : "No open trades"}
                            </p>
                            <p className="text-[13px] text-zinc-500">
                                {hasActiveFilters
                                    ? "Adjust or clear the filters to see more trades."
                                    : "All your positions are closed."}
                            </p>
                        </div>
                    </div>
                )
            )}

            {activeTab === "closedTrades" && (
                closedTrades.length > 0 ? (
                    <CloseTradesTable trades={closedTrades} total={total} />
                ) : (
                    <div className="flex items-center justify-center h-[60vh] w-full">
                        <div className="border border-zinc-200 rounded-lg p-8 text-center bg-white">
                            <p className="text-zinc-800 font-medium mb-1">
                                {hasActiveFilters ? "No matching trades" : "No closed trades"}
                            </p>
                            <p className="text-[13px] text-zinc-500">
                                {hasActiveFilters
                                    ? "Adjust or clear the filters to see more trades."
                                    : "Complete some trades to see your results."}
                            </p>
                        </div>
                    </div>
                )
            )}
        </div>
    );
}
