"use client";

import React, { Dispatch, SetStateAction, useState, useMemo } from "react";
import { ReportCard } from "./ReportCard";
import { ArrowUp, Loader2 } from "lucide-react";

import { Category, ReportType, OpenPositionPayload, PortfolioRiskSummary } from "@/types/tradeAI.types";
import { toast } from "sonner";
import CustomLoading from "../CustomLoading";
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
    setTokens,
    enrichedTrades,
    openPositions,
    portfolioSummary,
}: GeneratedReportType) {
    const [followUpQuestionInput, setFollowUpQuestionInput] = useState("");

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

    const prevResponse: Record<Category, string> = {
        moneyManagement: JSON.stringify(report?.moneyManagement),
        instruments: JSON.stringify(report?.instruments),
        timeManagement: JSON.stringify(report?.timeManagement),
    };

    const handleFollowUpQuestionSubmit = async (
        e: React.FormEvent<HTMLFormElement> | React.KeyboardEvent<HTMLTextAreaElement>
    ) => {
        e.preventDefault();

        if (followUpQuestionInput.trim() === "") {
            return;
        }

        const tempQuestionStorage = followUpQuestionInput;
        setFollowUpQuestionInput("");

        try {
            setLoading((prevLoading) => ({
                ...prevLoading,
                [selectCategory]: true,
            }));

            setReport((prevReport) => {
                if (
                    prevReport === null ||
                    prevReport[selectCategory] === null
                ) {
                    return null;
                }

                return {
                    ...prevReport,
                    [selectCategory]: [
                        ...prevReport[selectCategory],
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
                    prevResponse: prevResponse[selectCategory],
                }),
            });

            if (!res.ok) {
                const errorMessage = await res.json();
                throw new Error(errorMessage.error);
            }

            const data = await res.json();

            const claudeReport = JSON.parse(data.content[0].text);

            setReport((prevReport) => {
                if (
                    prevReport === null ||
                    prevReport[selectCategory] === null
                ) {
                    return null;
                }

                return {
                    ...prevReport,
                    [selectCategory]: [
                        ...prevReport[selectCategory],
                        { type: "system", content: claudeReport.answer },
                    ],
                };
            });
        } catch (error) {
            console.error(error);
            toast.error("Error occurred while getting answer! Try again later!");
        } finally {
            setLoading((prevLoading) => ({
                ...prevLoading,
                [selectCategory]: false,
            }));
        }
    };

    return (
        <div className="flex flex-col flex-1 justify-between h-full min-h-0 overflow-hidden">
            <div className="flex-1 overflow-y-auto px-4 md:px-8">
                {report && report[selectCategory] ? (
                    <ReportCard items={report[selectCategory]} loading={loading[selectCategory]} />
                ) : (
                    <div className="flex justify-center items-center h-full text-[#3D3929]">
                        Select a category to view the report.
                    </div>
                )}
            </div>

            {/* Sticky Follow-up Question Bar */}
            <div className="px-4 md:px-8 py-3 bg-white/95 backdrop-blur-xs border-t border-neutral-200/80 shrink-0">
                <form
                    onSubmit={handleFollowUpQuestionSubmit}
                    className="relative flex items-center max-w-4xl mx-auto">
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
                        placeholder="Ask a follow-up question about this report..."
                        className="w-full text-sm py-2.5 pl-4 pr-12 rounded-xl bg-neutral-100/80 border border-neutral-200 focus:outline-hidden focus:ring-2 focus:ring-neutral-900 focus:bg-white transition-all resize-none max-h-32 text-neutral-800 placeholder:text-neutral-400"
                    />

                    <button
                        type="submit"
                        disabled={
                            loading[selectCategory] ||
                            followUpQuestionInput.trim() === ""
                        }
                        className="absolute right-2 p-2 bg-neutral-900 text-white rounded-lg hover:bg-neutral-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                        {loading[selectCategory] ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <ArrowUp size={16} />
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
}
