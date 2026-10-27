"use client";

import { useMemo, useState, useEffect } from "react";
import dayjs from "dayjs";
import Link from "next/link";
import { FileText, Plus, ArrowLeft, ArrowUpRight } from "lucide-react";

import { getMonth } from "@/features/calendar/getTime";
import { useAppDispatch, useAppSelector } from "@/redux/store";
import { setIsDialogOpen } from "@/redux/slices/calendarSlice";
import { TradeDialog } from "../trade-dialog";
import { Sheet, SheetContent, SheetTrigger, SheetTitle, SheetDescription } from "../ui/sheet";
import { TradeList } from "./TradeList";
import { Trades } from "@/types";
import { getClosedTradesForDay, getOpenTradesForDay } from "@/features/calendar/getClosedTradesForDay";
import { getJournalDates } from "@/server/actions/journal";

interface DayTradeDrawerProps {
    day: dayjs.Dayjs;
    dayKey: string;
    allTrades: Trades[];
    netPnL: number | undefined;
    openTradesCount: number;
    hasJournalEntry: boolean;
    onClose: () => void;
}

function DayTradeDrawer({
    day,
    dayKey,
    allTrades,
    netPnL,
    openTradesCount,
    hasJournalEntry,
    onClose,
}: DayTradeDrawerProps) {
    const [viewMode, setViewMode] = useState<"review" | "add-trade">("review");

    const closedTrades = useMemo(
        () => getClosedTradesForDay(allTrades, dayKey),
        [allTrades, dayKey]
    );
    const openTrades = useMemo(
        () => getOpenTradesForDay(allTrades, dayKey),
        [allTrades, dayKey]
    );

    if (viewMode === "add-trade") {
        return (
            <div className="flex flex-col h-full">
                <div className="flex items-center gap-2 p-4 border-b border-slate-200 bg-slate-50">
                    <button
                        type="button"
                        onClick={() => setViewMode("review")}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 transition-colors"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Back to Day Review
                    </button>
                    <span className="text-xs text-slate-400">|</span>
                    <span className="text-xs font-medium text-slate-700">
                        {day.format("MMMM D, YYYY")}
                    </span>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    <TradeDialog day={day} onRequestClose={onClose} />
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full divide-y divide-slate-100 overflow-y-auto">
            {/* Header */}
            <div className="p-5 bg-white space-y-3">
                <div className="flex items-start justify-between">
                    <div>
                        <SheetTitle className="text-base font-bold text-slate-900">
                            {day.format("dddd, MMMM D, YYYY")}
                        </SheetTitle>
                        <SheetDescription className="text-xs text-slate-500 mt-0.5">
                            Daily Trading Execution & Position Review
                        </SheetDescription>
                    </div>
                    <button
                        type="button"
                        onClick={() => setViewMode("add-trade")}
                        className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-3 py-1.5 rounded-lg transition-colors shadow-2xs"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Add Trade
                    </button>
                </div>

                {/* Day Summary KPI Cards */}
                <div className="grid grid-cols-3 gap-2.5 pt-1">
                    <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                            Realized P&L
                        </span>
                        <p
                            className={`text-base font-bold font-mono tabular-nums mt-0.5 ${
                                netPnL !== undefined && netPnL > 0
                                    ? "text-emerald-700"
                                    : netPnL !== undefined && netPnL < 0
                                    ? "text-rose-700"
                                    : "text-slate-600"
                            }`}
                        >
                            {netPnL !== undefined
                                ? (netPnL >= 0 ? "+$" : "-$") +
                                  Math.abs(netPnL).toLocaleString("en-US", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                  })
                                : "$0.00"}
                        </p>
                    </div>

                    <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                            Closed Events
                        </span>
                        <p className="text-base font-bold font-mono text-slate-800 tabular-nums mt-0.5">
                            {closedTrades.length}
                        </p>
                    </div>

                    <div className="p-3 rounded-xl border border-slate-200/80 bg-slate-50/50">
                        <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 block">
                            Open Lots
                        </span>
                        <p className="text-base font-bold font-mono text-slate-800 tabular-nums mt-0.5">
                            {openTradesCount}
                        </p>
                    </div>
                </div>

                {/* Journal Quick Link */}
                <div className="pt-1">
                    <Link
                        href={`/private/journal/${day.format("YYYY/MM/DD")}`}
                        className="flex items-center justify-between p-2.5 rounded-xl border border-amber-200/80 bg-amber-50/60 hover:bg-amber-100/80 text-amber-900 transition-colors text-xs font-medium group"
                    >
                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-amber-700 shrink-0" />
                            <span>
                                {hasJournalEntry
                                    ? "Review Trading Journal for this Day"
                                    : "Write Trading Journal for this Day"}
                            </span>
                        </div>
                        <ArrowUpRight className="w-3.5 h-3.5 text-amber-600 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </Link>
                </div>
            </div>

            {/* Trades Lists */}
            <div className="p-5 space-y-4 bg-slate-50/40 flex-1">
                {closedTrades.length > 0 && (
                    <TradeList
                        displayItems={closedTrades}
                        title="Closed Trades & Adjustments"
                        type="closed"
                    />
                )}

                {openTrades.length > 0 && (
                    <TradeList
                        displayItems={openTrades}
                        title="Opened Positions"
                        type="open"
                    />
                )}

                {closedTrades.length === 0 && openTrades.length === 0 && (
                    <div className="p-8 text-center border border-dashed border-slate-200 rounded-xl bg-white">
                        <p className="text-xs text-slate-500 font-medium">
                            No recorded executions on this date.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function MonthView() {
    const { month, year } = useAppSelector((state) => state.calendar.monthView);
    const trades = useAppSelector(
        (state) => state.tradeRecords.monthViewSummary
    );
    const isDialogOpen = useAppSelector((state) => state.calendar.isDialogOpen);

    const tradeDetailsForEachDay = useAppSelector(
        (state) => state.tradeRecords.tradeDetailsForEachDay
    );
    const allTrades =
        useAppSelector((state) => state.tradeRecords.listOfTrades) ?? [];

    const [journalDates, setJournalDates] = useState<Set<string>>(new Set());

    useEffect(() => {
        const fetchJournalDates = async () => {
            const dates = await getJournalDates();
            if (!dates || !Array.isArray(dates)) {
                setJournalDates(new Set());
                return;
            }
            const formattedDates = new Set(
                dates.map((date) => dayjs(date).format("DD-MM-YYYY"))
            );
            setJournalDates(formattedDates);
        };
        fetchJournalDates();
    }, []);

    const currentMonth = getMonth(month, year);
    const dispatch = useAppDispatch();

    const toggleDialog = (dayKey: string, open: boolean) => {
        dispatch(setIsDialogOpen({ key: dayKey, value: open }));
    };

    return (
        <div
            style={{
                gridTemplateRows: `repeat(${currentMonth.length}, minmax(88px, 1fr))`,
            }}
            className="grid h-full min-h-[620px] w-full min-w-0 grid-cols-7 gap-[1px] bg-zinc-200 p-[1px]"
        >
            {currentMonth.map((week, i) => (
                <div key={i} className="grid grid-cols-7 col-span-7 row-span-1 gap-[1px]">
                    {week.map((day) => {
                        const dayKey = day.format("DD-MM-YYYY");
                        const hasJournalEntry = journalDates.has(dayKey);
                        const hasTradeDetails =
                            tradeDetailsForEachDay[dayKey] !== undefined;
                        const netPnL = trades[dayKey];
                        const hasClosedTrades = netPnL !== undefined;

                        const openTradesCount = allTrades.filter(
                            (trade) =>
                                (!trade.closeDate || trade.closeDate === "") &&
                                dayjs(trade.openDate).format("DD-MM-YYYY") === dayKey
                        ).length;

                        const hasAnyTrade =
                            hasTradeDetails || hasClosedTrades || openTradesCount > 0;
                        const isToday =
                            day.format("DD-MM-YY") === dayjs().format("DD-MM-YY");

                        // Heatmap cell background
                        let cellBg = "bg-white hover:bg-slate-50/80";
                        if (hasClosedTrades && netPnL > 0) {
                            cellBg =
                                "bg-emerald-50/60 hover:bg-emerald-100/70 border-emerald-200/50";
                        } else if (hasClosedTrades && netPnL < 0) {
                            cellBg =
                                "bg-rose-50/60 hover:bg-rose-100/70 border-rose-200/50";
                        } else if (hasClosedTrades && netPnL === 0) {
                            cellBg = "bg-slate-50 hover:bg-slate-100";
                        } else if (openTradesCount > 0) {
                            cellBg = "bg-sky-50/40 hover:bg-sky-100/60";
                        }

                        return (
                            <Sheet
                                key={dayKey}
                                open={!!isDialogOpen[dayKey]}
                                onOpenChange={(open) => toggleDialog(dayKey, open)}
                            >
                                <div
                                    className={`group relative flex min-h-0 min-w-0 flex-col transition-colors ${cellBg}`}
                                >
                                    <SheetTrigger asChild>
                                        <button
                                            type="button"
                                            aria-label={`${day.format("dddd, MMMM D, YYYY")}. ${hasAnyTrade ? "Open day review" : "Add a trade"}${hasJournalEntry ? ". Journal entry recorded" : ""}`}
                                            className="flex h-full min-h-0 w-full flex-col justify-between p-2 text-left select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-500"
                                        >
                                        {/* Top Row: Weekday Header (Row 0 only) & Day Number & Status Badges */}
                                        <div className={`w-full ${hasJournalEntry ? "pr-7" : ""}`}>
                                            {i === 0 && (
                                                <p className="mb-1 text-[10px] font-medium text-zinc-400">
                                                    {day.format("ddd")}
                                                </p>
                                            )}

                                            <div className="flex items-center justify-between">
                                                <div
                                                    className={`${
                                                        isToday
                                                            ? "w-6 h-6 rounded-full bg-amber-500 text-white font-bold text-xs flex items-center justify-center shadow-xs"
                                                        : "text-xs font-semibold text-zinc-700"
                                                    }`}
                                                >
                                                    {day.date() === 1
                                                        ? day.format("MMM D")
                                                        : day.format("D")}
                                                </div>

                                                <div className="flex items-center gap-1">
                                                    {openTradesCount > 0 && (
                                                        <span
                                                            className="rounded border border-sky-200/60 bg-sky-100/80 px-1.5 py-0.5 font-mono text-[10px] font-semibold tabular-nums text-sky-700"
                                                        >
                                                            {openTradesCount}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Center / Bottom: Financial P&L Metric */}
                                        <div className="mt-auto pt-2">
                                            {hasClosedTrades ? (
                                                <div className="min-w-0">
                                                    <p
                                                        className={`truncate font-mono text-sm font-bold tabular-nums tracking-tight ${
                                                            netPnL > 0
                                                                ? "text-emerald-700"
                                                                : netPnL < 0
                                                                ? "text-rose-700"
                                                                : "text-slate-600"
                                                        }`}
                                                    >
                                                        {netPnL >= 0 ? "+$" : "-$"}
                                                        {Math.abs(netPnL).toLocaleString(
                                                            "en-US",
                                                            {
                                                                minimumFractionDigits: 2,
                                                                maximumFractionDigits: 2,
                                                            }
                                                        )}
                                                    </p>
                                                    <span className="block text-[10px] font-medium text-zinc-400">
                                                        Closed P&L
                                                    </span>
                                                </div>
                                            ) : openTradesCount > 0 ? (
                                                <div className="text-left">
                                                    <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold text-sky-700">
                                                        <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                                                        Open lot
                                                    </span>
                                                </div>
                                            ) : (
                                                <div className="h-5 flex items-center justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <span className="inline-flex items-center gap-1 rounded bg-zinc-100/90 px-1.5 py-0.5 text-[10px] font-medium text-zinc-500">
                                                        <Plus className="w-3 h-3" /> Add
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                        </button>
                                    </SheetTrigger>

                                    {hasJournalEntry && (
                                        <Link
                                            href={`/private/journal/${day.format("YYYY/MM/DD")}`}
                                            aria-label={`Open journal entry for ${day.format("MMMM D, YYYY")}`}
                                            className={`absolute right-2 z-10 rounded p-1 text-amber-800 shadow-2xs transition-colors hover:bg-amber-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 ${
                                                i === 0 ? "top-7" : "top-2"
                                            }`}
                                        >
                                            <FileText className="h-3 w-3" aria-hidden="true" />
                                        </Link>
                                    )}
                                </div>

                                <SheetContent className="w-[500px] sm:max-w-[540px] p-0">
                                    {hasAnyTrade ? (
                                        <DayTradeDrawer
                                            day={day}
                                            dayKey={dayKey}
                                            allTrades={allTrades}
                                            netPnL={netPnL}
                                            openTradesCount={openTradesCount}
                                            hasJournalEntry={hasJournalEntry}
                                            onClose={() =>
                                                toggleDialog(dayKey, false)
                                            }
                                        />
                                    ) : (
                                        <div className="p-6 h-full overflow-y-auto">
                                            <TradeDialog
                                                day={day}
                                                onRequestClose={() =>
                                                    toggleDialog(dayKey, false)
                                                }
                                            />
                                        </div>
                                    )}
                                </SheetContent>
                            </Sheet>
                        );
                    })}
                </div>
            ))}
        </div>
    );
}
