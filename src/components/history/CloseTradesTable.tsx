"use client";

import { useState } from "react";
import { MdStar } from "react-icons/md";
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
import StrategyRules from "@/components/strategies/StrategyRules";

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
    total?: number;
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
            <div className="border border-zinc-200 rounded-lg p-8 text-center text-zinc-500 bg-white">
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
        <div className="flex flex-col gap-4 pt-2 w-full min-w-0 max-w-none">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                <div className="border border-zinc-200 rounded-lg p-4 bg-white">
                    <div className="flex items-center justify-between">
                        <p className="text-[13px] font-medium text-zinc-500">Closed Trades</p>
                        <span className="text-xs font-medium font-mono tabular-nums text-zinc-500">
                            {winCount}W - {lossCount}L
                        </span>
                    </div>
                    <p className="text-2xl font-semibold text-zinc-900 font-mono tabular-nums mt-1.5">{totalTrades}</p>
                </div>

                <div className="border border-zinc-200 rounded-lg p-4 bg-white">
                    <div className="flex items-center justify-between">
                        <p className="text-[13px] font-medium text-zinc-500">Win Rate</p>
                        <span className="text-xs font-medium text-emerald-700 tabular-nums">
                            {winCount} Winners
                        </span>
                    </div>
                    <p className="text-2xl font-semibold text-zinc-900 font-mono tabular-nums mt-1.5">
                        {winRate.toFixed(1)}%
                    </p>
                </div>

                <div className="border border-zinc-200 rounded-lg p-4 bg-white">
                    <div className="flex items-center justify-between">
                        <p className="text-[13px] font-medium text-zinc-500">Net Realized P/L</p>
                        <span className={`text-xs font-medium font-mono tabular-nums ${totalROIPercent >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                            {totalROIPercent >= 0 ? "+" : ""}{totalROIPercent.toFixed(2)}%
                        </span>
                    </div>
                    <p className={`text-2xl font-semibold font-mono tabular-nums mt-1.5 ${netPnL >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {formatCurrency(netPnL, true)}
                    </p>
                </div>
            </div>

            <div className="border border-zinc-200 rounded-lg bg-white overflow-hidden w-full min-w-0 max-w-none">
                <div className="grid grid-cols-20 gap-2 px-3 py-2.5 bg-zinc-50 border-b border-zinc-200 text-xs font-medium text-zinc-500 w-full">
                    <div className="col-span-9 xl:col-span-4">Symbol</div>
                    <div className="col-span-3 text-center hidden xl:block">Open → Close</div>
                    <div className="col-span-3 text-center hidden xl:block">Entry → Exit</div>
                    <div className="col-span-2 text-right pr-3 hidden xl:block">Qty</div>
                    <div className="col-span-6 xl:col-span-3 text-right pr-3">Result (%)</div>
                    <div className="col-span-2 text-center hidden xl:block">Rating</div>
                    <div className="col-span-5 xl:col-span-3 text-right">Actions</div>
                </div>

                <div className="divide-y divide-zinc-100 w-full">
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
                                    className="grid grid-cols-20 gap-2 px-3 py-3 items-center w-full"
                                >
                                    <div className="col-span-9 xl:col-span-4 flex min-w-0 items-center gap-2">
                                        {hasPartials && (
                                            <button
                                                type="button"
                                                aria-expanded={isExpanded}
                                                aria-label={`${isExpanded ? "Collapse" : "Expand"} ${trade.symbolName} execution history`}
                                                onClick={() => toggleExpanded(trade.id)}
                                                className="shrink-0 rounded p-0.5 text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                                            >
                                                {isExpanded ? (
                                                    <ChevronDown className="w-4 h-4" aria-hidden="true" />
                                                ) : (
                                                    <ChevronRight className="w-4 h-4" aria-hidden="true" />
                                                )}
                                            </button>
                                        )}
                                        <span
                                            aria-label={trade.positionType === "buy" ? "Long" : "Short"}
                                            className={`font-mono text-xs font-semibold shrink-0 ${
                                                trade.positionType === "buy" ? "text-emerald-700" : "text-rose-700"
                                            }`}
                                        >
                                            {trade.positionType === "buy" ? "Long" : "Short"}
                                        </span>
                                        <div className="flex flex-col">
                                            <div className="flex items-center gap-1.5 min-w-0">
                                                <span className="font-semibold text-[13px] text-zinc-900 truncate">
                                                    {trade.symbolName}
                                                </span>
                                                {hasPartials && (
                                                    <span className="text-xs text-zinc-500 shrink-0">
                                                        Partial
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="col-span-3 hidden xl:flex flex-col items-center justify-center text-xs">
                                        <div className="flex items-center gap-1 font-mono tabular-nums text-zinc-600">
                                            <span>
                                                {new Intl.DateTimeFormat("en-US", {
                                                    day: "2-digit",
                                                    month: "short",
                                                }).format(new Date(trade.openDate))}
                                            </span>
                                            <span className="text-zinc-300">→</span>
                                            <span>
                                                {new Intl.DateTimeFormat("en-US", {
                                                    day: "2-digit",
                                                    month: "short",
                                                }).format(new Date(trade.closeDate))}
                                            </span>
                                        </div>
                                        {holdDuration && (
                                            <span className="text-xs font-mono text-zinc-500 mt-0.5">
                                                {holdDuration}
                                            </span>
                                        )}
                                    </div>

                                    <div className="col-span-3 hidden xl:flex items-center justify-center gap-1 text-[13px] font-mono tabular-nums text-zinc-700">
                                        <span>${formatPrice(trade.entryPrice || "")}</span>
                                        <span className="text-zinc-300">→</span>
                                        {hasPartials ? (
                                            <span className="flex items-center gap-1">
                                                ${formatPrice(avgSellPrice)}
                                                <span className="text-xs text-zinc-500">avg</span>
                                            </span>
                                        ) : (
                                            <span>${formatPrice(trade.sellPrice || "")}</span>
                                        )}
                                    </div>

                                    <div className="col-span-2 hidden xl:block text-right pr-3 text-[13px] font-mono tabular-nums text-zinc-600">
                                        {formatQty(totalQty)}
                                    </div>

                                    <div className="col-span-6 xl:col-span-3 text-right pr-3 text-[13px] font-mono tabular-nums">
                                        <div className="flex flex-col items-end justify-center">
                                            <span className={`font-semibold ${totalResult >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                                {formatCurrency(totalResult, true)}
                                            </span>
                                            {tradeROIPercent !== null && (
                                                <span className={`text-xs font-medium mt-0.5 ${
                                                    totalResult >= 0 
                                                        ? "text-emerald-700"
                                                        : "text-rose-700"
                                                }`}>
                                                    {tradeROIPercent >= 0 ? "+" : ""}{tradeROIPercent.toFixed(2)}%
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="col-span-2 hidden xl:flex justify-center items-center">
                                        {trade.rating && trade.rating > 0 ? (
                                            <div className="flex items-center gap-1 text-xs font-mono tabular-nums">
                                                <MdStar className="text-amber-500 text-sm" />
                                                <span className="font-semibold text-zinc-700">{trade.rating}</span>
                                            </div>
                                        ) : (
                                            <span className="text-zinc-300">—</span>
                                        )}
                                    </div>

                                    <div className="col-span-5 xl:col-span-3 flex items-center justify-end gap-0.5 shrink-0">
                                        {/* Strategy */}
                                        {trade.strategyId && (
                                            <button
                                                type="button"
                                                onClick={() => handleStrategyClick(trade)}
                                                className="hidden xl:block p-1.5 rounded hover:bg-zinc-100 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                                                aria-label={`View strategy rules for ${trade.symbolName}`}
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
                                                                type="button"
                                                                aria-label={`Edit notes for ${trade.symbolName}`}
                                                                className={`p-1.5 rounded transition-colors relative ${
                                                                    trade.notes && parseTradeNotes(trade.notes, trade.openDate, trade.id).length > 0
                                                                        ? "text-orange-600 bg-orange-50 hover:bg-orange-100 hover:text-orange-700"
                                                                        : "text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100"
                                                                }`}
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
                                                                        <span className="font-semibold text-zinc-700 capitalize text-xs">
                                                                            {note.category || 'general'}
                                                                        </span>
                                                                        <span className="text-xs text-zinc-500 font-mono">
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
                                                <HoverCardTrigger className="p-1.5 rounded hover:bg-zinc-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400" aria-label="View custom trade fields">
                                                    <svg className="w-4 h-4 text-zinc-400 hover:text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
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
                                                <button type="button" className="p-1.5 rounded hover:bg-zinc-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400" aria-label={`Edit ${trade.symbolName} trade`}>
                                                    <Pencil className="w-4 h-4 text-zinc-400 hover:text-zinc-600" />
                                                </button>
                                            }
                                        />

                                        {/* Delete */}
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setTradeToDelete(trade);
                                                setDeleteDialogOpen(true);
                                            }}
                                            className="p-1.5 rounded hover:bg-rose-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                                            aria-label={`Delete ${trade.symbolName} trade`}
                                        >
                                            <Trash2 className="w-4 h-4 text-zinc-400 hover:text-rose-500" />
                                        </button>
                                    </div>
                                </div>

                                {hasPartials && isExpanded && (
                                    <div className="bg-zinc-50 border-t border-zinc-100 px-3 py-3">
                                        <h4 className="text-xs font-medium text-zinc-500 mb-2">
                                            Execution history · {allCloseEvents.length} {allCloseEvents.length === 1 ? 'event' : 'events'}
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
                                                            className="grid grid-cols-12 gap-2 py-2 text-xs font-mono tabular-nums bg-white rounded-md px-3 border border-zinc-200 items-center"
                                                        >
                                                            <div className="col-span-3 flex items-center gap-1.5 text-zinc-600 font-sans">
                                                                {new Intl.DateTimeFormat("en-US", {
                                                                    day: "2-digit",
                                                                    month: "short",
                                                                }).format(new Date(event.date))}
                                                                <span className="text-xs text-zinc-500 font-mono">{event.time}</span>
                                                                {('isFinal' in event && event.isFinal) && (
                                                                    <span className="text-xs text-emerald-700 font-medium">
                                                                        Final
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="col-span-3 text-zinc-700">
                                                                <span className="text-zinc-400">@ </span>
                                                                ${formatPrice(displayPrice)}
                                                            </div>

                                                            <div className="col-span-3 font-sans">
                                                                {isScaleIn ? (
                                                                    <span className="text-xs font-medium text-emerald-700">
                                                                        +{formatQty(qChange)} (Add)
                                                                    </span>
                                                                ) : (
                                                                    <span className="text-xs font-medium text-amber-700">
                                                                        {formatQty(qChange)} (Reduce)
                                                                    </span>
                                                                )}
                                                            </div>

                                                            <div className="col-span-3 flex items-center gap-1 justify-end font-semibold">
                                                                {isScaleIn ? (
                                                                    <span className="text-xs text-zinc-500 font-medium">
                                                                        Avg: ${formatPrice(runningPrice)}
                                                                    </span>
                                                                ) : event.result !== undefined && event.result !== 0 ? (
                                                                    <span className={event.result >= 0 ? "text-emerald-600" : "text-rose-600"}>
                                                                        {formatCurrency(event.result, true)}
                                                                    </span>
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
                <DialogContent className="max-w-xl">
                    <DialogHeader>
                        <DialogTitle>
                            Applied Strategy Rules ·{" "}
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
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* Delete Trade Confirmation Dialog */}
            <DeleteTradeDialog
                isOpen={deleteDialogOpen}
                onOpenChange={(open) => {
                    setDeleteDialogOpen(open);
                    if (!open) setTradeToDelete(null);
                }}
                symbolName={tradeToDelete?.symbolName}
                message={`Are you sure you want to delete "${tradeToDelete?.symbolName || ""}" (${tradeToDelete?.quantity || 0} shares)?`}
                onConfirm={async () => {
                    if (!tradeToDelete) return false;
                    return handleDeleteTradeRecord(
                        tradeToDelete.id,
                        tradeToDelete.result || "0",
                        tradeToDelete.closeDate || ""
                    );
                }}
            />
        </div>
    );
};

export default CloseTradesTable;
