"use server";

import { db } from "@/drizzle/db";
import { TradeTable, JournalTable, StrategyTable } from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { ensureLocalUser } from "./user";
import { sanitizeTransactions } from "@/services/import/sanitizer";
import { clusterTransactionsIntoCampaigns } from "@/services/import/campaignEngine";
import { parseCSVString, convertCSVRecordsToRawTransactions, exportTradesToCSV } from "@/services/import/csvParser";
import { revalidatePath } from "next/cache";
import { Trades } from "@/types";

export interface ImportResult {
    success: boolean;
    importedCount: number;
    error?: string;
    trades?: Trades[];
}

export interface ImportPreviewResult {
    success: boolean;
    rawRecordCount: number;
    sanitizedCount: number;
    campaigns: Trades[];
    error?: string;
}

/**
 * Ghostfolio-style Dry Run Preview Action:
 * Parses CSV/JSON file and returns detected campaigns for user inspection BEFORE database write.
 */
export async function previewImportAction(
    fileContent: string,
    fileType: "csv" | "json"
): Promise<ImportPreviewResult> {
    try {
        let compiledTrades: Trades[] = [];
        let rawRecordCount = 0;
        let sanitizedCount = 0;

        if (fileType === "json") {
            const parsed = JSON.parse(fileContent);
            if (Array.isArray(parsed)) {
                rawRecordCount = parsed.length;
                if (parsed.length > 0 && "symbolName" in parsed[0]) {
                    compiledTrades = parsed as Trades[];
                    sanitizedCount = parsed.length;
                } else {
                    const sanitized = sanitizeTransactions(parsed);
                    sanitizedCount = sanitized.length;
                    compiledTrades = clusterTransactionsIntoCampaigns(sanitized);
                }
            } else if (parsed.trades && Array.isArray(parsed.trades)) {
                rawRecordCount = parsed.trades.length;
                compiledTrades = parsed.trades as Trades[];
                sanitizedCount = parsed.trades.length;
            } else {
                return { success: false, rawRecordCount: 0, sanitizedCount: 0, campaigns: [], error: "Invalid JSON format" };
            }
        } else {
            const csvRecords = parseCSVString(fileContent);
            rawRecordCount = csvRecords.length;
            if (csvRecords.length === 0) {
                return { success: false, rawRecordCount: 0, sanitizedCount: 0, campaigns: [], error: "Empty or invalid CSV file" };
            }

            if (csvRecords[0]["symbolName"] && csvRecords[0]["positionType"]) {
                compiledTrades = csvRecords.map((r) => {
                    let parsedCloseEvents = undefined;
                    if (r.closeEvents && r.closeEvents.trim() !== "") {
                        try {
                            parsedCloseEvents = JSON.parse(r.closeEvents);
                        } catch {
                            parsedCloseEvents = undefined;
                        }
                    }
                    let parsedOpenOther = undefined;
                    if (r.openOtherDetails && r.openOtherDetails.trim() !== "") {
                        try {
                            parsedOpenOther = JSON.parse(r.openOtherDetails);
                        } catch {
                            parsedOpenOther = undefined;
                        }
                    }
                    return {
                        id: r.id || `trade-${Date.now()}-${Math.random()}`,
                        symbolName: r.symbolName,
                        instrumentName: r.symbolName,
                        positionType: r.positionType as "buy" | "sell",
                        openDate: r.openDate,
                        openTime: r.openTime || "09:30:00",
                        closeDate: r.closeDate || undefined,
                        closeTime: r.closeTime || undefined,
                        entryPrice: r.entryPrice || undefined,
                        quantity: r.quantity || undefined,
                        sellPrice: r.sellPrice || undefined,
                        result: r.result || undefined,
                        isActiveTrade: r.isActiveTrade === "true",
                        notes: r.notes || undefined,
                        rating: 0,
                        closeEvents: parsedCloseEvents,
                        openOtherDetails: parsedOpenOther,
                    };
                });
                sanitizedCount = compiledTrades.length;
            } else {
                const rawTxList = convertCSVRecordsToRawTransactions(csvRecords);
                const sanitized = sanitizeTransactions(rawTxList);
                sanitizedCount = sanitized.length;
                compiledTrades = clusterTransactionsIntoCampaigns(sanitized);
            }
        }

        return {
            success: true,
            rawRecordCount,
            sanitizedCount,
            campaigns: compiledTrades,
        };
    } catch (err: unknown) {
        return {
            success: false,
            rawRecordCount: 0,
            sanitizedCount: 0,
            campaigns: [],
            error: err instanceof Error ? err.message : "Failed to preview file",
        };
    }
}

/**
 * Process CSV or JSON file data:
 * 1. Parse raw text
 * 2. Sanitize transactions
 * 3. Run Campaign Clustering Engine
 * 4. Bulk insert into SQLite database (Upsert or Clean Re-sync)
 * 5. Revalidate Next.js cache
 */
