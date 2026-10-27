"use client";

import React, { Dispatch, SetStateAction, useState, useMemo } from "react";
import { ReportCard } from "./ReportCard";
import { ArrowUp, Loader2 } from "lucide-react";

import { Category, ReportType, OpenPositionPayload, PortfolioRiskSummary } from "@/types/tradeAI.types";
import { toast } from "sonner";
import AutoResizeTextarea from "@/features/archive/AutoResizeTextarea";
import { useAppSelector } from "@/redux/store";

import { useMarketPrices } from "@/hooks/useMarketPrices";
import { Trades } from "@/types";

type GeneratedReportType = {
    report: ReportType | null;

    selectCategory: Category;
    setReport: Dispatch<SetStateAction<ReportType | null>>;
    setTokens?: Dispatch<SetStateAction<number | undefined>>;
    enrichedTrades?: Trades[] | null;
    openPositions?: OpenPositionPayload[] | null;
    portfolioSummary?: PortfolioRiskSummary | null;
};

export default function GeneratedReport({
    report,
    selectCategory,
    setReport,
    enrichedTrades,
    openPositions,
    portfolioSummary,
}: GeneratedReportType) {
    const [followUpQuestionInput, setFollowUpQuestionInput] = useState("");
    const [followUpError, setFollowUpError] = useState<string | null>(null);

    const reduxTrades = useAppSelector((state) => state.tradeRecords.listOfTrades);
    const trades = enrichedTrades || reduxTrades;

    const [loading, setLoading] = useState({
        moneyManagement: false,
        instruments: false,
        timeManagement: false,
    });

    const openSymbols = useMemo(() => {
        const open = (trades || []).filter((t) => !t.closeDate || t.closeDate === "");
        return [...new Set(open.map((t) => t.symbolName).filter(Boolean))];
    }, [trades]);

    const { prices } = useMarketPrices(openSymbols);

    const activeOpenPositions = useMemo(() => {
        const basePositions = (openPositions && openPositions.length > 0)
            ? openPositions
            : (report?.openPositions && report.openPositions.length > 0)
            ? report.openPositions
            : null;

        if (basePositions) {
            return basePositions.map((pos) => {
                const livePrice = prices[pos.symbolName] ?? pos.markPrice;
                if (livePrice !== null && pos.entryPrice > 0 && pos.quantity > 0) {
                    const isSell = pos.positionType === "sell";
                    const unrealizedPnL = (livePrice - pos.entryPrice) * pos.quantity * (isSell ? -1 : 1);
                    const unrealizedPnLPercent = ((livePrice - pos.entryPrice) / pos.entryPrice) * 100 * (isSell ? -1 : 1);
                    const positionValue = livePrice * pos.quantity;
                    return {
                        ...pos,
                        markPrice: livePrice,
                        unrealizedPnL: Number(unrealizedPnL.toFixed(2)),
                        unrealizedPnLPercent: Number(unrealizedPnLPercent.toFixed(2)),
                        positionValue: Number(positionValue.toFixed(2)),
                    };
                }
                return pos;
            });
        }

        const open = (trades || []).filter((t) => !t.closeDate || t.closeDate === "");
        return open.map((t) => {
            const entryPrice = Number(t.entryPrice) || 0;
            const qty = Number(t.quantity) || 0;
            const livePrice = prices[t.symbolName] ?? null;
            const isSell = t.positionType === "sell";
            const unrealizedPnL = (livePrice !== null && entryPrice > 0 && qty > 0)
                ? (livePrice - entryPrice) * qty * (isSell ? -1 : 1)
                : null;
            const unrealizedPnLPercent = (livePrice !== null && entryPrice > 0)
                ? ((livePrice - entryPrice) / entryPrice) * 100 * (isSell ? -1 : 1)
                : null;
            return {
                symbolName: t.symbolName,
                positionType: (t.positionType === "sell" ? "sell" : "buy") as "buy" | "sell",
                entryPrice,
                markPrice: livePrice,
                quantity: qty,
                unrealizedPnL: unrealizedPnL !== null ? Number(unrealizedPnL.toFixed(2)) : null,
                unrealizedPnLPercent: unrealizedPnLPercent !== null ? Number(unrealizedPnLPercent.toFixed(2)) : null,
                positionValue: livePrice !== null ? Number((livePrice * qty).toFixed(2)) : null,
            };
        });
    }, [openPositions, report, trades, prices]);

    const activePortfolioSummary = portfolioSummary || report?.portfolioSummary || null;

    const filteredDataForAICall = trades?.map(
        ({ result, symbolName, openTime, positionType, entryPrice, quantity, closeDate }) => ({
            result,
            symbolName,
            openTime,
            positionType,
            entryPrice,
            quantity,
            isClosed: Boolean(closeDate && closeDate !== ""),
        })
    );

    const handleFollowUpQuestionSubmit = async (
        e: React.FormEvent<HTMLFormElement> | React.KeyboardEvent<HTMLTextAreaElement>
    ) => {
        e.preventDefault();

        if (followUpQuestionInput.trim() === "") {
            return;
        }

        const tempQuestionStorage = followUpQuestionInput.trim();
        const categoryBeforeRequest = selectCategory;
        const previousCategoryReport = report?.[categoryBeforeRequest];
        if (!previousCategoryReport) return;

        setFollowUpQuestionInput("");
        setFollowUpError(null);

        try {
            setLoading((prevLoading) => ({
                ...prevLoading,
                [categoryBeforeRequest]: true,
            }));

            setReport((prevReport) => {
                const currentCategory = prevReport?.[categoryBeforeRequest];
                if (!prevReport || !currentCategory) return prevReport;

                return {
                    ...prevReport,
                    [categoryBeforeRequest]: [
                        ...currentCategory,
                        { type: "user", content: [tempQuestionStorage] },
                    ],
                };
            });

            const res = await fetch("/api/follow-up-claude", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    openPositions: activeOpenPositions,
                    portfolioSummary: activePortfolioSummary,
                    closedTrades: filteredDataForAICall,
                    trades: filteredDataForAICall,
                    followUpQuestion: tempQuestionStorage,
                    prevResponse: JSON.stringify(previousCategoryReport),
                }),
            });

            if (!res.ok) {
                const errorMessage = await res.json().catch(() => null);
                throw new Error(
                    errorMessage?.error ||
                        "The AI follow-up request failed. Try again."
                );
            }

            const data = await res.json();

            const claudeReport = JSON.parse(data.content[0].text);
            if (!Array.isArray(claudeReport.answer)) {
                throw new Error("The AI returned an unexpected response format.");
            }

            setReport((prevReport) => {
                const currentCategory = prevReport?.[categoryBeforeRequest];
                if (!prevReport || !currentCategory) return prevReport;

                return {
                    ...prevReport,
                    [categoryBeforeRequest]: [
                        ...currentCategory,
                        { type: "system", content: claudeReport.answer },
                    ],
                };
            });
        } catch (error) {
            console.error(error);
            const message =
                error instanceof Error
                    ? error.message
                    : "The AI follow-up request failed. Try again.";
            setFollowUpError(message);
            toast.error(message);
        } finally {
            setLoading((prevLoading) => ({
                ...prevLoading,
                [categoryBeforeRequest]: false,
            }));
        }
    };

    return (
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            <div className="min-w-0 flex-1 px-4 pb-6 pt-1 md:px-8">
                {report && report[selectCategory] ? (
                    <ReportCard items={report[selectCategory]} loading={loading[selectCategory]} />
                ) : (
                    <div className="flex min-h-48 items-center justify-center rounded-lg border border-dashed border-zinc-200 text-sm text-zinc-500">
                        {report
                            ? "This section is not available in the saved report."
                            : "Select a category to view the report."}
                    </div>
                )}
            </div>

            {report && (
            <div className="shrink-0 border-t border-zinc-200 bg-white/95 px-4 py-3 md:px-8">
                {followUpError && (
                    <p
                        role="alert"
                        className="mx-auto mb-2 max-w-4xl text-xs text-rose-700"
                    >
                        {followUpError}
                    </p>
                )}
                <form
                    onSubmit={handleFollowUpQuestionSubmit}
                    className="relative mx-auto flex max-w-4xl items-center">
                    <AutoResizeTextarea
                        value={followUpQuestionInput}
                        onChange={(e) => setFollowUpQuestionInput(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                if (!loading[selectCategory] && followUpQuestionInput.trim() !== "") {
                                    handleFollowUpQuestionSubmit(e);
                                }
                            }
                        }}
                        placeholder="Ask a follow-up question..."
                        className="max-h-32 w-full resize-none rounded-lg border border-zinc-200 bg-zinc-50 py-2.5 pl-3 pr-12 text-sm text-zinc-800 transition-colors placeholder:text-zinc-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-zinc-400"
                    />

                    <button
                        type="submit"
                        disabled={
                            loading[selectCategory] ||
                            followUpQuestionInput.trim() === ""
                        }
                        className="absolute right-2 rounded-md bg-zinc-900 p-2 text-white transition-colors hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40">
                        {loading[selectCategory] ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <ArrowUp size={16} />
                        )}
                    </button>
                </form>
            </div>
            )}
        </div>
    );
}
