"use client";

import React, { useEffect, useRef, useState, useMemo } from "react";

import { getAIReport } from "@/features/ai/getAiReport";
import { useAppSelector } from "@/redux/store";
import { ApiResponse, ReportType, OpenPositionPayload, PortfolioRiskSummary } from "@/types/tradeAI.types";
import { Trades } from "@/types";
import { CloseEvent } from "@/types/dbSchema.types";
import { toast } from "sonner";
import ReportPage from "@/components/tradeAI/ReportPage";
import { useMarketPrices } from "@/hooks/useMarketPrices";
import CustomLoading from "@/components/CustomLoading";

export default function Report() {
    const trades = useAppSelector((state) => state.tradeRecords.listOfTrades);

    const [tokens, setTokens] = useState<number | undefined>();
    const [report, setReport] = useState<ReportType | null>(null);
    const hasFetched = useRef(false);

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

    useEffect(() => {
        if (isWaitingForPrices) return;
        if (hasFetched.current) return;
        if (!trades || trades.length < 3) {
            toast.error(
                "You don’t have enough trades. You must have at least 3 trades to get the report!"
            );
            return;
        }

        hasFetched.current = true;
        const fetchReport = async () => {
            try {
                // Feed enrichedTrades into local report generation (Money Management & Instruments)
                const localReport = getAIReport(enrichedTrades);
                setReport({
                    moneyManagement: [
                        {
                            type: "system",
                            content: localReport.moneyManagement,
                        },
                    ],
                    instruments: [
                        { type: "system", content: localReport.instruments },
                    ],
                    timeManagement: null,
                    portfolioSummary: aiPayload.portfolioSummary,
                    openPositions: aiPayload.openPositions,
                });

                let claudeReport: ApiResponse | null = null;
                try {
                    const res = await fetch("/api/claude", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify(aiPayload),
                    });

                    if (!res.ok) {
                        const err = await res.json();
                        throw new Error(err.error);
                    }

                    claudeReport = await res.json();
                } catch (apiErr) {
                    console.error("AI report API failed:", apiErr);
                    setReport((prev) => {
                        if (!prev) return null;
                        return {
                            ...prev,
                            timeManagement: [
                                {
                                    type: "system",
                                    content: [
                                        apiErr instanceof Error
                                            ? apiErr.message
                                            : "AI Analysis is disabled. Please check your CLAUDE_API_KEY environment variable configuration.",
                                    ],
                                },
                            ],
                        };
                    });
                }

                if (claudeReport) {
                    setReport((prev) => {
                        if (!prev) return null;
                        return {
                            ...prev,
                            liveExposureChecklist: claudeReport?.liveExposureChecklist,
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
                }
            } catch (err) {
                const msg =
                    err instanceof Error
                        ? err.message
                        : "Error occurred! Try again later!";
                toast.error(msg);
                console.error(err);
            }
        };

        fetchReport();
    }, [trades, isWaitingForPrices, enrichedTrades, aiPayload]);

    // Show a clean loading state while fetching prices or when the report is generating
    if (isWaitingForPrices || !report) {
        return (
            <div className="h-screen flex flex-col gap-3 items-center justify-center bg-white">
                <CustomLoading />
                <p className="text-zinc-500 text-sm font-medium animate-pulse">
                    {isWaitingForPrices
                        ? "Fetching live market prices & open positions..."
                        : "Generating your AI Trading Report & Risk Analysis..."}
                </p>
            </div>
        );
    }

    return (
        <ReportPage
            tokens={tokens}
            goBackButton="Reports"
            report={report}
            setReport={setReport}
            setTokens={setTokens}
            enrichedTrades={enrichedTrades}
            openPositions={aiPayload.openPositions}
            portfolioSummary={aiPayload.portfolioSummary}
        />
    );
}
