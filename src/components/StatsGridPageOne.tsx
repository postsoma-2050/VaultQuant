"use client";

import React, { useMemo } from "react";
import {
    ComposedChart,
    Area,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { Clock, Zap, Target } from "lucide-react";

interface GetOtherDataForGridPageOneResult {
    chartOne: {
        succesfullPositions: number;
        allPositions: number;
    };
    chartTwo: {
        succesfullBuyPositions: number;
        allBuyPositions: number;
    };
    chartThree: {
        succesfullSellPositions: number;
        allSellPositions: number;
    };
    chartFour: {
        allBuyPositions: number;
        averageBuyPositionsPerMonth: number;
    };
    chartFive: {
        allSellPositions: number;
        averageSellPositionsPerMonth: number;
    };
    chartSix: {
        averageTimeInBuyPosition: number;
        averageTimeInSellPosition: number;
    };
    chartSeven: {
        sequenceProfitable: number;
        sequenceLost: number;
    };
}

function formatSignedCurrency(value: number) {
    return `${value >= 0 ? "+" : "-"}$${Math.abs(value).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function formatAxisCurrency(value: number) {
    const formatted = Math.abs(value).toLocaleString("en-US");
    return `${value < 0 ? "-" : ""}$${formatted}`;
}

export function StatsGridPageOne({
    tradingData,
    otherData,
    scopeLabel = "All time",
}: {
    tradingData: { date: Date; capital: number; pnl?: number; symbolName?: string; sp500?: number }[];
    otherData: GetOtherDataForGridPageOneResult;
    scopeLabel?: string;
}) {
    // Enrich the already-scoped time-series data with drawdown metrics.
    const { chartPoints, maxDrawdownVal, maxDrawdownPct } = useMemo(() => {
        if (!tradingData || tradingData.length === 0) {
            return { chartPoints: [], maxDrawdownVal: 0, maxDrawdownPct: 0 };
        }

        let peak = 0;
        let maxDD = 0;
        let maxDDPct = 0;

        const points = tradingData.map((d, index) => {
            const currentCap = d.capital;
            if (index === 0 || currentCap > peak) {
                peak = currentCap;
            }

            const ddVal = currentCap - peak; // always <= 0
            const ddPct = peak > 0 ? (ddVal / peak) * 100 : 0;

            if (ddVal < maxDD) {
                maxDD = ddVal;
                maxDDPct = ddPct;
            }

            return {
                ...d,
                drawdown: ddVal,
                drawdownPctVal: ddPct,
                drawdownPct: ddPct.toFixed(1) + "%",
                formattedDate: d.date.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "2-digit"
                }),
            };
        });

        return {
            chartPoints: points,
            maxDrawdownVal: maxDD,
            maxDrawdownPct: maxDDPct,
        };
    }, [tradingData]);

    const periodPnl = useMemo(
        () => chartPoints.reduce((sum, point) => sum + (point.pnl ?? 0), 0),
        [chartPoints]
    );

    // Format hold times
    const formatDuration = (hours: number) => {
        if (!hours || hours <= 0) return "0h";
        if (hours >= 24) {
            return (hours / 24).toFixed(1) + "d";
        }
        return hours + "h";
    };

    // Render horizontal progress bar for win rate
    const renderProgressBar = (title: string, winRate: number, total: number) => {
        return (
            <div className="flex flex-col gap-2">
                <div className="flex justify-between items-baseline text-xs font-semibold">
                    <span className="text-zinc-500 font-semibold">{title}</span>
                    <span className="text-zinc-800 font-extrabold">{winRate}% <span className="text-[10px] text-zinc-400 font-normal">({total} trades)</span></span>
                </div>
                <div className="w-full flex h-2 rounded-full overflow-hidden bg-rose-500/10">
                    <div className="bg-emerald-500 h-full rounded-l-full transition-all duration-500" style={{ width: `${winRate}%` }} />
                    <div className="bg-rose-500 h-full rounded-r-full transition-all duration-500" style={{ width: `${100 - winRate}%` }} />
                </div>
            </div>
        );
    };

    interface TooltipPayloadData {
        formattedDate: string;
        capital: number;
        pnl?: number;
        pnlPercent?: number;
        sp500?: number;
        sp500Capital?: number;
        symbolName?: string;
        drawdown: number;
        drawdownPct: string;
    }

    // Custom recharts tooltip
    const CustomTooltip = ({
        active,
        payload,
    }: {
        active?: boolean;
        payload?: Array<{
            payload: TooltipPayloadData;
        }>;
    }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            const pnl = data.pnl ?? 0;
            const isPnlPositive = pnl >= 0;

            return (
                <div className="bg-white border border-zinc-200 p-4 rounded-xl shadow-lg text-xs flex flex-col gap-2 font-sans min-w-[180px]">
                    <p className="font-bold text-zinc-400">{data.formattedDate}</p>
                    <div className="flex items-center justify-between">
                        <span className="text-zinc-500 font-medium">Your Equity:</span>
                        <span className="font-extrabold text-zinc-900">${Math.round(data.capital).toLocaleString()}</span>
                    </div>
                    {data.sp500 !== undefined && (
                        <div className="flex items-center justify-between">
                            <span className="text-zinc-400 font-medium">S&P 500:</span>
                            <span className="font-semibold text-zinc-500">${Math.round(data.sp500).toLocaleString()}</span>
                        </div>
                    )}
                    <div className="flex items-center justify-between border-t border-zinc-100 pt-2">
                        <span className="text-zinc-500 font-medium">Trade P&L ({data.symbolName}):</span>
                        <span className={`font-extrabold ${isPnlPositive ? "text-emerald-600" : "text-rose-600"}`}>
                            {formatSignedCurrency(pnl)}
                        </span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-zinc-500 font-medium">Drawdown:</span>
                        <span className="font-bold text-rose-500">
                            {formatSignedCurrency(data.drawdown)} ({data.drawdownPct})
                        </span>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="flex min-w-0 flex-col gap-6 w-full mt-4">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-zinc-500">
                <span>
                    Scope <span className="font-medium text-zinc-800">{scopeLabel}</span>
                </span>
                <span>
                    Realized P&amp;L{" "}
                    <span className={`font-mono font-semibold tabular-nums ${periodPnl >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                        {formatSignedCurrency(periodPnl)}
                    </span>
                </span>
                <span>
                    Closed trades <span className="font-mono font-semibold text-zinc-800 tabular-nums">{otherData.chartOne.allPositions}</span>
                </span>
                <span>
                    Win rate <span className="font-mono font-semibold text-zinc-800 tabular-nums">{otherData.chartOne.succesfullPositions}%</span>
                </span>
            </div>

            {/* Top row: Equity chart + Win rate */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Equity Curve Panel */}
                <div className="lg:col-span-3 min-w-0 bg-white rounded-xl border border-zinc-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 flex flex-col gap-4">
                    <div className="flex flex-col justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div>
                                <h3 className="text-sm font-bold text-zinc-900">Equity Curve vs S&P 500</h3>
                                <p className="text-xs text-zinc-500">Benchmark comparison · {scopeLabel}</p>
                            </div>
                            {maxDrawdownPct < 0 && (
                                <span className="bg-rose-50 text-rose-600 border border-rose-100 px-2 py-0.5 rounded text-[11px] font-semibold">
                                    Max DD: {maxDrawdownPct.toFixed(1)}%
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Chart Frame */}
                    <div className="h-[clamp(260px,32vh,340px)] min-h-[260px] w-full min-w-0 mt-2">
                        {chartPoints.length === 0 ? (
                            <div className="h-full w-full flex items-center justify-center border border-dashed border-zinc-200 rounded-lg text-zinc-400 text-xs">
                                No trades recorded in this timeframe
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={chartPoints} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="colorEquity" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#E8472A" stopOpacity={0.1}/>
                                            <stop offset="95%" stopColor="#E8472A" stopOpacity={0.0}/>
                                        </linearGradient>
                                        <linearGradient id="colorDrawdown" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#EF4444" stopOpacity={0.08}/>
                                            <stop offset="95%" stopColor="#EF4444" stopOpacity={0.0}/>
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#F4F4F5" />
                                    <XAxis
                                        dataKey="formattedDate"
                                        stroke="#A1A1AA"
                                        fontSize={9}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        stroke="#A1A1AA"
                                        fontSize={9}
                                        tickLine={false}
                                        axisLine={false}
                                        domain={['auto', 'auto']}
                                        tickFormatter={formatAxisCurrency}
                                    />
                                    {/* Secondary hidden Y-Axis to cleanly position Drawdown shading at bottom */}
                                    <YAxis
                                        yAxisId="drawdown"
                                        hide
                                        domain={[(maxDrawdownVal * 1.5) || -1000, 0]}
                                    />
                                    <Tooltip content={<CustomTooltip />} />
                                    {/* Benchmark Line */}
                                    <Line
                                        type="monotone"
                                        dataKey="sp500"
                                        stroke="#E5E7EB"
                                        strokeWidth={1.5}
                                        dot={false}
                                        strokeDasharray="4 4"
                                    />
                                    {/* Drawdown shading */}
                                    <Area
                                        yAxisId="drawdown"
                                        type="monotone"
                                        dataKey="drawdown"
                                        fill="url(#colorDrawdown)"
                                        stroke="none"
                                    />
                                    {/* Main Equity Curve */}
                                    <Area
                                        type="monotone"
                                        dataKey="capital"
                                        fill="url(#colorEquity)"
                                        stroke="#E8472A"
                                        strokeWidth={2}
                                        dot={false}
                                    />
                                </ComposedChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>

                {/* Win Rate / Profitability Panel */}
                <div className="min-w-0 bg-white rounded-xl border border-zinc-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-6 flex flex-col justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-zinc-900">Win Rate / Performance</h3>
                        <p className="text-xs text-zinc-500">Closed trade profitability · {scopeLabel}</p>
                    </div>

                    <div className="flex flex-col gap-6 my-4">
                        {renderProgressBar(
                            "All positions",
                            otherData.chartOne.succesfullPositions,
                            otherData.chartOne.allPositions
                        )}
                        {renderProgressBar(
                            "Buy positions",
                            otherData.chartTwo.succesfullBuyPositions,
                            otherData.chartTwo.allBuyPositions
                        )}
                        {renderProgressBar(
                            "Sell positions",
                            otherData.chartThree.succesfullSellPositions,
                            otherData.chartThree.allSellPositions
                        )}
                    </div>

                    <div className="bg-zinc-50 border border-zinc-100 rounded-lg p-3 text-[11px] text-zinc-500">
                        Zero profit trades are included inside the loss cohort to establish strict profitability ratios.
                    </div>
                </div>
            </div>

            {/* Bottom Row: Redesigned Stat Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 w-full">
                {/* 1. Total Buy Positions */}
                <div className="bg-white rounded-xl border border-zinc-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 flex flex-col justify-between gap-2">
                    <div className="flex justify-between items-start">
                        <span className="text-xs text-zinc-500 font-semibold">Buy transactions</span>
                        <Target size={14} className="text-zinc-400" />
                    </div>
                    <div>
                        <span className="text-2xl font-extrabold text-zinc-900 tracking-tight">
                            {otherData.chartFour.allBuyPositions}
                        </span>
                        <p className="text-[10px] text-zinc-400 mt-1">
                            Avg/Month: <span className="font-bold text-zinc-700">{otherData.chartFour.averageBuyPositionsPerMonth}</span>
                        </p>
                    </div>
                </div>

                {/* 2. Total Sell Positions */}
                <div className="bg-white rounded-xl border border-zinc-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 flex flex-col justify-between gap-2">
                    <div className="flex justify-between items-start">
                        <span className="text-xs text-zinc-500 font-semibold">Sell transactions</span>
                        <Target size={14} className="text-zinc-400" />
                    </div>
                    <div>
                        <span className="text-2xl font-extrabold text-zinc-900 tracking-tight">
                            {otherData.chartFive.allSellPositions}
                        </span>
                        <p className="text-[10px] text-zinc-400 mt-1">
                            Avg/Month: <span className="font-bold text-zinc-700">{otherData.chartFive.averageSellPositionsPerMonth}</span>
                        </p>
                    </div>
                </div>

                {/* 3. Average time in position */}
                <div className="bg-white rounded-xl border border-zinc-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 flex flex-col justify-between gap-2">
                    <div className="flex justify-between items-start">
                        <span className="text-xs text-zinc-500 font-semibold">Average hold duration</span>
                        <Clock size={14} className="text-zinc-400" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <div className="flex justify-between text-xs">
                            <span className="text-zinc-400 font-medium">Buys:</span>
                            <span className="font-bold text-zinc-800">{formatDuration(otherData.chartSix.averageTimeInBuyPosition)}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                            <span className="text-zinc-400 font-medium">Sells:</span>
                            <span className="font-bold text-zinc-800">{formatDuration(otherData.chartSix.averageTimeInSellPosition)}</span>
                        </div>
                    </div>
                </div>

                {/* 4. Streaks */}
                <div className="bg-white rounded-xl border border-zinc-200/80 shadow-[0_1px_3px_rgba(0,0,0,0.04)] p-5 flex flex-col justify-between gap-2">
                    <div className="flex justify-between items-start">
                        <span className="text-xs text-zinc-500 font-semibold">Consecutive streaks</span>
                        <Zap size={14} className="text-zinc-400" />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex-1 bg-emerald-50 border border-emerald-100 rounded-lg p-2 text-center">
                            <p className="text-[10px] font-semibold text-emerald-600">Wins</p>
                            <span className="text-sm font-extrabold text-emerald-700">
                                ▲ {otherData.chartSeven.sequenceProfitable}
                            </span>
                        </div>
                        <div className="flex-1 bg-rose-50 border border-rose-100 rounded-lg p-2 text-center">
                            <p className="text-[10px] font-semibold text-rose-600">Losses</p>
                            <span className="text-sm font-extrabold text-rose-700">
                                ▼ {otherData.chartSeven.sequenceLost}
                            </span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
