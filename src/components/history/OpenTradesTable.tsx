"use client";

import { useState, useEffect, useMemo } from "react";
import { BookOpen, Trash2, ChevronDown, ChevronRight, RefreshCw, XCircle, PlusCircle, MinusCircle, Pencil, Layers, Calendar } from "lucide-react";
import { FaArrowTrendDown, FaArrowTrendUp } from "react-icons/fa6";

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

const formatCurrency = (val: number): string => {
    return val.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
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
            <div className="border border-zinc-200/80 rounded-xl p-8 text-center text-zinc-500 bg-white shadow-xs">
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
        <div className="flex flex-col gap-4 pt-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="border border-zinc-200/80 rounded-xl p-4 bg-white shadow-xs hover:border-zinc-300 transition-colors">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Active Positions</p>
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            Unified
                        </span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-2">
                        <p className="text-2xl font-bold text-zinc-800 font-mono tabular-nums">
                            {aggregatedPositions.length}
                        </p>
                        <div className="flex items-center gap-1 text-[11px] text-zinc-400 font-medium">
                            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin text-blue-500" : ""}`} />
                            <span>
                                {lastUpdated ? `Refreshed ${relativeTime}` : "Connecting..."}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="border border-zinc-200/80 rounded-xl p-4 bg-white shadow-xs hover:border-zinc-300 transition-colors">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total Position Value</p>
                        <span className="text-[11px] font-medium font-mono tabular-nums text-zinc-500 bg-zinc-100 px-2 py-0.5 rounded-md border border-zinc-200/60">
                            Cost: ${formatCurrency(totalPositionCost)}
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-zinc-800 font-mono tabular-nums mt-2">
                        ${formatCurrency(totalPositionValue)}
                    </p>
                </div>

                <div className="border border-zinc-200/80 rounded-xl p-4 bg-white shadow-xs hover:border-zinc-300 transition-colors">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Total Unrealized P/L</p>
                        {totalPositionCost > 0 && (
                            <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full font-mono tabular-nums ${
                                totalUnrealizedPnL >= 0 
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200/60" 
                                    : "bg-rose-50 text-rose-700 border border-rose-200/60"
                            }`}>
                                {totalUnrealizedPnL >= 0 ? "+" : ""}{totalROIPercent.toFixed(2)}%
                            </span>
                        )}
                    </div>
                    <p className={`text-2xl font-bold font-mono tabular-nums mt-2 ${totalUnrealizedPnL >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {totalUnrealizedPnL >= 0 ? "+" : ""}${formatCurrency(totalUnrealizedPnL)}
                    </p>
                </div>
            </div>

            <div className="border border-zinc-200/80 rounded-xl bg-white overflow-hidden shadow-xs w-full max-w-none">
                <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-zinc-50/80 border-b border-zinc-200 text-xs font-semibold uppercase tracking-wider text-zinc-500 w-full">
                    <div className="col-span-5 md:col-span-3">Position / Symbol</div>
                    <div className="col-span-2 text-center hidden md:block">Avg Entry (VWAP)</div>
                    <div className="col-span-2 text-center hidden md:block">Mark Price</div>
                    <div className="col-span-1 text-center hidden md:block">Total Qty</div>
                    <div className="col-span-4 md:col-span-2 text-center">Unreal. P&L (%)</div>
                    <div className="col-span-3 md:col-span-2 text-right">Actions</div>
                </div>

                <div className="max-h-[65vh] overflow-y-auto divide-y divide-zinc-100 w-full">
                    {aggregatedPositions.map((pos) => {
                        const isExpanded = expandedPositionKey === pos.key;
                        const currentPrice = prices[pos.symbolName] ?? null;
                        const { pnl, pnlPercent } = calculatePositionPnL(pos, currentPrice);
                        const isBuy = pos.positionType === "buy";
                        const primaryTrade = pos.primaryTrade;

                        return (
                            <div key={pos.key} className="hover:bg-zinc-50/80 transition-colors w-full">
                                <div
                                    className="grid grid-cols-12 gap-2 px-4 py-3.5 items-center w-full cursor-pointer"
                                    onClick={() => toggleExpanded(pos.key)}
                                >
                                    <div className="col-span-5 md:col-span-3 flex items-center gap-2">
                                        <button className="shrink-0 text-zinc-400 hover:text-zinc-600 transition-colors">
                                            {isExpanded ? (
                                                <ChevronDown className="w-4 h-4" />
                                            ) : (
                                                <ChevronRight className="w-4 h-4" />
                                            )}
                                        </button>
                                        {isBuy ? (
                                            <span className="border border-emerald-300 text-emerald-700 bg-emerald-50 text-[11px] font-mono font-bold w-5 h-5 flex items-center justify-center rounded shrink-0">
                                                L
                                            </span>
                                        ) : (
                                            <span className="border border-rose-300 text-rose-700 bg-rose-50 text-[11px] font-mono font-bold w-5 h-5 flex items-center justify-center rounded shrink-0">
                                                S
                                            </span>
                                        )}
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="font-bold text-sm text-zinc-800 tracking-tight whitespace-nowrap">
                                                    {pos.symbolName}
                                                </span>
                                                {pos.allEvents.length > 1 && (
                                                    <span className="border border-zinc-200 text-zinc-600 bg-zinc-100/90 text-[10px] font-mono px-1.5 py-0.5 rounded font-semibold shrink-0" title={`${pos.allEvents.length} activities recorded for this position`}>
                                                        {pos.allEvents.length} activities
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[11px] text-zinc-400 font-medium md:hidden">
                                                {new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(new Date(pos.openDate))}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="col-span-2 hidden md:block text-center text-sm font-mono tabular-nums text-zinc-700 font-semibold">
                                        ${formatPrice(pos.avgEntryPrice)}
                                    </div>

                                    <div className="col-span-2 hidden md:block text-center text-sm font-mono tabular-nums text-zinc-700">
                                        {currentPrice !== null ? (
                                            <span className="inline-flex items-center gap-1">
                                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" title="Live price" />
                                                ${formatPrice(currentPrice)}
                                            </span>
                                        ) : (
                                            <span className="text-zinc-300">—</span>
                                        )}
                                    </div>

                                    <div className="col-span-1 hidden md:block text-center text-sm font-mono tabular-nums text-zinc-700 font-medium">
                                        {formatQty(pos.totalQuantity)}
                                    </div>

                                    <div className="col-span-4 md:col-span-2 text-center text-sm font-mono tabular-nums">
                                        {pnl !== null && pnlPercent !== null ? (
                                            <div className="flex flex-col items-center justify-center">
                                                <div className="flex items-center gap-1 font-bold">
                                                    {pnl >= 0 ? (
                                                        <FaArrowTrendUp className="text-emerald-600 text-xs" />
                                                    ) : (
                                                        <FaArrowTrendDown className="text-rose-600 text-xs" />
                                                    )}
                                                    <span className={pnl >= 0 ? "text-emerald-600" : "text-rose-600"}>
                                                        {pnl >= 0 ? "+" : ""}
                                                        ${formatCurrency(pnl)}
                                                    </span>
                                                </div>
                                                <span className={`text-[11px] font-semibold px-1.5 py-0.2 rounded mt-0.5 ${
                                                    pnl >= 0 
                                                        ? "text-emerald-700 bg-emerald-50 border border-emerald-200/60" 
                                                        : "text-rose-700 bg-rose-50 border border-rose-200/60"
                                                }`}>
                                                    {pnlPercent >= 0 ? "+" : ""}{pnlPercent.toFixed(2)}%
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-zinc-300">—</span>
                                        )}
                                    </div>

                                    <div className="col-span-3 md:col-span-2 flex items-center justify-end gap-1.5 shrink-0 pl-2" onClick={(e) => e.stopPropagation()}>
                                        {/* Primary Action: + Add */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                if (!primaryTrade) {
                                                    toast.error("No active primary lot found for this position.");
                                                    return;
                                                }
                                                setAdjustSheetState({ trade: primaryTrade, mode: "add" });
                                            }}
                                            className="px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 flex items-center gap-1 transition-colors shrink-0 shadow-2xs cursor-pointer"
                                            title="Add to Position (Scale In / 补仓)"
                                        >
                                            <PlusCircle className="w-3.5 h-3.5" />
                                            <span>Add</span>
                                        </button>

                                        {/* Secondary Actions: Manage ▾ Dropdown Menu */}
                                        <Popover open={openManageMenuKey === pos.key} onOpenChange={(open) => setOpenManageMenuKey(open ? pos.key : null)}>
                                            <PopoverTrigger asChild>
                                                <button
                                                    type="button"
                                                    className="px-2 py-1 text-xs font-medium rounded-md bg-white hover:bg-zinc-100 text-zinc-700 border border-zinc-200 flex items-center gap-1 transition-colors shrink-0 shadow-2xs cursor-pointer"
                                                    title="Manage Position"
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
                                                            <span className="text-[10px] font-semibold bg-orange-100 text-orange-700 px-1.5 py-0.2 rounded-full">
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
                                    <div className="bg-zinc-50/90 border-t border-zinc-100 px-4 py-3.5 space-y-4">
                                        {/* Position Actions Toolbar */}
                                        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-white border border-zinc-200/80 rounded-lg shadow-2xs">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-semibold text-zinc-700">Quick Actions:</span>
                                                {pos.isMultiple ? (
                                                    <span className="text-[11px] text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 font-medium">
                                                        {pos.constituentTrades.length} lots consolidated • Scale operations apply to Primary Lot #{primaryTrade.id.slice(0, 8)}
                                                    </span>
                                                ) : (
                                                    <span className="text-[11px] text-zinc-500 font-mono">
                                                        Lot #{primaryTrade.id.slice(0, 8)}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setAdjustSheetState({ trade: primaryTrade, mode: "add" })}
                                                    className="px-2.5 py-1 text-xs font-semibold rounded-md bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                                                >
                                                    <PlusCircle className="w-3.5 h-3.5" />
                                                    <span>Add to Position</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setAdjustSheetState({ trade: primaryTrade, mode: "reduce" })}
                                                    className="px-2.5 py-1 text-xs font-semibold rounded-md bg-amber-600 hover:bg-amber-700 text-white flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                                                >
                                                    <MinusCircle className="w-3.5 h-3.5" />
                                                    <span>Reduce Position</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setAdjustSheetState({ trade: primaryTrade, mode: "close" })}
                                                    className="px-2.5 py-1 text-xs font-semibold rounded-md bg-rose-600 hover:bg-rose-700 text-white flex items-center gap-1 transition-colors shadow-2xs cursor-pointer"
                                                >
                                                    <XCircle className="w-3.5 h-3.5" />
                                                    <span>Close Position</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => setEditInitialTrade(primaryTrade)}
                                                    className="px-2 py-1 text-xs font-medium rounded-md bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center gap-1 transition-colors border border-zinc-200 cursor-pointer"
                                                    title="Edit initial open record baseline"
                                                >
                                                    <Pencil className="w-3 h-3" />
                                                    <span>Edit initial entry</span>
                                                </button>
                                            </div>
                                        </div>

                                        {pos.isMultiple && (
                                            <div className="space-y-1.5">
                                                <div className="flex items-center gap-1.5">
                                                    <Layers className="w-3.5 h-3.5 text-blue-600" />
                                                    <h4 className="text-xs font-semibold text-zinc-600 uppercase tracking-wider">
                                                        Consolidated Lots ({pos.constituentTrades.length} records)
                                                    </h4>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                                                    {pos.constituentTrades.map((trade, idx) => (
                                                        <div key={trade.id} className="p-2.5 bg-white border border-blue-100 rounded-lg text-xs font-mono space-y-1 shadow-2xs">
                                                            <div className="flex items-center justify-between text-zinc-500 text-[11px]">
                                                                <span>Lot #{idx + 1} ({dayjs(trade.openDate).format("DD MMM YYYY")})</span>
                                                                <span className="text-[10px] text-zinc-400">{trade.openTime || "00:00"}</span>
                                                            </div>
                                                            <div className="flex items-baseline justify-between">
                                                                <span className="font-bold text-zinc-800">{formatQty(trade.quantity || 0)} units</span>
                                                                <span className="text-zinc-600">@ ${formatPrice(trade.entryPrice || 0)}</span>
                                                            </div>
                                                            <div className="text-[10px] text-zinc-400 text-right">
                                                                Cost: ${formatCurrency((Number(trade.quantity) || 0) * (Number(trade.entryPrice) || 0))}
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
                                                    <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                                        Position Timeline ({pos.allEvents.length} {pos.allEvents.length === 1 ? 'event' : 'events'})
                                                    </h4>
                                                </div>
                                                <span className="text-xs font-medium text-zinc-500 font-mono">
                                                    Net Holding: {formatQty(pos.totalQuantity)} units @ VWAP ${formatPrice(pos.avgEntryPrice)}
                                                </span>
                                            </div>

                                            <div className="space-y-1.5">
                                                {pos.allEvents.map((event, index) => {
                                                    const isScaleIn = event.eventType === "add" || event.isInitialOpen;
                                                    const isFullClose = event.eventType === "close";

                                                    return (
                                                        <div 
                                                            key={event.id || index}
                                                            className="grid grid-cols-12 gap-2 py-2 text-xs font-mono tabular-nums bg-white rounded-lg px-3 border border-zinc-200/70 items-center"
                                                        >
                                                            <div className="col-span-3 text-zinc-600 font-sans">
                                                                {new Intl.DateTimeFormat("en-GB", {
                                                                    day: "2-digit",
                                                                    month: "short",
                                                                    year: "numeric",
                                                                }).format(new Date(event.date))}
                                                                <span className="ml-1 text-[11px] text-zinc-400 font-mono">{event.time}</span>
                                                            </div>

                                                            <div className="col-span-3 text-zinc-700">
                                                                <span className="text-zinc-400">@ </span>
                                                                ${formatPrice(event.price)}
                                                            </div>

                                                            <div className="col-span-3">
                                                                {event.isInitialOpen ? (
                                                                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/50">
                                                                        {formatQty(event.quantity)} (Open)
                                                                    </span>
                                                                ) : isScaleIn ? (
                                                                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                                                                        +{formatQty(event.quantity)} (Add)
                                                                    </span>
                                                                ) : isFullClose ? (
                                                                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200/50">
                                                                        -{formatQty(event.quantity)} (Close)
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200/50">
                                                                        -{formatQty(event.quantity)} (Reduce)
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="col-span-3 flex items-center gap-1.5 justify-end font-semibold">
                                                                {event.result !== undefined && event.result !== 0 ? (
                                                                    <>
                                                                        {event.result >= 0 ? (
                                                                            <FaArrowTrendUp className="text-emerald-600 text-xs" />
                                                                        ) : (
                                                                            <FaArrowTrendDown className="text-rose-600 text-xs" />
                                                                        )}
                                                                        <span className={event.result >= 0 ? "text-emerald-600" : "text-rose-600"}>
                                                                            {event.result >= 0 ? "+" : ""}
                                                                            ${formatCurrency(event.result)}
                                                                        </span>
                                                                    </>
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
                                                                        className="p-1 rounded hover:bg-red-50 text-zinc-300 hover:text-red-500 transition-colors ml-1"
                                                                        title="Delete this event"
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
                    onOpenChange={setDeleteDialogOpen}
                    symbolName={tradeToDelete.symbolName}
                    onConfirm={() => {
                        handleDeleteOpenTrade(tradeToDelete.id);
                        setDeleteDialogOpen(false);
                        setTradeToDelete(null);
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
