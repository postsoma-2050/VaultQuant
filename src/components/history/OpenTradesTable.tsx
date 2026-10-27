"use client";

import { useState, useEffect, useMemo } from "react";
import { BookOpen, Trash2, ChevronDown, ChevronRight, RefreshCw, XCircle, PlusCircle, MinusCircle, Pencil, Layers, Calendar } from "lucide-react";

import { Trades } from "@/types";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { TradeDialog } from "../trade-dialog";
import DeleteTradeDialog from "./DeleteTradeDialog";
import { useDeleteOpenTrade } from "@/hooks/useDeleteOpenTrade";
import { Sheet, SheetContent } from "../ui/sheet";
import { parseTradeNotes } from "@/lib/tradeNotes";
import dayjs from "dayjs";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { deletePositionEvent } from "@/server/actions/trades";
import { useAppDispatch } from "@/redux/store";
import { updateTradeInList } from "@/redux/slices/tradeRecordsSlice";
import { updateTradeInFilteredList } from "@/redux/slices/historyPageSlice";
import { toast } from "sonner";
import {
    aggregateOpenPositions,
    calculatePositionPnL,
} from "@/features/positions/aggregatePositions";

type OpenTradesTableProps = {
    trades: Trades[];
};

const formatQty = (qty: number | string): string => {
    const num = Number(qty);
    if (isNaN(num)) return "0";
    return Number(num.toPrecision(8)).toString();
};

const formatPrice = (price: number | string): string => {
    const num = Number(price);
    if (isNaN(num)) return "0";
    if (Math.abs(num) >= 1) {
        return num.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
        });
    }
    return num.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
    });
};

const formatCurrency = (val: number, showSign = false): string => {
    if (!Number.isFinite(val)) return "$0.00";
    const isNegative = val < 0;
    const formatted = Math.abs(val).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    if (isNegative) return `-$${formatted}`;
    if (showSign && val > 0) return `+$${formatted}`;
    return `$${formatted}`;
};

