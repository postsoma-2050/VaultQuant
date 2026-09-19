"use client";

import { getReportById } from "@/server/actions/archive";
import { checkIfUserHasTokens } from "@/server/actions/user";
import { ReportType } from "@/types/tradeAI.types";
import { useParams } from "next/navigation";
import React, { useEffect, useState } from "react";
import ReportPage from "@/components/tradeAI/ReportPage";

export default function Page() {
    const params = useParams();
    const reportId = params.reportId;

    const [tokens, setTokens] = useState<number | undefined>();
    const [report, setReport] = useState<ReportType | null>(null);

    useEffect(() => {
        async function fetchData() {
            try {
                const data = await getReportById(reportId as string);
                if (data?.success) {
                    setReport(data.report);
                }
                const checkTokens = await checkIfUserHasTokens();
                if (checkTokens.success && checkTokens.tokens) {
                    setTokens(checkTokens.tokens);
                } else {
                    setTokens(0);
                }
            } catch (err) {
                console.log(err);
            }
        }
        fetchData();
    }, [reportId]);
    return (
        <ReportPage
            tokens={tokens}
            goBackButton="Archive"
            report={report}
            setReport={setReport}
            setTokens={setTokens}
            openPositions={report?.openPositions}
            portfolioSummary={report?.portfolioSummary}
        />
    );
}
