"use client";

import { useState, useEffect } from "react";
import { BookOpen, Trash2, ChevronDown, ChevronRight, RefreshCw, XCircle } from "lucide-react";
import { FaArrowTrendDown, FaArrowTrendUp } from "react-icons/fa6";

import { Trades } from "@/types";
import { CloseEvent } from "@/types/dbSchema.types";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card";
import { TradeDialog } from "../trade-dialog";
import DeleteTradeDialog from "./DeleteTradeDialog";
import { useDeleteOpenTrade } from "@/hooks/useDeleteOpenTrade";
import { Sheet, SheetContent, SheetTrigger } from "../ui/sheet";
import EditTrade from "./EditTrade";
import { parseTradeNotes } from "@/lib/tradeNotes";
import dayjs from "dayjs";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import { deletePositionEvent } from "@/server/actions/trades";
import { useAppDispatch } from "@/redux/store";
import { updateTradeInList } from "@/redux/slices/tradeRecordsSlice";
import { updateTradeInFilteredList } from "@/redux/slices/historyPageSlice";
import { toast } from "sonner";

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
            maximumFractionDigits: 2,
        });
    }
    return num.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 4,
    });
};

const formatCurrency = (val: number): string => {
    return val.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

// Helper to calculate remaining quantity
const getRemainingQty = (trade: Trades): number => {
    return Number(trade.quantity) || 0;
};

// Helper to calculate initial quantity before scale-outs
const getInitialQty = (trade: Trades): number => {
    if (trade.openOtherDetails?.initialQty) {
        const initNum = Number(trade.openOtherDetails.initialQty);
        if (!isNaN(initNum) && initNum > 0) return initNum;
    }
    const closeEvents = trade.closeEvents || [];
    const soldQty = closeEvents.reduce(
        (sum, event) => sum + (Number(event.quantitySold) || Number((event as any).qty) || 0),
        0
    );
    return (Number(trade.quantity) || 0) + soldQty;
};

// Helper to calculate partial close total P/L
const getPartialClosesTotal = (trade: Trades): number => {
    const closeEvents = trade.closeEvents || [];
    return closeEvents.reduce((sum, event) => sum + (event.result || 0), 0);
};

export const OpenTradesTable = ({ trades }: OpenTradesTableProps) => {
    const dispatch = useAppDispatch();
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [tradeToDelete, setTradeToDelete] = useState<Trades | null>(null);
    const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
    const [openSheetTradeId, setOpenSheetTradeId] = useState<string | null>(null);
    const [openAdjustSheetTradeId, setOpenAdjustSheetTradeId] = useState<string | null>(null);
    const [deletingEventId, setDeletingEventId] = useState<string | null>(null);
    const { handleDeleteOpenTrade } = useDeleteOpenTrade();

    const symbols = [...new Set((trades || []).map((t) => t.symbolName).filter(Boolean))];
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

    const toggleExpanded = (tradeId: string) => {
        setExpandedTradeId(expandedTradeId === tradeId ? null : tradeId);
    };

    if (!trades || trades.length === 0) {
        return (
            <div className="border border-zinc-200/80 rounded-xl p-8 text-center text-zinc-500 bg-white shadow-xs">
                No open trades yet
            </div>
        );
    }

    // Header totals calculation
    const { totalUnrealizedPnL, totalPositionValue, totalPositionCost } = (trades || []).reduce(
        (acc, trade) => {
            const remainingQty = getRemainingQty(trade);
            const entryPrice = Number(trade.entryPrice) || 0;
            const currentPrice = prices[trade.symbolName] ?? null;
            const cost = entryPrice * remainingQty;
            acc.totalPositionCost += cost;

            if (currentPrice !== null && !isNaN(entryPrice) && entryPrice > 0 && remainingQty > 0) {
                const pnl = (currentPrice - entryPrice) * remainingQty * (trade.positionType === "buy" ? 1 : -1);
                acc.totalUnrealizedPnL += pnl;
                acc.totalPositionValue += currentPrice * remainingQty;
            } else {
                acc.totalPositionValue += cost;
            }
            return acc;
        },
        { totalUnrealizedPnL: 0, totalPositionValue: 0, totalPositionCost: 0 }
    );

    const totalROIPercent = totalPositionCost > 0 ? (totalUnrealizedPnL / totalPositionCost) * 100 : 0;

    return (
        <div className="flex flex-col gap-4 pt-4">
            {/* Header Cards (3 Modular Metrics Cards) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Card 1: Open Positions */}
                <div className="border border-zinc-200/80 rounded-xl p-4 bg-white shadow-xs hover:border-zinc-300 transition-colors">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Open Positions</p>
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200/60">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                            Active
                        </span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-2">
                        <p className="text-2xl font-bold text-zinc-800 font-mono tabular-nums">{trades.length}</p>
                        <div className="flex items-center gap-1 text-[11px] text-zinc-400 font-medium">
                            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin text-blue-500" : ""}`} />
                            <span>
                                {lastUpdated ? `Refreshed ${relativeTime}` : "Connecting..."}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Card 2: Total Position Value */}
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

                {/* Card 3: Total Unrealized P/L & Total ROI % */}
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

            {/* Trades List Table */}
            <div className="border border-zinc-200/80 rounded-xl bg-white overflow-hidden shadow-xs w-full max-w-none">
                {/* Header - Fixed 12 columns */}
                <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-zinc-50/80 border-b border-zinc-200 text-xs font-semibold uppercase tracking-wider text-zinc-500 w-full">
                    <div className="col-span-5 md:col-span-3">Symbol</div>
                    <div className="col-span-2 text-center hidden md:block">Entry Price</div>
                    <div className="col-span-2 text-center hidden md:block">Mark Price</div>
                    <div className="col-span-1 text-center hidden md:block">Qty</div>
                    <div className="col-span-4 md:col-span-2 text-center">Unreal. P&L (%)</div>
                    <div className="col-span-3 md:col-span-2 text-right">Actions</div>
                </div>

                {/* Body - Scrollable */}
                <div className="max-h-[65vh] overflow-y-auto divide-y divide-zinc-100 w-full">
                    {trades.map((trade) => {
                        const closeEvents = trade.closeEvents || [];
                        const hasPartials = closeEvents.length > 0;
                        const isExpanded = expandedTradeId === trade.id;
                        const remainingQty = getRemainingQty(trade);
                        const partialTotal = getPartialClosesTotal(trade);

                        const entryPrice = Number(trade.entryPrice);
                        const currentPrice = prices[trade.symbolName] ?? null;

                        let pnl: number | null = null;
                        let pnlPercent: number | null = null;

                        if (currentPrice !== null && !isNaN(entryPrice) && entryPrice > 0 && remainingQty > 0) {
                            const isBuy = trade.positionType === "buy";
                            pnl = (currentPrice - entryPrice) * remainingQty * (isBuy ? 1 : -1);
                            pnlPercent = ((currentPrice - entryPrice) / entryPrice) * 100 * (isBuy ? 1 : -1);
                        }

                        return (
                            <div key={trade.id} className="hover:bg-zinc-50/80 transition-colors w-full">
                                {/* Main Row */}
                                <div
                                    className={`grid grid-cols-12 gap-2 px-4 py-3.5 items-center w-full ${hasPartials ? "cursor-pointer" : ""}`}
                                    onClick={() => hasPartials && toggleExpanded(trade.id)}
                                >
                                    {/* Symbol & Type */}
                                    <div className="col-span-5 md:col-span-3 flex items-center gap-2">
                                        {hasPartials && (
                                            <button className="shrink-0 text-zinc-400 hover:text-zinc-600 transition-colors">
                                                {isExpanded ? (
                                                    <ChevronDown className="w-4 h-4" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4" />
                                                )}
                                            </button>
                                        )}
                                        {trade.positionType === "buy" ? (
                                            <span className="border border-emerald-300 text-emerald-700 bg-emerald-50 text-[11px] font-mono font-bold w-5 h-5 flex items-center justify-center rounded shrink-0">
                                                L
                                            </span>
                                        ) : (
                                            <span className="border border-rose-300 text-rose-700 bg-rose-50 text-[11px] font-mono font-bold w-5 h-5 flex items-center justify-center rounded shrink-0">
                                                S
                                            </span>
                                        )}
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1.5">
                                                <span className="font-bold text-sm text-zinc-800 tracking-tight whitespace-nowrap">
                                                    {trade.symbolName}
                                                </span>
                                                {hasPartials && remainingQty !== Number(trade.quantity) && (
                                                    <span className="border border-amber-300 text-amber-700 bg-amber-50 text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold shrink-0">
                                                        Partial
                                                    </span>
                                                )}
                                            </div>
                                            <span className="text-[11px] text-zinc-400 font-medium md:hidden">
                                                {new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short" }).format(new Date(trade.openDate))}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Entry Price */}
                                    <div className="col-span-2 hidden md:block text-center text-sm font-mono tabular-nums text-zinc-700">
                                        ${formatPrice(trade.entryPrice || "")}
                                    </div>

                                    {/* Mark Price */}
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

                                    {/* Quantity */}
                                    <div className="col-span-1 hidden md:block text-center text-sm font-mono tabular-nums text-zinc-600">
                                        {hasPartials ? (
                                            <span className="text-amber-600 font-medium">
                                                {formatQty(remainingQty)} / {formatQty(getInitialQty(trade))}
                                            </span>
                                        ) : (
                                            formatQty(trade.quantity || "")
                                        )}
                                    </div>

                                    {/* Unrealized P&L & ROI % */}
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

                                    {/* Actions */}
                                    <div className="col-span-3 md:col-span-2 flex items-center justify-end gap-1 shrink-0 pl-2" onClick={(e) => e.stopPropagation()}>
                                        {/* Notes Manager */}
                                        <HoverCard openDelay={200}>
                                            <HoverCardTrigger asChild>
                                                <div>
                                                    <EditTrade
                                                        existingTrade={trade}
                                                        initialTab="notes"
                                                        trigger={
                                                            <button
                                                                className={`p-1.5 rounded transition-colors relative ${
                                                                    trade.notes && parseTradeNotes(trade.notes, trade.openDate, trade.id).length > 0
                                                                        ? "text-orange-600 bg-orange-50 hover:bg-orange-100 hover:text-orange-700"
                                                                        : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
                                                                }`}
                                                                title="Trade Notes"
                                                            >
                                                                <BookOpen className="w-4 h-4" />
                                                                {trade.notes && parseTradeNotes(trade.notes, trade.openDate, trade.id).length > 0 && (
                                                                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-orange-500 border border-white" />
                                                                )}
                                                            </button>
                                                        }
                                                    />
                                                </div>
                                            </HoverCardTrigger>
                                            {trade.notes && parseTradeNotes(trade.notes, trade.openDate, trade.id).length > 0 && (
                                                <HoverCardContent className="w-80 p-3" align="end">
                                                    <div className="space-y-2">
                                                        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">Trade Note History</h4>
                                                        <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                                                            {parseTradeNotes(trade.notes, trade.openDate, trade.id).map((note) => (
                                                                <div key={note.id} className="text-xs border-b border-zinc-100 pb-1.5 last:border-0 last:pb-0">
                                                                    <div className="flex justify-between items-center mb-0.5">
                                                                        <span className="font-semibold text-zinc-700 capitalize text-[10px]">
                                                                            {note.category || 'general'}
                                                                        </span>
                                                                        <span className="text-[9px] text-zinc-400">
                                                                            {dayjs(note.createdAt).format("DD MMM YYYY")}
                                                                        </span>
                                                                    </div>
                                                                    <p className="text-zinc-600 line-clamp-2 leading-normal">{note.text}</p>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                </HoverCardContent>
                                            )}
                                        </HoverCard>

                                        {/* Custom Fields */}
                                        {trade.openOtherDetails && Object.keys(trade.openOtherDetails).length > 0 && (
                                            <HoverCard>
                                                <HoverCardTrigger className="p-1.5 rounded hover:bg-zinc-100 transition-colors">
                                                    <svg className="w-4 h-4 text-zinc-400 hover:text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <rect x="3" y="3" width="18" height="18" rx="2" />
                                                        <line x1="9" y1="9" x2="15" y2="9" />
                                                        <line x1="9" y1="13" x2="15" y2="13" />
                                                        <line x1="9" y1="17" x2="12" y2="17" />
                                                    </svg>
                                                </HoverCardTrigger>
                                                <HoverCardContent className="w-64">
                                                    <h4 className="text-xs font-medium text-zinc-500 uppercase mb-2">Custom Details</h4>
                                                    <div className="space-y-1">
                                                        {Object.entries(trade.openOtherDetails).map(([key, value]) => (
                                                            <div key={key} className="flex justify-between text-sm">
                                                                <span className="text-zinc-500">{key}:</span>
                                                                <span className="text-zinc-700 font-medium">{value}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </HoverCardContent>
                                            </HoverCard>
                                        )}

                                        {/* Delete */}
                                        <button
                                            onClick={() => {
                                                setTradeToDelete(trade);
                                                setDeleteDialogOpen(true);
                                            }}
                                            className="p-1.5 rounded hover:bg-red-50 transition-colors"
                                            title="Delete Trade"
                                        >
                                            <Trash2 className="w-4 h-4 text-zinc-400 hover:text-red-500" />
                                        </button>

                                        {/* Divider */}
                                        <div className="w-px h-4 bg-zinc-200 mx-0.5" />

                                        {/* Adjust Position */}
                                        <Sheet 
                                            open={openAdjustSheetTradeId === trade.id} 
                                            onOpenChange={(open) => setOpenAdjustSheetTradeId(open ? trade.id : null)}
                                        >
                                            <SheetTrigger asChild>
                                                <button
                                                    className="p-1.5 rounded hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors shrink-0"
                                                    title="Adjust Position"
                                                >
                                                    <RefreshCw className="w-4 h-4" />
                                                </button>
                                            </SheetTrigger>
                                            <SheetContent>
                                                <TradeDialog
                                                    editMode={true}
                                                    existingTrade={trade}
                                                    initialTab="adjust-position"
                                                    onRequestClose={() => setOpenAdjustSheetTradeId(null)}
                                                />
                                            </SheetContent>
                                        </Sheet>

                                        {/* Close Position */}
                                        <Sheet 
                                            open={openSheetTradeId === trade.id} 
                                            onOpenChange={(open) => setOpenSheetTradeId(open ? trade.id : null)}
                                        >
                                            <SheetTrigger asChild>
                                                <button
                                                    className="p-1.5 rounded hover:bg-rose-50 text-rose-500 hover:text-rose-600 transition-colors shrink-0"
                                                    title="Close Position"
                                                >
                                                    <XCircle className="w-4 h-4" />
                                                </button>
                                            </SheetTrigger>
                                            <SheetContent>
                                                <TradeDialog
                                                    editMode={true}
                                                    existingTrade={trade}
                                                    initialTab="close-details"
                                                    onRequestClose={() => setOpenSheetTradeId(null)}
                                                />
                                            </SheetContent>
                                        </Sheet>
                                    </div>
                                </div>

                                {/* Expanded Position History Section */}
                                {hasPartials && isExpanded && (
                                    <div className="bg-zinc-50/90 border-t border-zinc-100 px-4 py-3">
                                        <div className="flex items-center justify-between mb-2">
                                            <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider">
                                                Position History ({closeEvents.length} {closeEvents.length === 1 ? 'event' : 'events'})
                                            </h4>
                                            <span className={`text-xs font-bold font-mono tabular-nums ${partialTotal >= 0 ? 'text-buy' : 'text-sell'}`}>
                                                Net Realized P/L: {partialTotal >= 0 ? '+' : ''}${formatCurrency(partialTotal)}
                                            </span>
                                        </div>
                                        <div className="space-y-1.5">
                                            {(() => {
                                                const initialQty = Number(trade.openOtherDetails?.initialQty) || Number(trade.quantity) || 0;
                                                const initialPrice = Number(trade.openOtherDetails?.initialEntryPrice) || Number(trade.entryPrice) || 0;
                                                let runningQty = initialQty;
                                                let runningPrice = initialPrice;

                                                return closeEvents.map((event: CloseEvent, index: number) => {
                                                    const qChange = event.quantityChange !== undefined ? event.quantityChange : (event.quantitySold !== undefined ? -event.quantitySold : 0);
                                                    const eventPrice = event.price !== undefined ? event.price : (event.sellPrice !== undefined ? event.sellPrice : 0);
                                                    const isScaleIn = qChange > 0;

                                                    if (isScaleIn) {
                                                        const newQty = runningQty + qChange;
                                                        runningPrice = newQty > 0 ? (runningPrice * runningQty + eventPrice * qChange) / newQty : runningPrice;
                                                        runningQty = newQty;
                                                    } else {
                                                        runningQty = runningQty + qChange;
                                                    }

                                                    return (
                                                        <div 
                                                            key={event.id || index}
                                                            className="grid grid-cols-12 gap-2 py-2 text-xs font-mono tabular-nums bg-white rounded-lg px-3 border border-zinc-200/70 items-center"
                                                        >
                                                            {/* Date & Time */}
                                                            <div className="col-span-3 text-zinc-600 font-sans">
                                                                {new Intl.DateTimeFormat("en-GB", {
                                                                    day: "2-digit",
                                                                    month: "short",
                                                                }).format(new Date(event.date))}
                                                                <span className="ml-1 text-[11px] text-zinc-400 font-mono">{event.time}</span>
                                                            </div>

                                                            {/* Price */}
                                                            <div className="col-span-3 text-zinc-700">
                                                                <span className="text-zinc-400">@ </span>
                                                                ${formatPrice(eventPrice)}
                                                            </div>

                                                            {/* Qty Change */}
                                                            <div className="col-span-3">
                                                                {isScaleIn ? (
                                                                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200/50">
                                                                        +{formatQty(qChange)} (Add)
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200/50">
                                                                        {formatQty(qChange)} (Reduce)
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Result or Avg Price + Delete */}
                                                            <div className="col-span-3 flex items-center gap-1.5 justify-end font-semibold">
                                                                {isScaleIn ? (
                                                                    <span className="text-xs text-zinc-500 font-medium">
                                                                        Avg: ${formatPrice(runningPrice)}
                                                                    </span>
                                                                ) : event.result !== undefined && event.result !== 0 ? (
                                                                    <>
                                                                        {event.result >= 0 ? (
                                                                            <FaArrowTrendUp className="text-buy text-xs" />
                                                                        ) : (
                                                                            <FaArrowTrendDown className="text-sell text-xs" />
                                                                        )}
                                                                        <span className={event.result >= 0 ? "text-buy" : "text-sell"}>
                                                                            {event.result >= 0 ? "+" : ""}
                                                                            ${formatCurrency(event.result)}
                                                                        </span>
                                                                    </>
                                                                ) : (
                                                                    <span className="text-zinc-300">—</span>
                                                                )}
                                                                {event.id && (
                                                                    <button
                                                                        type="button"
                                                                        disabled={deletingEventId === event.id}
                                                                        onClick={async (e) => {
                                                                            e.stopPropagation();
                                                                            if (!event.id) return;
                                                                            setDeletingEventId(event.id);
                                                                            try {
                                                                                const res = await deletePositionEvent(trade.id, event.id);
                                                                                if (res?.updatedTrade) {
                                                                                    dispatch(updateTradeInList(res.updatedTrade));
                                                                                    dispatch(updateTradeInFilteredList(res.updatedTrade));
                                                                                    toast.success("Position event deleted successfully!");
                                                                                }
                                                                            } catch {
                                                                                toast.error("Failed to delete position event.");
                                                                            } finally {
                                                                                setDeletingEventId(null);
                                                                            }
                                                                        }}
                                                                        className="p-1 rounded text-zinc-300 hover:text-rose-600 hover:bg-rose-50 transition-colors shrink-0"
                                                                        title="Delete this position event"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                });
                                            })()}
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Delete Trade Confirmation Dialog */}
            <DeleteTradeDialog
                isOpen={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                symbolName={tradeToDelete?.symbolName}
                message={`Are you sure you want to delete open position for "${tradeToDelete?.symbolName || ""}"?`}
                onConfirm={async () => {
                    if (!tradeToDelete) return;
                    await handleDeleteOpenTrade(tradeToDelete.id);
                    setDeleteDialogOpen(false);
                    setTradeToDelete(null);
                }}
            />
        </div>
    );
};

export default OpenTradesTable;