export const OpenTradesTable = ({ trades }: OpenTradesTableProps) => {
    const dispatch = useAppDispatch();
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [tradeToDelete, setTradeToDelete] = useState<Trades | null>(null);
    const [expandedPositionKey, setExpandedPositionKey] = useState<string | null>(null);
    const [openManageMenuKey, setOpenManageMenuKey] = useState<string | null>(null);
    const [adjustSheetState, setAdjustSheetState] = useState<{ trade: Trades; mode: "add" | "reduce" | "close" } | null>(null);
    const [editInitialTrade, setEditInitialTrade] = useState<Trades | null>(null);
    const [tradeNotesTrade, setTradeNotesTrade] = useState<Trades | null>(null);
    const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
    const { handleDeleteOpenTrade } = useDeleteOpenTrade();

    const aggregatedPositions = useMemo(() => {
        return aggregateOpenPositions(trades || []);
    }, [trades]);

    const symbols = useMemo(() => {
        return [...new Set(aggregatedPositions.map((p) => p.symbolName))];
    }, [aggregatedPositions]);

    const { prices, loading, lastUpdated } = useMarketPrices(symbols);
    const [relativeTime, setRelativeTime] = useState("Just now");

    useEffect(() => {
        if (!lastUpdated) return;

        const updateText = () => {
            const diffSeconds = Math.floor((Date.now() - lastUpdated.getTime()) / 1000);
            if (diffSeconds < 30) {
                setRelativeTime("Just now");
            } else if (diffSeconds < 60) {
                setRelativeTime(`${diffSeconds}s ago`);
            } else {
                const diffMinutes = Math.floor(diffSeconds / 60);
                setRelativeTime(`${diffMinutes} min ago`);
            }
        };

        updateText();
        const interval = setInterval(updateText, 10000);
        return () => clearInterval(interval);
    }, [lastUpdated]);

    const toggleExpanded = (key: string) => {
        setExpandedPositionKey(expandedPositionKey === key ? null : key);
    };

    if (!aggregatedPositions || aggregatedPositions.length === 0) {
        return (
            <div className="border border-zinc-200 rounded-lg p-8 text-center text-zinc-500 bg-white">
                No open trades yet
            </div>
        );
    }

    let totalPositionCost = 0;
    let totalPositionValue = 0;
    let totalUnrealizedPnL = 0;

    for (const pos of aggregatedPositions) {
        const markPrice = prices[pos.symbolName] ?? null;
        const { pnl, marketValue } = calculatePositionPnL(pos, markPrice);
        totalPositionCost += pos.totalCost;
        totalPositionValue += marketValue;
        if (pnl !== null) {
            totalUnrealizedPnL += pnl;
        }
    }

    const totalROIPercent = totalPositionCost > 0 ? (totalUnrealizedPnL / totalPositionCost) * 100 : 0;

    return (
        <div className="flex flex-col gap-4 pt-2 w-full min-w-0">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="border border-zinc-200 rounded-lg p-4 bg-white">
                    <div className="flex items-center justify-between">
                        <p className="text-[13px] font-medium text-zinc-500">Open positions</p>
                        <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                            <span className={`w-1.5 h-1.5 rounded-full ${lastUpdated ? "bg-emerald-500" : "bg-zinc-300"}`} aria-hidden="true" />
                            {lastUpdated ? "Prices current" : "Prices unavailable"}
                        </span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-2">
                        <p className="text-2xl font-semibold text-zinc-900 font-mono tabular-nums">
                            {aggregatedPositions.length}
                        </p>
                        <div className="flex items-center gap-1 text-xs text-zinc-500">
                            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin text-blue-500" : ""}`} />
                            <span>
                                {lastUpdated ? `Updated ${relativeTime}` : "Connecting..."}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="border border-zinc-200 rounded-lg p-4 bg-white">
                    <div className="flex items-center justify-between">
                        <p className="text-[13px] font-medium text-zinc-500">Position value</p>
                        <span className="text-xs font-medium font-mono tabular-nums text-zinc-500">
                            Cost {formatCurrency(totalPositionCost)}
                        </span>
                    </div>
                    <p className="text-2xl font-semibold text-zinc-900 font-mono tabular-nums mt-1.5">
                        {formatCurrency(totalPositionValue)}
                    </p>
                </div>

                <div className="border border-zinc-200 rounded-lg p-4 bg-white">
                    <div className="flex items-center justify-between">
                        <p className="text-[13px] font-medium text-zinc-500">Unrealized P/L</p>
                        {totalPositionCost > 0 && (
                            <span className={`text-xs font-medium font-mono tabular-nums ${
                                totalUnrealizedPnL >= 0 
                                    ? "text-emerald-700"
                                    : "text-rose-700"
                            }`}>
                                {totalUnrealizedPnL >= 0 ? "+" : ""}{totalROIPercent.toFixed(2)}%
                            </span>
                        )}
                    </div>
                    <p className={`text-2xl font-semibold font-mono tabular-nums mt-1.5 ${totalUnrealizedPnL >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {formatCurrency(totalUnrealizedPnL, true)}
                    </p>
                </div>
            </div>

            <div className="border border-zinc-200 rounded-lg bg-white overflow-hidden w-full min-w-0 max-w-none">
                <div className="grid grid-cols-20 gap-2 px-3 py-2.5 bg-zinc-50 border-b border-zinc-200 text-xs font-medium text-zinc-500 w-full">
                    <div className="col-span-8 xl:col-span-4">Position / Symbol</div>
                    <div className="col-span-3 text-center hidden xl:block">Avg Entry (VWAP)</div>
                    <div className="col-span-3 text-center hidden xl:block">Mark Price</div>
                    <div className="col-span-2 text-right pr-3 hidden xl:block">Total Qty</div>
                    <div className="col-span-7 xl:col-span-3 text-right pr-3">Unreal. P&amp;L (%)</div>
                    <div className="col-span-5 xl:col-span-5 text-right">Actions</div>
                </div>

                <div className="divide-y divide-zinc-100 w-full">
                    {aggregatedPositions.map((pos) => {
                        const isExpanded = expandedPositionKey === pos.key;
                        const currentPrice = prices[pos.symbolName] ?? null;
                        const { pnl, pnlPercent } = calculatePositionPnL(pos, currentPrice);
                        const isBuy = pos.positionType === "buy";
                        const primaryTrade = pos.primaryTrade;

                        return (
                            <div key={pos.key} className="hover:bg-zinc-50/80 transition-colors w-full">
                                <div
                                    className="grid grid-cols-20 gap-2 px-3 py-3 items-center w-full"
                                >
                                    <div className="col-span-8 xl:col-span-4 flex min-w-0 items-center gap-2">
                                        <button
                                            type="button"
                                            aria-expanded={isExpanded}
                                            aria-label={`${isExpanded ? "Collapse" : "Expand"} ${pos.symbolName} position details`}
                                            onClick={() => toggleExpanded(pos.key)}
                                            className="shrink-0 rounded p-0.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                                        >
                                            {isExpanded ? (
                                                <ChevronDown className="w-4 h-4" aria-hidden="true" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4" aria-hidden="true" />
                                            )}
                                        </button>
                                        <span className={`font-mono text-xs font-semibold shrink-0 ${isBuy ? "text-emerald-700" : "text-rose-700"}`}>
                                            {isBuy ? "Long" : "Short"}
                                        </span>
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className="font-semibold text-[13px] text-zinc-900 truncate">
                                                    {pos.symbolName}
                                                </span>
                                                {pos.allEvents.length > 1 && (
                                                    <span className="text-xs text-zinc-500 shrink-0">
                                                        {pos.allEvents.length} events
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-xs text-zinc-500 xl:hidden">
                                                {new Intl.DateTimeFormat("en-US", { day: "2-digit", month: "short" }).format(new Date(pos.openDate))}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="col-span-3 hidden xl:block text-center text-[13px] font-mono tabular-nums text-zinc-700 font-semibold">
                                        ${formatPrice(pos.avgEntryPrice)}
                                    </div>

                                    <div className="col-span-3 hidden xl:block text-center text-[13px] font-mono tabular-nums text-zinc-700">
                                        {currentPrice !== null ? (
                                            <span>${formatPrice(currentPrice)}</span>
                                        ) : (
                                            <span className="text-zinc-300">—</span>
                                        )}
                                    </div>

                                    <div className="col-span-2 hidden xl:block text-right pr-3 text-[13px] font-mono tabular-nums text-zinc-700">
                                        {formatQty(pos.totalQuantity)}
                                    </div>

                                    <div className="col-span-7 xl:col-span-3 text-right pr-3 text-[13px] font-mono tabular-nums">
                                        {pnl !== null && pnlPercent !== null ? (
                                            <div className="flex flex-col items-end justify-center">
                                                <span className={`font-semibold ${pnl >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                                    {formatCurrency(pnl, true)}
                                                </span>
                                                <span className={`text-xs font-medium mt-0.5 ${
                                                    pnl >= 0 
                                                        ? "text-emerald-700"
                                                        : "text-rose-700"
                                                }`}>
                                                    {pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(2)}%
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-zinc-300">—</span>
                                        )}
                                    </div>

                                    <div className="col-span-5 flex items-center justify-end gap-1 shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!primaryTrade) {
                                                    toast.error("No active primary lot found for this position.");
                                                    return;
                                                }
                                                setAdjustSheetState({ trade: primaryTrade, mode: "add" });
                                            }}
                                            className="px-2 py-1 text-xs font-medium rounded-md bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 flex items-center gap-1 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                                            aria-label={`Add to ${pos.symbolName} position`}
                                        >
                                            <PlusCircle className="w-3.5 h-3.5" />
                                            <span>Add</span>
                                        </button>

                                        <Popover open={openManageMenuKey === pos.key} onOpenChange={(open) => setOpenManageMenuKey(open ? pos.key : null)}>
                                            <PopoverTrigger asChild>
                                                <button
                                                    type="button"
                                                    className="px-2 py-1 text-xs font-medium rounded-md bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 flex items-center gap-1 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                                                    aria-label={`Manage ${pos.symbolName} position`}
                                                >
                                                    <span>Manage</span>
                                                    <ChevronDown className="w-3 h-3 text-zinc-500" />
                                                </button>
                                            </PopoverTrigger>
                                            <PopoverContent align="end" className="w-48 p-1.5 shadow-xl border border-zinc-200 rounded-lg bg-white">
                                                <div className="flex flex-col gap-0.5 text-xs">
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setOpenManageMenuKey(null);
                                                            if (primaryTrade) {
                                                                setAdjustSheetState({ trade: primaryTrade, mode: "reduce" });
                                                            }
                                                        }}
                                                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-zinc-700 hover:bg-amber-50 hover:text-amber-800 transition-colors text-left cursor-pointer"
                                                    >
                                                        <MinusCircle className="w-3.5 h-3.5 text-amber-600" />
                                                        <span>Reduce Position</span>
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setOpenManageMenuKey(null);
                                                            if (primaryTrade) {
                                                                setAdjustSheetState({ trade: primaryTrade, mode: "close" });
                                                            }
                                                        }}
                                                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-zinc-700 hover:bg-rose-50 hover:text-rose-800 transition-colors text-left cursor-pointer"
                                                    >
                                                        <XCircle className="w-3.5 h-3.5 text-rose-600" />
                                                        <span>Close Position</span>
                                                    </button>

                                                    <div className="my-1 border-t border-zinc-100" />

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setOpenManageMenuKey(null);
                                                            if (primaryTrade) {
                                                                setEditInitialTrade(primaryTrade);
                                                            }
                                                        }}
                                                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-zinc-700 hover:bg-zinc-100 transition-colors text-left cursor-pointer"
                                                        title="Correct raw opening baseline"
                                                    >
                                                        <Pencil className="w-3.5 h-3.5 text-zinc-500" />
                                                        <span>Edit initial entry</span>
                                                    </button>

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setOpenManageMenuKey(null);
                                                            if (primaryTrade) {
                                                                setTradeNotesTrade(primaryTrade);
                                                            }
                                                        }}
                                                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-zinc-700 hover:bg-zinc-100 transition-colors text-left cursor-pointer"
                                                    >
                                                        <div className="flex items-center gap-2">
                                                            <BookOpen className="w-3.5 h-3.5 text-zinc-500" />
                                                            <span>Trade Notes</span>
                                                        </div>
                                                        {primaryTrade?.notes && parseTradeNotes(primaryTrade.notes, primaryTrade.openDate, primaryTrade.id).length > 0 && (
                                                            <span className="text-xs font-medium text-orange-700">
                                                                {parseTradeNotes(primaryTrade.notes, primaryTrade.openDate, primaryTrade.id).length}
                                                            </span>
                                                        )}
                                                    </button>

                                                    <div className="my-1 border-t border-zinc-100" />

                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setOpenManageMenuKey(null);
                                                            if (primaryTrade) {
                                                                setTradeToDelete(primaryTrade);
                                                                setDeleteDialogOpen(true);
                                                            }
                                                        }}
                                                        className="w-full flex items-center gap-2 px-2.5 py-1.5 rounded-md text-rose-600 hover:bg-rose-50 transition-colors text-left cursor-pointer"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                                                        <span>Delete Trade</span>
                                                    </button>
                                                </div>
                                            </PopoverContent>
                                        </Popover>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="bg-zinc-50 border-t border-zinc-100 px-3 py-3 space-y-4">
                                        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-white border border-zinc-200 rounded-md">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-medium text-zinc-600">Actions</span>
                                                {pos.isMultiple ? (
                                                    <span className="text-xs text-zinc-500">
                                                        {pos.constituentTrades.length} lots · changes apply to the primary lot
                                                    </span>
                                                ) : (
                                                    <span className="text-xs text-zinc-500 font-mono">
                                                        Lot {primaryTrade.id.slice(0, 8)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setAdjustSheetState({ trade: primaryTrade, mode: "add" })}
                                                    className="px-2.5 py-1 text-xs font-medium rounded-md bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 flex items-center gap-1 transition-colors"
                                                >
                                                    <PlusCircle className="w-3.5 h-3.5" />
                                                    <span>Add</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setAdjustSheetState({ trade: primaryTrade, mode: "reduce" })}
                                                    className="px-2.5 py-1 text-xs font-medium rounded-md bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 flex items-center gap-1 transition-colors"
                                                >
                                                    <MinusCircle className="w-3.5 h-3.5" />
                                                    <span>Reduce</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setAdjustSheetState({ trade: primaryTrade, mode: "close" })}
                                                    className="px-2.5 py-1 text-xs font-medium rounded-md bg-white hover:bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1 transition-colors"
                                                >
                                                    <XCircle className="w-3.5 h-3.5" />
                                                    <span>Close</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditInitialTrade(primaryTrade)}
                                                    className="px-2 py-1 text-xs font-medium rounded-md bg-white hover:bg-zinc-100 text-zinc-700 flex items-center gap-1 transition-colors border border-zinc-200"
                                                >
                                                    <Pencil className="w-3 h-3" />
                                                    <span>Edit entry</span>
                                                </button>
                                            </div>
                                        </div>

                                        {pos.isMultiple && (
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    <Layers className="w-3.5 h-3.5 text-zinc-500" />
                                                    <h4 className="text-xs font-medium text-zinc-600">
                                                        Lots · {pos.constituentTrades.length}
                                                    </h4>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
                                                    {pos.constituentTrades.map((trade, idx) => (
                                                        <div key={trade.id} className="p-2.5 bg-white border border-zinc-200 rounded-md text-xs font-mono space-y-1">
                                                            <div className="flex items-center justify-between gap-2 text-zinc-500">
                                                                <span className="truncate">Lot {idx + 1} · {dayjs(trade.openDate).format("DD MMM YYYY")}</span>
                                                                <span className="text-zinc-500 shrink-0">{trade.openTime || "00:00"}</span>
                                                            </div>
                                                            <div className="flex items-baseline justify-between">
                                                                <span className="font-semibold text-zinc-800">{formatQty(trade.quantity || 0)} units</span>
                                                                <span className="text-zinc-600">@ ${formatPrice(trade.entryPrice || 0)}</span>
                                                            </div>
                                                            <div className="text-xs text-zinc-500 text-right">
                                                                Cost {formatCurrency((Number(trade.quantity) || 0) * (Number(trade.entryPrice) || 0))}
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        <div className="space-y-1.5">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                                                    <h4 className="text-xs font-medium text-zinc-500">
                                                        Timeline · {pos.allEvents.length} {pos.allEvents.length === 1 ? 'event' : 'events'}
                                                    </h4>
                                                </div>
                                                <span className="text-xs font-medium text-zinc-500 font-mono">
                                                    {formatQty(pos.totalQuantity)} units · VWAP ${formatPrice(pos.avgEntryPrice)}
                                                </span>
                                            </div>

                                            <div className="space-y-1.5">
                                                {pos.allEvents.map((event, index) => {
                                                    const isScaleIn = event.eventType === "add" || event.isInitialOpen;
                                                    const isFullClose = event.eventType === "close";

                                                    return (
                                                        <div 
                                                            key={event.id || index}
                                                            className="grid grid-cols-12 gap-2 py-2 text-xs font-mono tabular-nums bg-white rounded-md px-3 border border-zinc-200 items-center"
                                                        >
                                                            <div className="col-span-3 text-zinc-600 font-sans">
                                                                {new Intl.DateTimeFormat("en-US", {
                                                                    day: "2-digit",
                                                                    month: "short",
                                                                    year: "numeric",
                                                                }).format(new Date(event.date))}
                                                                <span className="ml-1 text-xs text-zinc-500 font-mono">{event.time}</span>
                                                            </div>

                                                            <div className="col-span-3 text-zinc-700">
                                                                <span className="text-zinc-400">@ </span>
                                                                ${formatPrice(event.price)}
                                                            </div>

                                                            <div className="col-span-3">
                                                                {event.isInitialOpen ? (
                                                                    <span className="text-xs font-medium text-zinc-600">
                                                                        {formatQty(event.quantity)} (Open)
                                                                    </span>
                                                                ) : isScaleIn ? (
                                                                    <span className="text-xs font-medium text-emerald-700">
                                                                        +{formatQty(event.quantity)} (Add)
                                                                    </span>
                                                                ) : isFullClose ? (
                                                                    <span className="text-xs font-medium text-rose-700">
                                                                        -{formatQty(event.quantity)} (Close)
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-xs font-medium text-amber-700">
                                                                        -{formatQty(event.quantity)} (Reduce)
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="col-span-3 flex items-center gap-1.5 justify-end font-semibold">
                                                                {event.result !== undefined && event.result !== 0 ? (
                                                                    <span className={event.result >= 0 ? "text-emerald-600" : "text-rose-600"}>
                                                                        {formatCurrency(event.result, true)}
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-zinc-300 font-normal">—</span>
                                                                )}
                                                                {!event.isInitialOpen && event.id && (
                                                                    <button
                                                                        type="button"
                                                                        disabled={deletingEventId === event.id}
                                                                        onClick={async (e) => {
                                                                            e.stopPropagation();
                                                                            if (!event.id) return;
                                                                            setDeletingEventId(event.id);
                                                                            try {
                                                                                const res = await deletePositionEvent(event.tradeId, event.id);
                                                                                if (res?.updatedTrade) {
                                                                                    dispatch(updateTradeInList(res.updatedTrade));
                                                                                    dispatch(updateTradeInFilteredList(res.updatedTrade));
                                                                                    toast.success("Adjustment event deleted!");
                                                                                }
                                                                            } catch {
                                                                                toast.error("Failed to delete adjustment event.");
                                                                            } finally {
                                                                                setDeletingEventId(null);
                                                                            }
                                                                        }}
                                                                        className="p-1 rounded hover:bg-red-50 text-zinc-400 hover:text-red-600 transition-colors ml-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                                                                        aria-label={`Delete ${event.eventType} event for ${pos.symbolName}`}
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Delete Trade Confirmation Dialog */}
            {tradeToDelete && (
                <DeleteTradeDialog
                    isOpen={deleteDialogOpen}
                    onOpenChange={(open) => {
                        setDeleteDialogOpen(open);
                        if (!open) setTradeToDelete(null);
                    }}
                    symbolName={tradeToDelete.symbolName}
                    onConfirm={async () => {
                        return handleDeleteOpenTrade(tradeToDelete.id);
                    }}
                />
            )}

            {/* Adjust Position Sheet (Add / Reduce / Close) */}
            {adjustSheetState && (
                <Sheet 
                    open={!!adjustSheetState} 
                    onOpenChange={(open) => {
                        if (!open) setAdjustSheetState(null);
                    }}
                >
                    <SheetContent>
                        <TradeDialog
                            editMode={true}
                            existingTrade={adjustSheetState.trade}
                            initialTab="adjust-position"
                            initialAdjustMode={adjustSheetState.mode}
                            onRequestClose={() => setAdjustSheetState(null)}
                        />
                    </SheetContent>
                </Sheet>
            )}

            {/* Edit Initial Trade Record Sheet (Baseline) */}
            {editInitialTrade && (
                <Sheet 
                    open={!!editInitialTrade} 
                    onOpenChange={(open) => {
                        if (!open) setEditInitialTrade(null);
                    }}
                >
                    <SheetContent>
                        <TradeDialog
                            editMode={true}
                            existingTrade={editInitialTrade}
                            initialTab="open-details"
                            onRequestClose={() => setEditInitialTrade(null)}
                        />
                    </SheetContent>
                </Sheet>
            )}

            {/* Trade Notes Sheet */}
            {tradeNotesTrade && (
                <Sheet 
                    open={!!tradeNotesTrade} 
                    onOpenChange={(open) => {
                        if (!open) setTradeNotesTrade(null);
                    }}
                >
                    <SheetContent>
                        <TradeDialog
                            editMode={true}
                            existingTrade={tradeNotesTrade}
                            initialTab="notes"
                            onRequestClose={() => setTradeNotesTrade(null)}
                        />
                    </SheetContent>
                </Sheet>
            )}
        </div>
    );
};

export default OpenTradesTable;
