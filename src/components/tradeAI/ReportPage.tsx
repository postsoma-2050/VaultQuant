"use client";

import React, { useRef, useState } from "react";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import Link from "next/link";
import { ArrowUpLeft } from "lucide-react";
import { CustomButton } from "../CustomButton";
import GeneratedReport from "./GeneratedReport";
import { Category, ReportType, OpenPositionPayload, PortfolioRiskSummary } from "@/types/tradeAI.types";
import { saveReport } from "@/server/actions/archive";
import { toast } from "sonner";
import CategoryInfoTip from "./CategoryInfoTip";
import LiveExposureChecklist from "./LiveExposureChecklist";

import { Trades } from "@/types";

interface ReportPageProps {
    goBackButton: string;
    backHref?: string;
    reportId?: string;
    tokens?: number | undefined;
    report: ReportType | null;
    setReport: React.Dispatch<React.SetStateAction<ReportType | null>>;
    setTokens?: React.Dispatch<React.SetStateAction<number | undefined>>;
    enrichedTrades?: Trades[] | null;
    openPositions?: OpenPositionPayload[] | null;
    portfolioSummary?: PortfolioRiskSummary | null;
}

export default function ReportPage({
    goBackButton,
    backHref = "/private/reports-history",
    reportId,
    report,
    setReport,
    setTokens,
    enrichedTrades,
    openPositions,
    portfolioSummary,
}: ReportPageProps) {
    const [selectCategory, setSelectCategory] =
        useState<Category>("moneyManagement");
    const [isSaving, setIsSaving] = useState(false);
    const [savedId, setSavedId] = useState(reportId);
    const [savedSnapshot, setSavedSnapshot] = useState<string | null>(reportId && report ? JSON.stringify(report) : null);
    const saving = useRef(false);
    const hasSaved = savedSnapshot !== null && savedSnapshot === JSON.stringify(report);

    const handleSaveReport = async () => {
        if (!report || saving.current || hasSaved) return;
        saving.current = true;
        setIsSaving(true);
        try {
            const snapshot = JSON.stringify(report);
            const response = await saveReport(report, savedId);
            if (response && response.success) {
                setSavedId(response.reportId);
                setSavedSnapshot(snapshot);
                toast.success("The report has been saved successfully!");
            } else {
                toast.error("Failed to save report. Please try again.");
            }
        } catch {
            toast.error("An error occurred while saving the report.");
        } finally {
            saving.current = false;
            setIsSaving(false);
        }
    };

    // Connect data pipeline: read from props or from report object (for archived reports)
    const checklist = report?.liveExposureChecklist;
    const summary = portfolioSummary ?? report?.portfolioSummary ?? null;
    const positions = openPositions ?? report?.openPositions ?? null;

    if (report) {
        return (
            <div className="flex h-full min-h-0 min-w-0 flex-col">
                <div className="relative flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-4 py-3 md:px-8">
                    <Link
                        href={backHref}
                        className="relative group inline-block cursor-pointer">
                        <div className="flex items-center gap-2 text-sm text-zinc-600 hover:text-zinc-900">
                            <ArrowUpLeft size={16} />
                            {goBackButton}
                        </div>
                    </Link>

                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                        <Select
                            value={selectCategory}
                            onValueChange={(value: Category) =>
                                setSelectCategory(value)
                            }>
                            <SelectTrigger className="h-9 w-[180px] rounded-md border-zinc-200 font-medium text-zinc-700 hover:bg-zinc-50">
                                <SelectValue placeholder="Choose category" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectGroup>
                                    <SelectItem value="moneyManagement">
                                        Money management
                                    </SelectItem>
                                    <SelectItem value="instruments">
                                        Instruments
                                    </SelectItem>
                                    <SelectItem value="timeManagement">
                                        Time management
                                    </SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                        <CustomButton
                            onClick={handleSaveReport}
                            disabled={isSaving || hasSaved}
                            className="h-9"
                            isBlack={false}>
                            {isSaving ? "Saving..." : hasSaved ? "Saved" : savedId ? "Save changes" : "Save report"}
                        </CustomButton>
                    </div>
                </div>

                {/* Real-time Open Positions Risk & Safety Checklist */}
                <LiveExposureChecklist
                    checklist={checklist}
                    portfolioSummary={summary}
                    openPositions={positions}
                />

                {/* Info tip explaining the selected category */}
                <CategoryInfoTip category={selectCategory} />

                <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
                    <GeneratedReport
                        report={report}
                        setReport={setReport}
                        setTokens={setTokens}
                        selectCategory={selectCategory}
                        enrichedTrades={enrichedTrades}
                        openPositions={positions}
                        portfolioSummary={summary}
                    />
                </div>
            </div>
        );
    } else {
        return (
            <div className="flex min-h-full items-center justify-center p-6">
                <p className="text-sm text-zinc-500">No report is available.</p>
            </div>
        );
    }
}
