"use client";

import React, { useEffect, useState, useMemo } from "react";

import { getAIReport } from "@/features/ai/getAiReport";
import { useAppSelector } from "@/redux/store";
import {
    ApiResponse,
    ReportType,
    OpenPositionPayload,
    PortfolioRiskSummary,
} from "@/types/tradeAI.types";
import { Trades } from "@/types";
import ReportPage from "@/components/tradeAI/ReportPage";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import CustomLoading from "@/components/CustomLoading";
import Link from "next/link";
import {
    AlertTriangle,
    ArrowLeft,
    CheckCircle2,
    RefreshCw,
    Sparkles,
} from "lucide-react";

type AiStatus = "idle" | "loading" | "ready" | "error";

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message.trim()) {
        return error.message;
    }
    return "The AI analysis could not be generated.";
}

export default function Report() {
    const trades = useAppSelector((state) => state.tradeRecords.listOfTrades);

    const [tokens, setTokens] = useState<number | undefined>();
    const [report, setReport] = useState<ReportType | null>(null);
    const [aiStatus, setAiStatus] = useState<AiStatus>("idle");
    const [aiError, setAiError] = useState<string | null>(null);
    const [requestKey, setRequestKey] = useState(0);

    // 1. Fetch live market prices for active/open positions
    const openTrades = useMemo(() => {
        return (trades || []).filter((t) => !t.closeDate || t.closeDate === "");
    }, [trades]);

    const symbols = useMemo(() => {
        return [...new Set(openTrades.map((t) => t.symbolName).filter(Boolean))];
    }, [openTrades]);

    const { prices, lastUpdated, error: pricesError } = useMarketPrices(symbols);

    // If there are open trades, wait for the initial price load
    const isWaitingForPrices = symbols.length > 0 && !lastUpdated && !pricesError;
    const hasEnoughTrades = Boolean(trades && trades.length >= 3);

    // Helper to calculate remaining quantity of a trade (same as OpenTradesTable)
    const getRemainingQty = (trade: Trades): number => {
        return Number(trade.quantity) || 0;
    };

    // 2. Enrich trades with real-time floating P/L for open positions
    const enrichedTrades = useMemo(() => {
        return (trades || []).map((trade) => {
            // If the trade is closed, keep its original result
            if (trade.closeDate && trade.closeDate !== "") {
                return trade;
            }

            // If the trade is open, calculate Unrealized P/L based on current market price
            const remainingQty = getRemainingQty(trade);
            const entryPrice = Number(trade.entryPrice);
            const currentPrice = prices[trade.symbolName] ?? null;

            let unrealizedPnL = 0;
            if (
                currentPrice !== null &&
                !isNaN(entryPrice) &&
                entryPrice > 0 &&
                remainingQty > 0
            ) {
                unrealizedPnL =
                    (currentPrice - entryPrice) *
                    remainingQty *
                    (trade.positionType === "buy" ? 1 : -1);
            }

            return {
                ...trade,
                result: unrealizedPnL.toString(),
            };
        });
    }, [trades, prices]);

    // 3. Build structured payload for the AI completion endpoint (Open Positions + Portfolio Risk Summary + Closed Trades)
    const aiPayload = useMemo(() => {
        const closed = (trades || []).filter((t) => Boolean(t.closeDate && t.closeDate !== ""));
        const open = (trades || []).filter((t) => !t.closeDate || t.closeDate === "");

        let totalPosValue = 0;
        let totalUnrealizedPnL = 0;
        let totalCost = 0;

        const openPositionsPayload: OpenPositionPayload[] = open.map((trade) => {
            const remainingQty = getRemainingQty(trade);
            const entryPrice = Number(trade.entryPrice) || 0;
            const markPrice = prices[trade.symbolName] ?? null;

            let unrealizedPnL: number | null = null;
            let unrealizedPnLPercent: number | null = null;
            let positionValue: number | null = null;

            if (markPrice !== null && !isNaN(entryPrice) && entryPrice > 0 && remainingQty > 0) {
                unrealizedPnL = (markPrice - entryPrice) * remainingQty * (trade.positionType === "buy" ? 1 : -1);
                unrealizedPnLPercent = ((markPrice - entryPrice) / entryPrice) * 100 * (trade.positionType === "buy" ? 1 : -1);
                positionValue = markPrice * remainingQty;

                totalPosValue += positionValue;
                totalUnrealizedPnL += unrealizedPnL;
                totalCost += entryPrice * remainingQty;
            }

            return {
                symbolName: trade.symbolName,
                positionType: (trade.positionType === "sell" ? "sell" : "buy") as "buy" | "sell",
                entryPrice,
                markPrice,
                quantity: remainingQty,
                unrealizedPnL,
                unrealizedPnLPercent,
                positionValue,
            };
        });

        const totalUnrealizedPnLPercent = totalCost > 0 ? (totalUnrealizedPnL / totalCost) * 100 : 0;

        const portfolioSummaryPayload: PortfolioRiskSummary = {
            totalOpenPositions: openPositionsPayload.length,
            totalPositionValue: totalPosValue,
            totalUnrealizedPnL: totalUnrealizedPnL,
            totalUnrealizedPnLPercent,
        };

        const closedTradesPayload = closed.map(({ result, symbolName, openTime, positionType }) => ({
            symbolName,
            positionType,
            openTime,
            result,
        }));

        return {
            openPositions: openPositionsPayload,
            portfolioSummary: portfolioSummaryPayload,
            closedTrades: closedTradesPayload,
            trades: enrichedTrades.map(({ result, symbolName, openTime }) => ({ result, symbolName, openTime })),
        };
    }, [trades, prices, enrichedTrades]);

    const fetchAiReport = async () => {
        setAiStatus("loading");
        setAiError(null);

        try {
            const res = await fetch("/api/claude", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(aiPayload),
            });

            if (!res.ok) {
                const errorBody = await res.json().catch(() => null);
                throw new Error(
                    errorBody?.error ||
                        `AI analysis failed with status ${res.status}.`
                );
            }

            const claudeReport = (await res.json()) as ApiResponse;
            if (!claudeReport?.claudeComments) {
                throw new Error("The AI response was missing its analysis.");
            }

            setReport((prev) => {
                if (!prev) return prev;
                return {
                    ...prev,
                    liveExposureChecklist: claudeReport.liveExposureChecklist,
                    timeManagement: [
                        {
                            type: "system",
                            content: [
                                ...claudeReport.claudeComments.generalObservations,
                                ...claudeReport.claudeComments.recommendations,
                            ],
                        },
                    ],
                };
            });
            setAiStatus("ready");
        } catch (error) {
            console.error("AI report API failed:", error);
            setAiError(getErrorMessage(error));
            setAiStatus("error");
        }
    };

    useEffect(() => {
        if (!hasEnoughTrades || isWaitingForPrices) return;

        const localReport = getAIReport(enrichedTrades);
        // A quote refresh must not erase completed analysis or follow-up messages.
        setReport((previous) => previous ?? {
            moneyManagement: [
                { type: "system", content: localReport.moneyManagement },
            ],
            instruments: [
                { type: "system", content: localReport.instruments },
            ],
            timeManagement: null,
            portfolioSummary: aiPayload.portfolioSummary,
            openPositions: aiPayload.openPositions,
        });
    }, [hasEnoughTrades, isWaitingForPrices, enrichedTrades, aiPayload]);

    useEffect(() => {
        if (!hasEnoughTrades || isWaitingForPrices) return;
        void fetchAiReport();
        // The retry key deliberately starts a new request without changing payload.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [hasEnoughTrades, isWaitingForPrices, requestKey]);

    if (!hasEnoughTrades) {
        return (
            <div className="flex min-h-full items-center justify-center bg-white p-6">
                <div className="w-full max-w-md text-center">
                    <AlertTriangle className="mx-auto h-7 w-7 text-amber-600" />
                    <h1 className="mt-3 text-lg font-semibold text-zinc-900">
                        Not enough trades yet
                    </h1>
                    <p className="mt-1.5 text-sm leading-relaxed text-zinc-600">
                        A report needs at least 3 recorded trades. You currently have{" "}
                        {trades?.length ?? 0}.
                    </p>
                    <Link
                        href="/private/tradeAI"
                        className="mt-5 inline-flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to reports
                    </Link>
                </div>
            </div>
        );
    }

    if (isWaitingForPrices) {
        return (
            <div className="flex min-h-full flex-col items-center justify-center gap-3 bg-white p-6">
                <CustomLoading />
                <p className="text-sm text-zinc-500">
                    Loading prices for open positions...
                </p>
            </div>
        );
    }

    if (!report) {
        return (
            <div className="flex min-h-full items-center justify-center bg-white p-6">
                <p className="text-sm text-zinc-500">Preparing local analysis...</p>
            </div>
        );
    }

    return (
        <div className="flex min-h-full flex-col">
            <AiStatusBanner
                status={aiStatus}
                error={aiError}
                pricesUnavailable={pricesError}
                onRetry={() => setRequestKey((key) => key + 1)}
            />
            <div className="min-h-0 flex-1">
                <ReportPage
                    tokens={tokens}
                    goBackButton="Reports"
                    backHref="/private/tradeAI"
                    report={report}
                    setReport={setReport}
                    setTokens={setTokens}
                    enrichedTrades={enrichedTrades}
                    openPositions={aiPayload.openPositions}
                    portfolioSummary={aiPayload.portfolioSummary}
                />
            </div>
        </div>
    );
}

function AiStatusBanner({
    status,
    error,
    pricesUnavailable,
    onRetry,
}: {
    status: AiStatus;
    error: string | null;
    pricesUnavailable: boolean;
    onRetry: () => void;
}) {
    if (status === "ready") {
        return (
            <div className="flex items-center gap-2 border-b border-emerald-100 bg-emerald-50/60 px-4 py-2 text-xs text-emerald-800 md:px-8">
                <CheckCircle2 className="h-3.5 w-3.5" />
                AI analysis ready. Local rule analysis remains available offline.
                {pricesUnavailable && (
                    <span className="text-amber-700">
                        Live prices were unavailable; entry values are shown.
                    </span>
                )}
            </div>
        );
    }

    if (status === "error") {
        return (
            <div
                role="alert"
                className="flex flex-wrap items-center justify-between gap-3 border-b border-rose-200 bg-rose-50 px-4 py-2.5 text-xs text-rose-800 md:px-8"
            >
                <div className="flex min-w-0 items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span className="min-w-0">
                        AI analysis unavailable. Money management and instrument
                        reports were generated locally.
                        <span className="mt-0.5 block break-words text-rose-700/80">
                            {error}
                        </span>
                    </span>
                </div>
                <button
                    type="button"
                    onClick={onRetry}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-rose-200 bg-white px-2.5 py-1.5 font-medium text-rose-800 transition-colors hover:bg-rose-100"
                >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retry AI analysis
                </button>
            </div>
        );
    }

    return (
        <div
            role="status"
            className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 bg-zinc-50 px-4 py-2.5 text-xs text-zinc-600 md:px-8"
        >
            <div className="flex items-start gap-2">
                {status === "loading" ? (
                    <RefreshCw className="mt-0.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                    <Sparkles className="mt-0.5 h-3.5 w-3.5" />
                )}
                <span>
                    {status === "loading"
                        ? "Generating AI time-management analysis. Local reports are already available."
                        : "AI analysis is waiting to start."}
                </span>
            </div>
            {pricesUnavailable && (
                <span className="text-amber-700">
                    Live prices unavailable; saved or entry values are shown.
                </span>
            )}
        </div>
    );
}