export async function importTradesAction(
    fileContent: string,
    fileType: "csv" | "json",
    clearExisting: boolean = false
): Promise<ImportResult> {
    await ensureLocalUser();
    const userId = "local-user";

    if (clearExisting) {
        await db.delete(TradeTable).where(eq(TradeTable.userId, userId));
    }

    try {
        const preview = await previewImportAction(fileContent, fileType);
        if (!preview.success || preview.campaigns.length === 0) {
            return { success: false, importedCount: 0, error: preview.error || "No valid trades found to import" };
        }

        const compiledTrades = preview.campaigns;

        // Bulk insert into SQLite TradeTable
        for (const trade of compiledTrades) {
            let notes = trade.notes;
            if (notes && notes.trim() !== "") {
                try {
                    JSON.parse(notes);
                } catch {
                    notes = JSON.stringify([
                        {
                            id: `note-${Date.now()}`,
                            createdAt: new Date().toISOString(),
                            text: notes,
                            category: "general",
                        },
                    ]);
                }
            }

            await db
                .insert(TradeTable)
                .values({
                    id: trade.id,
                    userId,
                    symbolName: trade.symbolName,
                    instrumentName: trade.instrumentName || trade.symbolName,
                    positionType: trade.positionType,
                    openDate: trade.openDate,
                    openTime: trade.openTime,
                    closeDate: trade.closeDate || null,
                    closeTime: trade.closeTime || null,
                    isActiveTrade: trade.isActiveTrade,
                    entryPrice: trade.entryPrice || null,
                    deposit: trade.deposit || null,
                    result: trade.result || null,
                    totalCost: trade.totalCost || null,
                    quantity: trade.quantity || null,
                    sellPrice: trade.sellPrice || null,
                    quantitySold: trade.quantitySold || null,
                    notes: notes || null,
                    rating: trade.rating || 0,
                    strategyId: trade.strategyId || null,
                    appliedOpenRules: trade.appliedOpenRules || null,
                    appliedCloseRules: trade.appliedCloseRules || null,
                    closeEvents: trade.closeEvents || null,
                    openOtherDetails: trade.openOtherDetails || null,
                    closeOtherDetails: trade.closeOtherDetails || null,
                })
                .onConflictDoUpdate({
                    target: TradeTable.id,
                    set: {
                        symbolName: trade.symbolName,
                        entryPrice: trade.entryPrice || null,
                        quantity: trade.quantity || null,
                        sellPrice: trade.sellPrice || null,
                        result: trade.result || null,
                        isActiveTrade: trade.isActiveTrade,
                        closeEvents: trade.closeEvents || null,
                    },
                });
        }

        // Revalidate Next.js cache for core routes
        revalidatePath("/private/history");
        revalidatePath("/private/calendar");
        revalidatePath("/private/journal");
        revalidatePath("/private/statistics");

        return {
            success: true,
            importedCount: compiledTrades.length,
            trades: compiledTrades,
        };
    } catch (error: unknown) {
        console.error("Failed to import trades:", error);
        return {
            success: false,
            importedCount: 0,
            error: error instanceof Error ? error.message : "Failed to process import file",
        };
    }
}

/**
 * Export all user trades to CSV format (RFC 4180).
 */
export async function exportTradesCSVAction(): Promise<string> {
    const userTrades = await db.query.TradeTable.findMany({
        where: eq(TradeTable.userId, "local-user"),
    });

    const typedTrades: Trades[] = userTrades.map((t) => ({
        id: t.id,
        symbolName: t.symbolName,
        instrumentName: t.instrumentName || t.symbolName,
        positionType: t.positionType as "buy" | "sell",
        openDate: t.openDate,
        openTime: t.openTime,
        closeDate: t.closeDate || undefined,
        closeTime: t.closeTime || undefined,
        isActiveTrade: t.isActiveTrade,
        entryPrice: t.entryPrice || undefined,
        deposit: t.deposit || undefined,
        totalCost: t.totalCost || undefined,
        quantity: t.quantity || undefined,
        sellPrice: t.sellPrice || undefined,
        quantitySold: t.quantitySold || undefined,
        result: t.result || undefined,
        notes: t.notes || undefined,
        rating: t.rating || 0,
        strategyId: t.strategyId || null,
        closeEvents: t.closeEvents || undefined,
        openOtherDetails: t.openOtherDetails || undefined,
        closeOtherDetails: t.closeOtherDetails || undefined,
    }));

    return exportTradesToCSV(typedTrades);
}

/**
 * Export full backup as JSON (Trades, Journals, Strategies).
 */
export async function exportFullBackupAction(): Promise<string> {
    const trades = await db.query.TradeTable.findMany({
        where: eq(TradeTable.userId, "local-user"),
    });
    const journals = await db.query.JournalTable.findMany({
        where: eq(JournalTable.userId, "local-user"),
    });
    const strategies = await db.query.StrategyTable.findMany({
        where: eq(StrategyTable.userId, "local-user"),
    });

    const backup = {
        version: "1.0.0",
        exportedAt: new Date().toISOString(),
        trades,
        journals,
        strategies,
    };

    return JSON.stringify(backup, null, 2);
}
