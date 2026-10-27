"use client";

import { useMemo } from "react";
import {
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
} from "recharts";
import { PieChart as PieIcon, TrendingUp, CalendarDays } from "lucide-react";

interface StatsGridPageTwoProps {
    start?: string | undefined;
    end?: string | undefined;
    closedTradeCount?: number;
    oterData: {
        chartTwo: {
            topTrades: {
                id: number;
                value: number;
                label: string;
            }[];
        };
        chartThree: {
            results: number[];
            dates: string[];
        };
        chartFour: {
            data: number[];
            color: string;
            label: string;
        }[];
    };
}

const INSTRUMENT_COLORS = [
    "#52525b", // Zinc
    "#10b981", // Emerald
    "#f59e0b", // Amber
    "#a1a1aa", // Light zinc
];

function formatSignedCurrency(value: number) {
    return `${value >= 0 ? "+" : "-"}$${Math.abs(value).toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;
}

function formatAxisCurrency(value: number) {
    return `${value < 0 ? "-" : ""}$${Math.abs(value).toLocaleString()}`;
}

export function StatsGridPageTwo({
    start,
    end,
    closedTradeCount,
    oterData,
}: StatsGridPageTwoProps) {
    const hasAccountRange =
        start !== undefined &&
        end !== undefined &&
        Number.isFinite(Number(start)) &&
        Number.isFinite(Number(end));
    const accountChange = hasAccountRange ? Number(end) - Number(start) : undefined;

    // 1. Prepare Donut Chart Data
    const donutData = useMemo(() => {
        const trades = oterData.chartTwo?.topTrades ?? [];
        const total = trades.reduce((sum, item) => sum + (item.value || 0), 0);
        return trades
            .filter((item) => (item.value || 0) > 0)
            .map((item, index) => ({
                name: item.label,
                value: item.value || 0,
                percent: total > 0 ? ((item.value / total) * 100).toFixed(1) : "0",
                color: INSTRUMENT_COLORS[index % INSTRUMENT_COLORS.length],
            }));
    }, [oterData.chartTwo]);

    // 2. Prepare the ten largest closed-trade results by absolute P&L.
    const topTradesData = useMemo(() => {
        const results = oterData.chartThree?.results ?? [];
        const dates = oterData.chartThree?.dates ?? [];
        return results
            .map((result, idx) => ({
                date: dates[idx] || `Trade #${idx + 1}`,
                pnl: result,
            }))
            .sort((a, b) => Math.abs(b.pnl) - Math.abs(a.pnl))
            .slice(0, 10);
    }, [oterData.chartThree]);

    // 3. Prepare trade counts by day of week.
    const weekdayData = useMemo(() => {
        const series = oterData.chartFour ?? [];
        const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

        return dayLabels.map((day, dayIdx) => {
            const entry: Record<string, string | number> = { day };
            series.forEach((s) => {
                const mondayFirstIndex = dayIdx === 0 ? 6 : dayIdx - 1;
                entry[s.label] = s.data?.[mondayFirstIndex] ?? 0;
            });
            return entry;
        });
    }, [oterData.chartFour]);

    const weekdaySeries = oterData.chartFour ?? [];

    return (
        <div className="flex min-w-0 flex-col gap-4 w-full">
            <div className="flex flex-wrap items-center gap-x-6 gap-y-1.5 text-xs text-zinc-500">
                <span>
                    Scope <span className="font-medium text-zinc-800">Current trade filter</span>
                </span>
                {accountChange !== undefined && (
                    <span>
                        Account change{" "}
                        <span className={`font-mono font-semibold tabular-nums ${accountChange >= 0 ? "text-emerald-700" : "text-rose-700"}`}>
                            {formatSignedCurrency(accountChange)}
                        </span>
                    </span>
                )}
                <span>
                    Closed trades{" "}
                    <span className="font-mono font-semibold text-zinc-800 tabular-nums">
                        {closedTradeCount ?? oterData.chartThree?.results.length ?? 0}
                    </span>
                </span>
            </div>

            <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-12 xl:grid-rows-[minmax(0,1fr)_minmax(0,1fr)]">
            {/* 1. Instruments Popularity Donut */}
            <div className="flex min-h-[360px] min-w-0 flex-col overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-xs xl:col-span-4 xl:row-span-1 xl:min-h-0">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
                    <div className="flex items-center gap-2">
                        <PieIcon className="w-4 h-4 text-zinc-500" />
                        <h3 className="text-sm font-semibold text-zinc-800">
                            Most traded instruments
                        </h3>
                    </div>
                    <span className="text-[11px] text-zinc-500">
                        Share of trade count
                    </span>
                </div>

                <div className="flex min-h-0 flex-1 flex-col p-4">
                    {/* Legend */}
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        {donutData.map((item) => (
                            <div
                                key={item.name}
                                className="flex min-w-0 items-center justify-between gap-2 rounded-lg border border-zinc-100 bg-zinc-50 p-2"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <span
                                        className="w-2.5 h-2.5 rounded-full shrink-0"
                                        style={{ backgroundColor: item.color }}
                                    />
                                    <span className="truncate text-xs font-medium text-zinc-700">
                                        {item.name}
                                    </span>
                                </div>
                                <span className="shrink-0 font-mono text-xs font-semibold tabular-nums text-zinc-500">
                                    {item.value} <span className="text-[10px] font-normal text-zinc-400">({item.percent}%)</span>
                                </span>
                            </div>
                        ))}
                    </div>

                    {/* Donut Chart Container */}
                    <div className="relative min-h-[190px] flex-1 w-full min-w-0">
                        {donutData.length === 0 ? (
                            <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-zinc-200 text-xs text-zinc-500">
                                No trades in this scope
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={donutData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius="48%"
                                        outerRadius="72%"
                                        paddingAngle={3}
                                        dataKey="value"
                                    >
                                        {donutData.map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={entry.color}
                                                stroke="#ffffff"
                                                strokeWidth={2}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: string | number, name: string) => [
                                            `${value} trades`,
                                            name,
                                        ]}
                                        contentStyle={{
                                            backgroundColor: "#18181b",
                                            borderRadius: "8px",
                                            border: "none",
                                            color: "#ffffff",
                                            fontSize: "12px",
                                            padding: "8px 12px",
                                        }}
                                        itemStyle={{ color: "#ffffff" }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </div>
            </div>

            {/* 2. Largest closed-trade P&L results */}
            <div className="flex min-h-[360px] min-w-0 flex-col overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-xs xl:col-span-8 xl:row-span-1 xl:min-h-0">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
                    <div className="flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-600" />
                        <h3 className="text-sm font-semibold text-zinc-800">
                            Largest P&amp;L results (top 10)
                        </h3>
                    </div>
                    <span className="text-[11px] text-zinc-500">
                        Realized P&amp;L
                    </span>
                </div>

                <div className="min-h-[240px] flex-1 w-full min-w-0 p-4">
                    {topTradesData.length === 0 ? (
                        <div className="flex h-full items-center justify-center rounded-lg border border-dashed border-zinc-200 text-xs text-zinc-500">
                            No closed trades in this scope
                        </div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={topTradesData} margin={{ top: 10, right: 10, left: 4, bottom: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    tickLine={false}
                                    axisLine={{ stroke: "#e4e4e7" }}
                                    tick={{ fill: "#71717a", fontSize: 11, fontFamily: "monospace" }}
                                />
                                <YAxis
                                    tickLine={false}
                                    axisLine={{ stroke: "#e4e4e7" }}
                                    tick={{ fill: "#71717a", fontSize: 11, fontFamily: "monospace" }}
                                    tickFormatter={formatAxisCurrency}
                                />
                                <Tooltip
                                    formatter={(val: string | number) => [
                                        formatSignedCurrency(Number(val)),
                                        "Realized P&L",
                                    ]}
                                    labelFormatter={(label) => `Closed: ${label}`}
                                    contentStyle={{
                                        backgroundColor: "#18181b",
                                        borderRadius: "8px",
                                        border: "none",
                                        color: "#ffffff",
                                        fontSize: "12px",
                                        padding: "8px 12px",
                                    }}
                                />
                                <Bar
                                    dataKey="pnl"
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={48}
                                >
                                    {topTradesData.map((trade, index) => (
                                        <Cell
                                            key={`${trade.date}-${index}`}
                                            fill={trade.pnl >= 0 ? "#10b981" : "#f43f5e"}
                                        />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* 3. Closed trade count by day of week */}
            <div className="flex min-h-[340px] min-w-0 flex-col overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-xs xl:col-span-12 xl:row-span-1 xl:min-h-0">
                <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-zinc-100 bg-zinc-50/50">
                    <div className="flex items-center gap-2">
                        <CalendarDays className="w-4 h-4 text-zinc-500" />
                        <h3 className="text-sm font-semibold text-zinc-800">
                            Closed trades by weekday
                        </h3>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        {weekdaySeries.map((s, idx) => (
                            <div key={s.label} className="flex items-center gap-1.5">
                                <span
                                    className="w-2.5 h-2.5 rounded-full"
                                    style={{
                                        backgroundColor:
                                            INSTRUMENT_COLORS[idx % INSTRUMENT_COLORS.length],
                                    }}
                                />
                                <span className="text-[11px] font-medium text-zinc-600">
                                    {s.label}
                                </span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="min-h-[220px] flex-1 w-full min-w-0 p-4">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weekdayData} margin={{ top: 10, right: 10, left: 10, bottom: 10 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" vertical={false} />
                            <XAxis
                                dataKey="day"
                                tickLine={false}
                                axisLine={{ stroke: "#e4e4e7" }}
                                tick={{ fill: "#71717a", fontSize: 12, fontWeight: 500 }}
                            />
                            <YAxis
                                tickLine={false}
                                axisLine={{ stroke: "#e4e4e7" }}
                                tick={{ fill: "#71717a", fontSize: 11, fontFamily: "monospace" }}
                                allowDecimals={false}
                            />
                            <Tooltip
                                formatter={(value: string | number, name: string) => [
                                    `${value} closed ${Number(value) === 1 ? "trade" : "trades"}`,
                                    name,
                                ]}
                                contentStyle={{
                                    backgroundColor: "#18181b",
                                    borderRadius: "8px",
                                    border: "none",
                                    color: "#ffffff",
                                    fontSize: "12px",
                                    padding: "8px 12px",
                                }}
                            />
                            {weekdaySeries.map((s, idx) => (
                                <Bar
                                    key={s.label}
                                    dataKey={s.label}
                                    fill={INSTRUMENT_COLORS[idx % INSTRUMENT_COLORS.length]}
                                    radius={[4, 4, 0, 0]}
                                    maxBarSize={32}
                                />
                            ))}
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
            </div>
        </div>
    );
}
