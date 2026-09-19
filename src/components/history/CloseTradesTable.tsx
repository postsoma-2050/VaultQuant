"use client";

import { useState } from "react";
import { MdStar } from "react-icons/md";
import { FaArrowTrendDown, FaArrowTrendUp } from "react-icons/fa6";
import { BookOpen, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";

import { Trades } from "@/types";
import { CloseEvent } from "@/types/dbSchema.types";
import { FollowedStrategyPie } from "@/components/history/FollowedStrategyPie";
import EditTrade from "@/components/history/EditTrade";
import { useDeleteTrade } from "@/hooks/useDeleteTrade";
import { useAppSelector } from "@/redux/store";
import { parseTradeNotes } from "@/lib/tradeNotes";
import dayjs from "dayjs";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import DeleteTradeDialog from "@/components/history/DeleteTradeDialog";
import { StrategyRules } from "@/components/trade-dialog/StrategyRules";

type ClosedTrade = Trades & {
    closeDate: string;
    closeTime: string;
    result: string;
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

const getHoldDuration = (openDateStr?: string, closeDateStr?: string): string => {
    if (!openDateStr || !closeDateStr) return "";
    const open = dayjs(openDateStr);
    const close = dayjs(closeDateStr);
    if (!open.isValid() || !close.isValid()) return "";

    const diffDays = close.diff(open, "day");
    if (diffDays === 0) {
        const diffHours = close.diff(open, "hour");
        if (diffHours === 0) return "< 1 hr";
        return `${diffHours} ${diffHours === 1 ? "hr" : "hrs"}`;
    }
    return `${diffDays} ${diffDays === 1 ? "day" : "days"}`;
};

type CloseTradesTableProps = {
    trades: ClosedTrade[];
    total: number;
};

export const CloseTradesTable = ({
    trades,
}: CloseTradesTableProps) => {
    const [strategyDialogOpen, setStrategyDialogOpen] = useState(false);
    const [selectedTrade, setSelectedTrade] = useState<ClosedTrade | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [tradeToDelete, setTradeToDelete] = useState<ClosedTrade | null>(null);
    const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);

    const { strategies: localStrategies } = useAppSelector(
        (state) => state.strategies
    );
    const { handleDeleteTradeRecord } = useDeleteTrade();

    const handleCountPercentage = (trade: ClosedTrade) => {
        const appliedCloseRules = trade.appliedCloseRules || [];
        const appliedOpenRules = trade.appliedOpenRules || [];
        const strategy = localStrategies.find((s) => s.id === trade.strategyId);
        const totalCloseRulesOverall = strategy?.closePositionRules.length || 0;
        const totalOpenRulesOverall = strategy?.openPositionRules.length || 0;
        const totalRulesOverall = totalCloseRulesOverall + totalOpenRulesOverall;
        const totalRulesFollowed = appliedCloseRules.length + appliedOpenRules.length;
        if (totalRulesOverall === 0) return 0;
        return (totalRulesFollowed / totalRulesOverall) * 100;
    };

    const handleStrategyClick = (trade: ClosedTrade) => {
        setSelectedTrade(trade);
        setStrategyDialogOpen(true);
    };

    const toggleExpanded = (tradeId: string) => {
        setExpandedTradeId((prev) => (prev === tradeId ? null : tradeId));
    };

    if (!trades || trades.length === 0) {
        return (
            <div className="border border-zinc-200/80 rounded-xl p-8 text-center text-zinc-500 bg-white shadow-xs">
                No closed trades yet
            </div>
        );
    }

    // Header totals calculation
    const { totalTrades, winCount, lossCount, netPnL, totalCost } = (trades || []).reduce(
        (acc, trade) => {
            acc.totalTrades += 1;
            const resultNum = Number(trade.result) || 0;
            acc.netPnL += resultNum;
            if (resultNum > 0) acc.winCount += 1;
            else if (resultNum < 0) acc.lossCount += 1;

            const entryPrice = Number(trade.entryPrice) || 0;
            const qty = Number(trade.quantitySold) || Number(trade.quantity) || 0;
            acc.totalCost += entryPrice * qty;

            return acc;
        },
        { totalTrades: 0, winCount: 0, lossCount: 0, netPnL: 0, totalCost: 0 }
    );

    const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;
    const totalROIPercent = totalCost > 0 ? (netPnL / totalCost) * 100 : 0;

    return (
        <div className="flex flex-col gap-4 pt-2 w-full max-w-none">
            {/* Header Cards (3 Modular Metrics Cards matching Open Positions) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                {/* Card 1: Closed Trades & Win/Loss Count */}
                <div className="border border-zinc-200/80 rounded-xl p-4 bg-white shadow-xs hover:border-zinc-300 transition-colors">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Closed Trades</p>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200/60 font-mono tabular-nums">
                            {winCount}W - {lossCount}L
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-zinc-800 font-mono tabular-nums mt-2">{totalTrades}</p>
                </div>

                {/* Card 2: Win Rate % */}
                <div className="border border-zinc-200/80 rounded-xl p-4 bg-white shadow-xs hover:border-zinc-300 transition-colors">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Win Rate</p>
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 font-mono tabular-nums">
                            {winCount} Winners
                        </span>
                    </div>
                    <p className="text-2xl font-bold text-zinc-800 font-mono tabular-nums mt-2">
                        {winRate.toFixed(1)}%
                    </p>
                </div>

                {/* Card 3: Net Realized P/L */}
                <div className="border border-zinc-200/80 rounded-xl p-4 bg-white shadow-xs hover:border-zinc-300 transition-colors">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Net Realized P/L</p>
                        <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border font-mono tabular-nums ${totalROIPercent >= 0 ? "bg-emerald-50 text-emerald-700 border-emerald-200/60" : "bg-rose-50 text-rose-700 border-rose-200/60"}`}>
                            ROI {totalROIPercent >= 0 ? "+" : ""}{totalROIPercent.toFixed(1)}%
                        </span>
                    </div>
                    <p className={`text-2xl font-bold font-mono tabular-nums mt-2 ${netPnL >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {netPnL >= 0 ? "+$" : "-$"}{Math.abs(netPnL).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </p>
                </div>
            </div>

            {/* Trades List Table */}
            <div className="border border-zinc-200/80 rounded-xl bg-white overflow-hidden shadow-xs w-full max-w-none">
                {/* Header - Fixed 12 columns */}
                <div className="grid grid-cols-12 gap-2 px-4 py-3 bg-zinc-50/80 border-b border-zinc-200 text-xs font-semibold uppercase tracking-wider text-zinc-500 w-full">
                    <div className="col-span-5 md:col-span-3">Symbol</div>
                    <div className="col-span-2 text-center hidden md:block">Open → Close</div>
                    <div className="col-span-2 text-center hidden md:block">Entry → Exit</div>
                    <div className="col-span-1 text-center hidden md:block">Qty</div>
                    <div className="col-span-4 md:col-span-2 text-center">Result (%)</div>
                    <div className="col-span-1 text-center hidden md:block">Rating</div>
                    <div className="col-span-3 md:col-span-1 text-right">Actions</div>
                </div>

                {/* Body - Scrollable */}
                <div className="max-h-[65vh] overflow-y-auto divide-y divide-zinc-100 w-full">
                    {trades.map((trade) => {
                        const closeEvents = trade.closeEvents || [];
                        const isNewSystem = !!(trade.openOtherDetails && typeof trade.openOtherDetails === "object" && "initialQty" in trade.openOtherDetails);
                        const hasPartials = isNewSystem ? closeEvents.length > 1 : closeEvents.length > 0;
                        const isExpanded = expandedTradeId === trade.id;

                        let totalQty = 0;
                        let totalResult = 0;
                        let avgSellPrice = 0;
                        let allCloseEvents: (CloseEvent & { isFinal?: boolean })[] = [];

                        if (isNewSystem) {
                            const sellEvents = closeEvents.filter(e => {
                                const qChange = e.quantityChange !== undefined ? e.quantityChange : (e.quantitySold !== undefined ? -e.quantitySold : 0);
                                return qChange < 0;
                            });
                            totalQty = sellEvents.reduce((sum, e) => sum + (e.quantitySold || 0), 0);
                            totalResult = Number(trade.result) || 0;
                            
                            if (totalQty > 0) {
                                const weightedSellSum = sellEvents.reduce((sum, e) => sum + ((e.price || e.sellPrice || 0) * (e.quantitySold || 0)), 0);
                                avgSellPrice = weightedSellSum / totalQty;
                            } else {
                                avgSellPrice = Number(trade.sellPrice) || 0;
                            }

                            allCloseEvents = closeEvents;
                        } else {
                            totalQty = Number(trade.quantitySold) || Number(trade.quantity) || 0;
                            totalResult = Number(trade.result) || 0;
                            avgSellPrice = Number(trade.sellPrice) || 0;
                            const finalResult = trade.result !== undefined ? Number(trade.result) : 0;
                            allCloseEvents = closeEvents.length > 0 ? [
                                ...closeEvents,
                                {
                                    id: "final-close",
                                    date: trade.closeDate,
                                    time: trade.closeTime,
                                    quantitySold: totalQty,
                                    sellPrice: Number(trade.sellPrice) || 0,
                                    result: finalResult,
                                    isFinal: true,
                                }
                            ] : [];
                        }

                        const entryPriceNum = Number(trade.entryPrice) || 0;
                        const exitPriceNum = avgSellPrice || Number(trade.sellPrice) || 0;
                        
                        let tradeROIPercent: number | null = null;
                        if (entryPriceNum > 0) {
                            const isBuy = trade.positionType === "buy";
                            tradeROIPercent = ((exitPriceNum - entryPriceNum) / entryPriceNum) * 100 * (isBuy ? 1 : -1);
                        }

                        const holdDuration = getHoldDuration(trade.openDate, trade.closeDate);

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
                                                {hasPartials && (
                                                    <span className="border border-amber-300 text-amber-700 bg-amber-50 text-[10px] font-mono px-1.5 py-0.2 rounded font-semibold shrink-0">
                                                        Partial
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Open → Close Date & Hold Duration */}
                                    <div className="col-span-2 hidden md:flex flex-col items-center justify-center text-xs">
                                        <div className="flex items-center gap-1 font-mono tabular-nums text-zinc-600">
                                            <span>
                                                {new Intl.DateTimeFormat("en-GB", {
                                                    day: "2-digit",
                                                    month: "short",
                                                }).format(new Date(trade.openDate))}
                                            </span>
                                            <span className="text-zinc-300">→</span>
                                            <span>
                                                {new Intl.DateTimeFormat("en-GB", {
                                                    day: "2-digit",
                                                    month: "short",
                                                }).format(new Date(trade.closeDate))}
                                            </span>
                                        </div>
                                        {holdDuration && (
                                            <span className="text-[10px] font-mono font-semibold text-zinc-500 mt-0.5 bg-zinc-100 px-1.5 py-0.2 rounded">
                                                {holdDuration}
                                            </span>
                                        )}
                                    </div>

                                    {/* Entry → Exit Price */}
                                    <div className="col-span-2 hidden md:flex items-center justify-center gap-1 text-sm font-mono tabular-nums text-zinc-700">
                                        <span>${formatPrice(trade.entryPrice || "")}</span>
                                        <span className="text-zinc-300">→</span>
                                        {hasPartials ? (
                                            <span className="flex items-center gap-1">
                                                ${formatPrice(avgSellPrice)}
                                                <span className="text-[9px] px-1 rounded bg-amber-100 text-amber-800 font-mono font-semibold uppercase shrink-0">avg</span>
                                            </span>
                                        ) : (
                                            <span>${formatPrice(trade.sellPrice || "")}</span>
                                        )}
                                    </div>

                                    {/* Quantity */}
                                    <div className="col-span-1 hidden md:block text-center text-sm font-mono tabular-nums text-zinc-600">
                                        {formatQty(totalQty)}
                                    </div>

                                    {/* Result & P&L % */}
                                    <div className="col-span-4 md:col-span-2 text-center text-sm font-mono tabular-nums">
                                        <div className="flex flex-col items-center justify-center">
                                            <div className="flex items-center gap-1 font-bold">
                                                {totalResult >= 0 ? (
                                                    <FaArrowTrendUp className="text-emerald-600 text-xs" />
                                                ) : (
                                                    <FaArrowTrendDown className="text-rose-600 text-xs" />
                                                )}
                                                <span className={totalResult >= 0 ? "text-emerald-600" : "text-rose-600"}>
                                                    {totalResult >= 0 ? "+" : ""}
                                                    ${formatCurrency(totalResult)}
                                                </span>
                                            </div>
                                            {tradeROIPercent !== null && (
                                                <span className={`text-[11px] font-semibold px-1.5 py-0.2 rounded mt-0.5 ${
                                                    totalResult >= 0 
                                                        ? "text-emerald-700 bg-emerald-50 border border-emerald-200/60" 
                                                        : "text-rose-700 bg-rose-50 border border-rose-200/60"
                                                }`}>
                                                    {tradeROIPercent >= 0 ? "+" : ""}{tradeROIPercent.toFixed(2)}%
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Rating */}
                                    <div className="col-span-1 hidden md:flex justify-center items-center">
                                        {trade.rating && trade.rating > 0 ? (
                                            <div className="flex items-center gap-1 bg-amber-50 border border-amber-200/60 px-1.5 py-0.5 rounded text-xs font-mono tabular-nums">
                                                <MdStar className="text-amber-500 text-sm" />
                                                <span className="font-semibold text-zinc-700">{trade.rating}</span>
                                            </div>
                                        ) : (
                                            <span className="text-zinc-300">—</span>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="col-span-3 md:col-span-1 flex items-center justify-end gap-1 shrink-0 pl-2" onClick={(e) => e.stopPropagation()}>
                                        {/* Strategy */}
                                        {trade.strategyId && (
                                            <button
                                                onClick={() => handleStrategyClick(trade)}
                                                className="hidden md:block p-1.5 rounded hover:bg-zinc-100 transition-colors shrink-0"
                                                title="Strategy Rules"
                                            >
                                                <FollowedStrategyPie
                                                    percentage={handleCountPercentage(trade)}
                                                />
                                            </button>
                                        )}
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
                                                                        <span className="text-[9px] text-zinc-400 font-mono">
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
                                        {((trade.openOtherDetails && Object.keys(trade.openOtherDetails).length > 0) ||
                                          (trade.closeOtherDetails && Object.keys(trade.closeOtherDetails).length > 0)) && (
                                            <HoverCard>
                                                <HoverCardTrigger className="p-1.5 rounded hover:bg-zinc-100 transition-colors">
                                                    <svg className="w-4 h-4 text-zinc-400 hover:text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                        <rect x="3" y="3" width="18" height="18" rx="2" />
                                                        <line x1="9" y1="9" x2="15" y2="9" />
                                                        <line x1="9" y1="13" x2="15" y2="13" />
                                                        <line x1="9" y1="17" x2="12" y2="17" />
                                                    </svg>
                                                </HoverCardTrigger>
                                                <HoverCardContent className="w-72">
                                                    <div className="space-y-3">
                                                        {trade.openOtherDetails && Object.keys(trade.openOtherDetails).length > 0 && (
                                                            <div>
                                                                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Open Details</h4>
                                                                <div className="space-y-1 font-mono text-xs">
                                                                    {Object.entries(trade.openOtherDetails).map(([key, value]) => (
                                                                        <div key={key} className="flex justify-between">
                                                                            <span className="text-zinc-500 font-sans">{key}:</span>
                                                                            <span className="text-zinc-700 font-medium">{value}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                        {trade.closeOtherDetails && Object.keys(trade.closeOtherDetails).length > 0 && (
                                                            <div>
                                                                <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-1">Close Details</h4>
                                                                <div className="space-y-1 font-mono text-xs">
                                                                    {Object.entries(trade.closeOtherDetails).map(([key, value]) => (
                                                                        <div key={key} className="flex justify-between">
                                                                            <span className="text-zinc-500 font-sans">{key}:</span>
                                                                            <span className="text-zinc-700 font-medium">{value}</span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </HoverCardContent>
                                            </HoverCard>
                                        )}

                                        {/* Edit */}
                                        <EditTrade
                                            existingTrade={trade}
                                            initialTab="close-details"
                                            trigger={
                                                <button className="p-1.5 rounded hover:bg-zinc-100 transition-colors" title="Edit Trade">
                                                    <Pencil className="w-4 h-4 text-zinc-400 hover:text-zinc-600" />
                                                </button>
                                            }
                                        />

                                        {/* Delete */}
                                        <button
                                            onClick={() => {
                                                setTradeToDelete(trade);
                                                setDeleteDialogOpen(true);
                                            }}
                                            className="p-1.5 rounded hover:bg-rose-50 transition-colors"
                                            title="Delete Trade"
                                        >
                                            <Trash2 className="w-4 h-4 text-zinc-400 hover:text-rose-500" />
                                        </button>
                                    </div>
                                </div>

                                {/* Expanded Position History Section */}
                                {hasPartials && isExpanded && (
                                    <div className="bg-zinc-50/90 border-t border-zinc-100 px-4 py-3">
                                        <h4 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
                                            Position History ({allCloseEvents.length} {allCloseEvents.length === 1 ? 'event' : 'events'})
                                        </h4>
                                        <div className="space-y-1.5">
                                            {(() => {
                                                const initialQty = Number(trade.openOtherDetails?.initialQty) || Number(trade.quantity) || 0;
                                                const initialPrice = Number(trade.openOtherDetails?.initialEntryPrice) || Number(trade.entryPrice) || 0;
                                                let runningQty = initialQty;
                                                let runningPrice = initialPrice;

                                                return allCloseEvents.map((event, index: number) => {
                                                    const qChange = event.quantityChange !== undefined 
                                                        ? event.quantityChange 
                                                        : (event.quantitySold !== undefined ? -event.quantitySold : 0);
                                                    const isScaleIn = qChange > 0;
                                                    const displayPrice = event.price !== undefined ? event.price : (event.sellPrice !== undefined ? event.sellPrice : 0);

                                                    if (isScaleIn) {
                                                        const newQty = runningQty + qChange;
                                                        runningPrice = newQty > 0 ? (runningPrice * runningQty + displayPrice * qChange) / newQty : runningPrice;
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
                                                            <div className="col-span-3 flex items-center gap-1.5 text-zinc-600 font-sans">
                                                                {new Intl.DateTimeFormat("en-GB", {
                                                                    day: "2-digit",
                                                                    month: "short",
                                                                }).format(new Date(event.date))}
                                                                <span className="text-[11px] text-zinc-400 font-mono">{event.time}</span>
                                                                {('isFinal' in event && event.isFinal) && (
                                                                    <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-100 text-emerald-700 font-semibold">
                                                                        Final
                                                                    </span>
                                                                )}
                                                            </div>

                                                            {/* Price */}
                                                            <div className="col-span-3 text-zinc-700">
                                                                <span className="text-zinc-400">@ </span>
                                                                ${formatPrice(displayPrice)}
                                                            </div>

                                                            {/* Qty Change */}
                                                            <div className="col-span-3 font-sans">
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

                                                            {/* Result or Avg Price */}
                                                            <div className="col-span-3 flex items-center gap-1 justify-end font-semibold">
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

            {/* Strategy Rules Dialog */}
            <Dialog open={strategyDialogOpen} onOpenChange={setStrategyDialogOpen}>
                <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            Applied Strategy Rules -{" "}
                            {selectedTrade &&
                                localStrategies.find(
                                    (s) => s.id === selectedTrade.strategyId
                                )?.strategyName}
                        </DialogTitle>
                    </DialogHeader>
                    {selectedTrade && selectedTrade.strategyId && (
                        <StrategyRules
                            strategy={
                                localStrategies.find(
                                    (s) => s.id === selectedTrade.strategyId
                                )!
                            }
                            checkedOpenRules={
                                selectedTrade.appliedOpenRules?.map((rule) => rule.id) || []
                            }
                            checkedCloseRules={
                                selectedTrade.appliedCloseRules?.map((rule) => rule.id) || []
                            }
                            onOpenRuleToggle={() => {}}
                            onCloseRuleToggle={() => {}}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete Trade Confirmation Dialog */}
            <DeleteTradeDialog
                isOpen={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
                symbolName={tradeToDelete?.symbolName}
                message={`Are you sure you want to delete "${tradeToDelete?.symbolName || ""}" (${tradeToDelete?.quantity || 0} shares)?`}
                onConfirm={async () => {
                    if (!tradeToDelete) return;
                    await handleDeleteTradeRecord(
                        tradeToDelete.id,
                        tradeToDelete.result || "0",
                        tradeToDelete.closeDate || ""
                    );
                    setTradeToDelete(null);
                }}
            />
        </div>
    );
};

export default CloseTradesTable;
