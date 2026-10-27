"use server";
import { db } from "@/drizzle/db";
import { ReportsTable } from "@/drizzle/schema";
import { LiveChecklistItem, OpenPositionPayload, ReportsEntry, ReportType } from "@/types/tradeAI.types";
import { desc, eq } from "drizzle-orm";
import { ensureLocalUser } from "./user";
import { v4 as uuidv4 } from "uuid";

type ReportsSuccess = {
    success: true;
    reports: ReportsEntry[];
    reportId?: string;
};

type GetReportByIdSuccess = {
    success: true;
    report: ReportType;
};

type ReportError = {
    success: false;
    error: string;
};

type DeleteAddFavoriteReportSuccess = {
    success: true;
};

type ReportsResult = ReportsSuccess | ReportError;
type GetReportByIdResult = GetReportByIdSuccess | ReportError;
type DeleteAddFAvoriteReportResult =
    | DeleteAddFavoriteReportSuccess
    | ReportError;

export async function saveReport(report: ReportType, existingReportId?: string) {
    const userId = "local-user";
    await ensureLocalUser();

    try {
        if (existingReportId) {
            const existing = await db.query.ReportsTable.findFirst({ where: eq(ReportsTable.id, existingReportId) });
            if (!existing || existing.userId !== userId) return { success: false, error: "Report not found" };
            await db.update(ReportsTable).set({ reportData: report }).where(eq(ReportsTable.id, existingReportId));
            return { success: true, reportId: existingReportId };
        }
        const id = uuidv4();
        await db
            .insert(ReportsTable)
            .values({
                id,
                userId,
                reportData: report, // Store the complete report structure as JSON
            });

        return {
            success: true,
            reportId: id,
        };
    } catch (error) {
        console.error("Failed to save report:", error);
        if (error instanceof Error) {
            return { success: false, error: error.message };
        } else {
            return { success: false, error: "Unknown error occurred!" };
        }
    }
}

export async function getReports(): Promise<ReportsResult | null> {
    const userId = "local-user";
    await ensureLocalUser();

    try {
        const reports = await db
            .select()
            .from(ReportsTable)
            .where(eq(ReportsTable.userId, userId))
            .orderBy(desc(ReportsTable.createdAt));

        const reportEntries: ReportsEntry[] = reports.map((report) => {
            const data = report.reportData;
            const checklist: LiveChecklistItem[] = data?.liveExposureChecklist || [];
            const dangerCount = checklist.filter((item) => item.status === "danger").length;
            const warningCount = checklist.filter((item) => item.status === "warning").length;
            const safeCount = checklist.filter((item) => item.status === "safe").length;

            const openPositions = data?.openPositions || [];
            const symbols = Array.from(new Set(openPositions.map((p: OpenPositionPayload) => p.symbolName).filter(Boolean))) as string[];

            const priorityFlag = checklist.find((item) => item.status === "danger")
                ?? checklist.find((item) => item.status === "warning");
            let keyObservation = priorityFlag?.title || priorityFlag?.message || "";
            const mm = data?.moneyManagement || [];
            if (!keyObservation && mm.length > 0 && mm[0]?.content && mm[0].content.length > 0) {
                keyObservation = mm[0].content[0];
            } else if (!keyObservation) {
                const inst = data?.instruments || [];
                if (inst.length > 0 && inst[0]?.content && inst[0].content.length > 0) {
                    keyObservation = inst[0].content[0];
                }
            }

            return {
                reportId: report.id,
                // Keep the raw ISO timestamp for robust client formatting
                createdAt: report.createdAt,
                isFavorite: report.isFavorite,
                numberOfMessages:
                    [...(data?.instruments ?? []), ...(data?.moneyManagement ?? []), ...(data?.timeManagement ?? [])]
                        .reduce((count, message) => count + message.content.length, 0),
                openPositionsCount: data?.portfolioSummary?.totalOpenPositions ?? openPositions.length,
                totalExposure: data?.portfolioSummary?.totalPositionValue ?? 0,
                totalUnrealizedPnL: data?.portfolioSummary?.totalUnrealizedPnL ?? null,
                riskAssessed: checklist.length > 0,
                dangerCount,
                warningCount,
                safeCount,
                keyObservation,
                instruments: symbols,
            };
        });

        return {
            success: true,
            reports: reportEntries,
        };
    } catch (error) {
        console.error("Failed to fetch reports:", error);
        if (error instanceof Error) {
            return { success: false, error: error.message };
        }
        return { success: false, error: "Unknown error occurred!" };
    }
}

export async function getReportById(
    reportId: string | undefined
): Promise<GetReportByIdResult | null> {
    if (!reportId) return null;

    try {
        const report = await db.query.ReportsTable.findFirst({
            where: eq(ReportsTable.id, reportId),
        });

        if (!report) return { success: false, error: "Report not found" };

        return {
            success: true,
            report: report.reportData,
        };
    } catch (error) {
        console.error("Failed to fetch report by id:", error);
        if (error instanceof Error) {
            return { success: false, error: error.message };
        }
        return { success: false, error: "Unknown error occurred!" };
    }
}

export async function addRemoveFavorite(
    reportId: string | undefined
): Promise<DeleteAddFAvoriteReportResult | null> {
    if (!reportId) return null;

    try {
        const report = await db.query.ReportsTable.findFirst({
            where: eq(ReportsTable.id, reportId),
        });

        if (!report) return null;

        await db
            .update(ReportsTable)
            .set({
                isFavorite: !report.isFavorite,
            })
            .where(eq(ReportsTable.id, reportId));

        return {
            success: true,
        };
    } catch (error) {
        console.error("Failed to toggle favorite status:", error);
        if (error instanceof Error) {
            return { success: false, error: error.message };
        }
        return { success: false, error: "Unknown error occurred!" };
    }
}

export async function deleteReportFromDB(
    reportId: string | undefined
): Promise<DeleteAddFAvoriteReportResult | null> {
    if (!reportId) return null;

    try {
        await db.delete(ReportsTable).where(eq(ReportsTable.id, reportId));

        return {
            success: true,
        };
    } catch (error) {
        console.error("Failed to delete report:", error);
        if (error instanceof Error) {
            return { success: false, error: error.message };
        }
        return { success: false, error: "Unknown error occurred!" };
    }
}
