"use client";

import { useMemo } from "react";
import dayjs from "dayjs";

import { Trades } from "@/types";
import { Strategy } from "@/types/strategies.types";
import { useAppSelector } from "@/redux/store";

type ClosedTrade = Trades & {
    closeDate: string;
    closeTime?: string;
    result: string;
};

interface StrategyHistoryProps {
    strategy: Strategy;
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

const formatSignedCurrency = (value: number): string => {
    if (!Number.isFinite(value) || Math.abs(value) < 0.005) {
        return "$0.00";
    }

    return `${value > 0 ? "+" : "-"}$${currencyFormatter.format(Math.abs(value))}`;
};

const formatQuantity = (value: number): string => {
    if (!Number.isFinite(value)) {
        return "0";
    }

    return Number(value.toPrecision(8)).toLocaleString("en-US", {
        maximumFractionDigits: 8,
    });
};

const formatCloseDate = (value: string): string => {
    const parsed = dayjs(value);
    return parsed.isValid() ? parsed.format("MMM D, YYYY") : value;
};

const formatCloseTime = (value?: string): string => value || "—";

const getPnlTone = (value: number): string => {
    if (value > 0) return "text-emerald-600";
    if (value < 0) return "text-rose-600";
    return "text-zinc-600";
};

export default function StrategyHistory({ strategy }: StrategyHistoryProps) {
    const allTrades = useAppSelector((state) => state.tradeRecords.listOfTrades);

    const closedTrades = useMemo(() => {
        return (allTrades ?? [])
            .filter((trade): trade is ClosedTrade =>
                trade.strategyId === strategy.id &&
                Boolean(
                    trade.closeDate &&
                    trade.result !== undefined &&
                    trade.result !== ""
                )
            )
            .sort((a, b) => {
                const dateDiff =
                    dayjs(b.closeDate).valueOf() - dayjs(a.closeDate).valueOf();
                if (dateDiff !== 0) return dateDiff;
                return (b.closeTime ?? "").localeCompare(a.closeTime ?? "");
            });
    }, [allTrades, strategy.id]);

    const metrics = useMemo(() => {
        let wins = 0;
        let grossProfit = 0;
        let grossLoss = 0;
        let totalRealizedPnl = 0;

        for (const trade of closedTrades) {
            const result = Number(trade.result) || 0;
            totalRealizedPnl += result;

            if (result > 0) {
                wins += 1;
                grossProfit += result;
            } else if (result < 0) {
                grossLoss += Math.abs(result);
            }
        }

        const totalTrades = closedTrades.length;
        const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
        const profitFactor =
            grossLoss > 0
                ? grossProfit / grossLoss
                : null;
        const avgTradePnl = totalTrades > 0 ? totalRealizedPnl / totalTrades : 0;

        return {
            winRate,
            profitFactor,
            totalRealizedPnl,
            totalTrades,
            avgTradePnl,
        };
    }, [closedTrades]);

    const profitFactorLabel =
        metrics.totalTrades === 0
            ? "N/A"
            : metrics.profitFactor === null
                ? "No losses"
                : metrics.profitFactor.toFixed(2);

    const performanceMetrics = [
        {
            label: "Win Rate",
            value: `${metrics.winRate.toFixed(1)}%`,
            valueClassName: "text-zinc-900",
        },
        {
            label: "Profit Factor",
            value: profitFactorLabel,
            valueClassName:
                metrics.profitFactor === null
                    ? "text-zinc-500"
                    : metrics.profitFactor > 1
                        ? "text-emerald-600"
                        : metrics.profitFactor < 1
                            ? "text-rose-600"
                            : "text-zinc-700",
        },
        {
            label: "Realized P/L",
            value: formatSignedCurrency(metrics.totalRealizedPnl),
            valueClassName: getPnlTone(metrics.totalRealizedPnl),
        },
        {
            label: "Total Trades",
            value: metrics.totalTrades.toLocaleString("en-US"),
            valueClassName: "text-zinc-900",
        },
        {
            label: "Avg. P/L",
            value: formatSignedCurrency(metrics.avgTradePnl),
            valueClassName: getPnlTone(metrics.avgTradePnl),
        },
    ];

    return (
        <div className="flex w-full min-w-0 flex-col gap-3">
            <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-3 py-2.5">
                    <h3 className="text-[13px] font-medium text-zinc-800">
                        Performance
                    </h3>
                    <span className="text-xs text-zinc-500 tabular-nums">
                        {metrics.totalTrades} closed {metrics.totalTrades === 1 ? "trade" : "trades"}
                    </span>
                </div>

                <div className="grid grid-cols-2 divide-x divide-y divide-zinc-100 sm:grid-cols-3 xl:grid-cols-5 xl:divide-y-0">
                    {performanceMetrics.map((metric) => (
                        <div key={metric.label} className="min-w-0 px-3 py-2.5">
                            <p className="truncate text-xs font-medium text-zinc-500">
                                {metric.label}
                            </p>
                            <p
                                className={`mt-1 truncate font-mono text-sm font-semibold leading-5 tabular-nums ${metric.valueClassName}`}
                            >
                                {metric.value}
                            </p>
                        </div>
                    ))}
                </div>
            </section>

            <section className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-3 py-2.5">
                    <h3 className="text-[13px] font-medium text-zinc-800">
                        Closed trades
                    </h3>
                    <span className="text-xs text-zinc-500">
                        {strategy.strategyName}
                    </span>
                </div>

                {closedTrades.length > 0 ? (
                    <div className="max-h-[300px] overflow-auto">
                        <table className="w-full min-w-[620px] table-fixed border-collapse">
                            <thead className="sticky top-0 z-10 bg-zinc-50">
                                <tr className="border-b border-zinc-200 text-xs font-medium text-zinc-500">
                                    <th className="w-[20%] px-3 py-2 text-left">Date</th>
                                    <th className="w-[20%] px-3 py-2 text-left">Symbol</th>
                                    <th className="w-[12%] px-3 py-2 text-left">Side</th>
                                    <th className="w-[14%] px-3 py-2 text-right">Qty</th>
                                    <th className="w-[18%] px-3 py-2 text-right">Realized P/L</th>
                                    <th className="w-[16%] px-3 py-2 text-right">Close</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-zinc-100">
                                {closedTrades.map((trade) => {
                                    const result = Number(trade.result) || 0;
                                    const quantity =
                                        Number(trade.quantitySold) ||
                                        Number(trade.quantity) ||
                                        0;
                                    const isLong =
                                        trade.positionType.toLowerCase() === "buy";

                                    return (
                                        <tr
                                            key={trade.id}
                                            className="text-[13px] transition-colors hover:bg-zinc-50"
                                        >
                                            <td className="whitespace-nowrap px-3 py-2 font-mono text-zinc-600 tabular-nums">
                                                {formatCloseDate(trade.closeDate)}
                                            </td>
                                            <td className="truncate px-3 py-2 font-semibold text-zinc-800">
                                                {trade.symbolName}
                                            </td>
                                            <td className={`px-3 py-2 font-medium ${isLong ? "text-emerald-700" : "text-rose-700"}`}>
                                                {isLong ? "Long" : "Short"}
                                            </td>
                                            <td className="truncate px-3 py-2 text-right font-mono text-zinc-600 tabular-nums">
                                                {formatQuantity(quantity)}
                                            </td>
                                            <td
                                                className={`whitespace-nowrap px-3 py-2 text-right font-mono font-semibold tabular-nums ${getPnlTone(result)}`}
                                            >
                                                {formatSignedCurrency(result)}
                                            </td>
                                            <td className="whitespace-nowrap px-3 py-2 text-right text-xs text-zinc-500">
                                                {formatCloseTime(trade.closeTime)}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="flex min-h-[112px] flex-col items-center justify-center px-4 text-center">
                        <p className="text-sm font-medium text-zinc-700">
                            No closed trades
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                            Closed positions using this strategy will appear here.
                        </p>
                    </div>
                )}
            </section>
        </div>
    );
}
