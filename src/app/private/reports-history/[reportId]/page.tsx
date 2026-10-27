"use client";

import { getReportById } from "@/server/actions/archive";
import { checkIfUserHasTokens } from "@/server/actions/user";
import { ReportType } from "@/types/tradeAI.types";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";
import ReportPage from "@/components/tradeAI/ReportPage";
import { Button } from "@/components/ui/button";

export default function Page() {
    const { reportId } = useParams<{ reportId: string }>();
    const [tokens, setTokens] = useState<number | undefined>();
    const [report, setReport] = useState<ReportType | null>(null);
    const [error, setError] = useState("");
    const [attempt, setAttempt] = useState(0);

    useEffect(() => {
        let active = true;
        setReport(null);
        setError("");
        async function fetchData() {
            try {
                const data = await getReportById(reportId);
                if (!active) return;
                if (!data?.success || !data.report) {
                    setError(data && !data.success ? data.error : "Report not found");
                    return;
                }
                setReport(data.report);
                const checkTokens = await checkIfUserHasTokens();
                if (active) setTokens(checkTokens.success ? checkTokens.tokens ?? 0 : 0);
            } catch {
                if (active) setError("This report could not be loaded.");
            }
        }
        void fetchData();
        return () => { active = false; };
    }, [reportId, attempt]);

    if (error) return <div className="p-6">
        <h1 className="text-xl font-semibold">Report unavailable</h1>
        <p role="alert" className="mt-2 text-sm text-zinc-600">{error}</p>
        <div className="mt-4 flex items-center gap-4"><Button variant="outline" onClick={() => setAttempt(attempt + 1)}>Retry</Button><Link href="/private/reports-history" className="text-sm underline underline-offset-4">Back to reports</Link></div>
    </div>;
    if (!report) return <p role="status" className="p-6 text-sm text-zinc-600">Loading report...</p>;
    return <ReportPage key={reportId} reportId={reportId} tokens={tokens} goBackButton="Reports" report={report} setReport={setReport} setTokens={setTokens} openPositions={report.openPositions} portfolioSummary={report.portfolioSummary} />;
}
