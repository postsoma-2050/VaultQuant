"use server";

import { db } from "@/drizzle/db";
import {
    JournalTable,
    ReportsTable,
    StrategyTable,
    TradeTable,
    UserTable,
} from "@/drizzle/schema";
import { eq } from "drizzle-orm";
import { ensureLocalUser } from "./user";
import { sanitizeTransactions, type RawTransaction } from "@/services/import/sanitizer";
import { clusterTransactionsIntoCampaigns } from "@/services/import/campaignEngine";
import { parseCSVString, convertCSVRecordsToRawTransactions, exportTradesToCSV } from "@/services/import/csvParser";
import { revalidatePath } from "next/cache";
import { Trades } from "@/types";

const LOCAL_USER_ID = "local-user";

type TradeInsert = typeof TradeTable.$inferInsert;
type StrategyInsert = typeof StrategyTable.$inferInsert;
type JournalInsert = typeof JournalTable.$inferInsert;
type ReportInsert = typeof ReportsTable.$inferInsert;
type UserInsert = typeof UserTable.$inferInsert;

export interface ImportEntityCounts {
    trades: number;
    strategies: number;
    journals: number;
    reports: number;
    users: number;
}

export interface ImportResult {
    success: boolean;
    importedCount: number;
    counts: ImportEntityCounts;
    error?: string;
    trades?: Trades[];
}

export interface ImportPreviewResult {
    success: boolean;
    rawRecordCount: number;
    sanitizedCount: number;
    campaigns: Trades[];
    entityCounts: ImportEntityCounts;
    isFullBackup: boolean;
    error?: string;
}

interface ParsedBackup {
    user?: UserInsert;
    trades?: TradeInsert[];
    strategies?: StrategyInsert[];
    journals?: JournalInsert[];
    reports?: ReportInsert[];
}

interface ParsedImport {
    rawRecordCount: number;
    sanitizedCount: number;
    campaigns: Trades[];
    entityCounts: ImportEntityCounts;
    isFullBackup: boolean;
    backup?: ParsedBackup;
}

const EMPTY_COUNTS: ImportEntityCounts = {
    trades: 0,
    strategies: 0,
    journals: 0,
    reports: 0,
    users: 0,
};

const BACKUP_KEYS = new Set([
    "version",
    "exportedAt",
    "user",
    "trades",
    "strategies",
    "journals",
    "reports",
]);

class ImportValidationError extends Error {}

function fail(message: string): never {
    throw new ImportValidationError(message);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
    if (!isRecord(value)) fail(`${label} must be an object`);
    return value;
}

function requireString(
    record: Record<string, unknown>,
    key: string,
    label: string,
    allowEmpty = false
): string {
    const value = record[key];
    if (typeof value !== "string" || (!allowEmpty && value.trim() === "")) {
        fail(`${label}.${key} must be ${allowEmpty ? "a string" : "a non-empty string"}`);
    }
    return value;
}

function optionalNullableString(
    record: Record<string, unknown>,
    key: string,
    label: string
): string | null | undefined {
    const value = record[key];
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== "string") fail(`${label}.${key} must be a string or null`);
    return value;
}

function optionalNullableNumber(
    record: Record<string, unknown>,
    key: string,
    label: string
): number | null | undefined {
    const value = record[key];
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (typeof value !== "number" || !Number.isFinite(value)) {
        fail(`${label}.${key} must be a finite number or null`);
    }
    return value;
}

function requireBoolean(
    record: Record<string, unknown>,
    key: string,
    label: string,
    fallback?: boolean
): boolean {
    const value = record[key];
    if (value === undefined && fallback !== undefined) return fallback;
    if (typeof value !== "boolean") fail(`${label}.${key} must be a boolean`);
    return value;
}

function optionalStringArray(
    record: Record<string, unknown>,
    key: string,
    label: string
): string[] | undefined {
    const value = record[key];
    if (value === undefined || value === null) return undefined;
    if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
        fail(`${label}.${key} must be an array of strings`);
    }
    return value;
}

function optionalArray<T = unknown>(
    record: Record<string, unknown>,
    key: string,
    label: string
): T[] | null | undefined {
    const value = record[key];
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (!Array.isArray(value)) fail(`${label}.${key} must be an array or null`);
    return value as T[];
}

function optionalRecord(
    record: Record<string, unknown>,
    key: string,
    label: string
): Record<string, string> | null | undefined {
    const value = record[key];
    if (value === undefined) return undefined;
    if (value === null) return null;
    if (!isRecord(value)) fail(`${label}.${key} must be an object or null`);
    if (Object.values(value).some((entry) => typeof entry !== "string")) {
        fail(`${label}.${key} must contain string values`);
    }
    return value as Record<string, string>;
}

function requireArraySection(
    backup: Record<string, unknown>,
    key: "trades" | "strategies" | "journals" | "reports"
): unknown[] | undefined {
    if (!Object.prototype.hasOwnProperty.call(backup, key)) return undefined;
    const value = backup[key];
    if (!Array.isArray(value)) fail(`Backup section "${key}" must be an array`);
    return value;
}

function assertUniqueIds(items: Array<{ id: string }>, label: string): void {
    const ids = new Set<string>();
    for (const item of items) {
        if (ids.has(item.id)) fail(`${label} contains duplicate id "${item.id}"`);
        ids.add(item.id);
    }
}

function validateBackupUser(value: unknown): UserInsert {
    const item = requireRecord(value, "Backup user");
    const id = requireString(item, "id", "Backup user");
    if (id !== LOCAL_USER_ID) {
        fail(`Backup user id must be "${LOCAL_USER_ID}"`);
    }

    return {
        id: LOCAL_USER_ID,
        name: requireString(item, "name", "Backup user", true),
        email: requireString(item, "email", "Backup user", true),
        capital: optionalNullableString(item, "capital", "Backup user") ?? null,
        createdAt: requireString(item, "createdAt", "Backup user"),
        tokens: optionalNullableNumber(item, "tokens", "Backup user") ?? null,
        onboardingCompleted: requireBoolean(item, "onboardingCompleted", "Backup user", false),
        openCustomFieldNames: optionalStringArray(item, "openCustomFieldNames", "Backup user") ?? [],
        closeCustomFieldNames: optionalStringArray(item, "closeCustomFieldNames", "Backup user") ?? [],
    };
}

function validateBackupTrade(value: unknown, index: number): TradeInsert {
    const label = `Backup trades[${index}]`;
    const item = requireRecord(value, label);

    return {
        id: requireString(item, "id", label),
        userId: LOCAL_USER_ID,
        positionType: requireString(item, "positionType", label),
        openDate: requireString(item, "openDate", label),
        openTime: requireString(item, "openTime", label),
        closeDate: optionalNullableString(item, "closeDate", label) ?? null,
        closeTime: optionalNullableString(item, "closeTime", label) ?? null,
        isActiveTrade: requireBoolean(item, "isActiveTrade", label),
        instrumentName: optionalNullableString(item, "instrumentName", label) ?? null,
        symbolName: requireString(item, "symbolName", label),
        entryPrice: optionalNullableString(item, "entryPrice", label) ?? null,
        deposit: optionalNullableString(item, "deposit", label) ?? null,
        result: optionalNullableString(item, "result", label) ?? null,
        totalCost: optionalNullableString(item, "totalCost", label) ?? null,
        quantity: optionalNullableString(item, "quantity", label) ?? null,
        sellPrice: optionalNullableString(item, "sellPrice", label) ?? null,
        quantitySold: optionalNullableString(item, "quantitySold", label) ?? null,
        notes: optionalNullableString(item, "notes", label) ?? null,
        rating: optionalNullableNumber(item, "rating", label) ?? 0,
        strategyId: optionalNullableString(item, "strategyId", label) ?? null,
        appliedOpenRules: optionalArray(item, "appliedOpenRules", label) ?? null,
        appliedCloseRules: optionalArray(item, "appliedCloseRules", label) ?? null,
        closeEvents: optionalArray(item, "closeEvents", label) ?? null,
        openOtherDetails: optionalRecord(item, "openOtherDetails", label) ?? null,
        closeOtherDetails: optionalRecord(item, "closeOtherDetails", label) ?? null,
    };
}

function validateBackupStrategy(value: unknown, index: number): StrategyInsert {
    const label = `Backup strategies[${index}]`;
    const item = requireRecord(value, label);

    return {
        id: requireString(item, "id", label),
        userId: LOCAL_USER_ID,
        strategyName: requireString(item, "strategyName", label),
        description: optionalNullableString(item, "description", label) ?? null,
        openPositionRules: optionalArray(item, "openPositionRules", label) ?? [],
        closePositionRules: optionalArray(item, "closePositionRules", label) ?? [],
        createdAt: requireString(item, "createdAt", label),
        updatedAt: requireString(item, "updatedAt", label),
    };
}

function validateBackupJournal(value: unknown, index: number): JournalInsert {
    const label = `Backup journals[${index}]`;
    const item = requireRecord(value, label);
    const content = item.content;
    if (content === undefined) fail(`${label}.content is required`);

    return {
        id: requireString(item, "id", label),
        userId: LOCAL_USER_ID,
        date: requireString(item, "date", label),
        content,
        createdAt: requireString(item, "createdAt", label),
        updatedAt: requireString(item, "updatedAt", label),
    };
}

function validateBackupReport(value: unknown, index: number): ReportInsert {
    const label = `Backup reports[${index}]`;
    const item = requireRecord(value, label);
    const reportData = requireRecord(item.reportData, `${label}.reportData`);
    for (const key of ["moneyManagement", "instruments", "timeManagement"]) {
        if (!(key in reportData)) {
            fail(`${label}.reportData.${key} is required`);
        }
    }

    return {
        id: requireString(item, "id", label),
        userId: LOCAL_USER_ID,
        createdAt: requireString(item, "createdAt", label),
        reportData: reportData as ReportInsert["reportData"],
        isFavorite: requireBoolean(item, "isFavorite", label, false),
    };
}

function parseFullBackup(raw: Record<string, unknown>): ParsedImport {
    const unknownKeys = Object.keys(raw).filter((key) => !BACKUP_KEYS.has(key));
    if (unknownKeys.length > 0) {
        fail(`Unsupported backup section(s): ${unknownKeys.join(", ")}. Restore aborted.`);
    }

    const requiredKeys = ["user", "trades", "strategies", "journals", "reports"] as const;
    const missingKeys = requiredKeys.filter(
        (key) => !Object.prototype.hasOwnProperty.call(raw, key) || raw[key] === null
    );
    if (missingKeys.length > 0) {
        fail(`Full backup is missing required section(s): ${missingKeys.join(", ")}. Restore aborted.`);
    }

    if (raw.version !== undefined && typeof raw.version !== "string") {
        fail("Backup version must be a string");
    }
    if (raw.exportedAt !== undefined && typeof raw.exportedAt !== "string") {
        fail("Backup exportedAt must be a string");
    }

    const tradesRaw = requireArraySection(raw, "trades");
    const strategiesRaw = requireArraySection(raw, "strategies");
    const journalsRaw = requireArraySection(raw, "journals");
    const reportsRaw = requireArraySection(raw, "reports");

    const trades = tradesRaw!.map(validateBackupTrade);
    const strategies = strategiesRaw!.map(validateBackupStrategy);
    const journals = journalsRaw!.map(validateBackupJournal);
    const reports = reportsRaw!.map(validateBackupReport);
    const user = validateBackupUser(raw.user);

    if (trades) assertUniqueIds(trades, "Backup trades");
    if (strategies) assertUniqueIds(strategies, "Backup strategies");
    if (journals) assertUniqueIds(journals, "Backup journals");
    if (reports) assertUniqueIds(reports, "Backup reports");

    const entityCounts: ImportEntityCounts = {
        trades: trades.length,
        strategies: strategies.length,
        journals: journals.length,
        reports: reports.length,
        users: 1,
    };
    const totalEntities = Object.values(entityCounts).reduce((sum, count) => sum + count, 0);

    return {
        rawRecordCount: totalEntities,
        sanitizedCount: entityCounts.trades,
        campaigns: trades.map(backupTradeToPreview),
        entityCounts,
        isFullBackup: true,
        backup: { user, trades, strategies, journals, reports },
    };
}

function backupTradeToPreview(trade: TradeInsert): Trades {
    return {
        id: trade.id,
        symbolName: trade.symbolName,
        instrumentName: trade.instrumentName ?? trade.symbolName,
        positionType: trade.positionType,
        openDate: trade.openDate,
        openTime: trade.openTime,
        closeDate: trade.closeDate ?? undefined,
        closeTime: trade.closeTime ?? undefined,
        isActiveTrade: trade.isActiveTrade ?? true,
        entryPrice: trade.entryPrice ?? undefined,
        deposit: trade.deposit ?? undefined,
        totalCost: trade.totalCost ?? undefined,
        quantity: trade.quantity ?? undefined,
        sellPrice: trade.sellPrice ?? undefined,
        quantitySold: trade.quantitySold ?? undefined,
        result: trade.result ?? undefined,
        notes: trade.notes ?? undefined,
        rating: trade.rating ?? 0,
        strategyId: trade.strategyId ?? null,
        appliedOpenRules: trade.appliedOpenRules ?? undefined,
        appliedCloseRules: trade.appliedCloseRules ?? undefined,
        closeEvents: trade.closeEvents ?? undefined,
        openOtherDetails: trade.openOtherDetails ?? undefined,
        closeOtherDetails: trade.closeOtherDetails ?? undefined,
    };
}

function validateCampaigns(campaigns: Trades[]): Trades[] {
    campaigns.forEach((campaign, index) => {
        const label = `Imported trade[${index}]`;
        if (!isRecord(campaign)) fail(`${label} must be an object`);
        requireString(campaign as unknown as Record<string, unknown>, "id", label);
        requireString(campaign as unknown as Record<string, unknown>, "symbolName", label);
        requireString(campaign as unknown as Record<string, unknown>, "positionType", label);
        requireString(campaign as unknown as Record<string, unknown>, "openDate", label);
        requireString(campaign as unknown as Record<string, unknown>, "openTime", label);
        if (typeof campaign.isActiveTrade !== "boolean") {
            fail(`${label}.isActiveTrade must be a boolean`);
        }
    });
    assertUniqueIds(campaigns, "Imported trades");
    return campaigns;
}

function parseJsonContent(fileContent: string): ParsedImport {
    let parsed: unknown;
    try {
        parsed = JSON.parse(fileContent);
    } catch (error) {
        fail(error instanceof Error ? `Invalid JSON: ${error.message}` : "Invalid JSON");
    }

    if (Array.isArray(parsed)) {
        if (parsed.length === 0) fail("Empty JSON file");

        const allBackupTrades = parsed.every(
            (item) => isRecord(item) && typeof item.symbolName === "string"
        );

        let campaigns: Trades[];
        if (allBackupTrades) {
            const trades = parsed.map(validateBackupTrade);
            assertUniqueIds(trades, "Imported trades");
            campaigns = trades.map(backupTradeToPreview);
        } else {
            const sanitized = sanitizeTransactions(parsed as RawTransaction[]);
            if (sanitized.length === 0) fail("No valid trades found in JSON file");
            campaigns = validateCampaigns(clusterTransactionsIntoCampaigns(sanitized));
        }

        return {
            rawRecordCount: parsed.length,
            sanitizedCount: campaigns.length,
            campaigns,
            entityCounts: { ...EMPTY_COUNTS, trades: campaigns.length },
            isFullBackup: false,
        };
    }

    if (!isRecord(parsed)) fail("Invalid JSON format");

    const unknownKeys = Object.keys(parsed).filter((key) => !BACKUP_KEYS.has(key));
    if (unknownKeys.length > 0) {
        fail(`Unsupported JSON section(s): ${unknownKeys.join(", ")}. Import aborted.`);
    }

    const isFullBackup =
        parsed.version !== undefined ||
        parsed.exportedAt !== undefined ||
        parsed.user !== undefined ||
        parsed.strategies !== undefined ||
        parsed.journals !== undefined ||
        parsed.reports !== undefined;

    if (isFullBackup) return parseFullBackup(parsed);

    if (!Array.isArray(parsed.trades)) {
        fail("Invalid JSON format: expected a trades array or a full backup");
    }
    if (parsed.trades.length === 0) fail("No valid trades found in JSON file");

    const trades = parsed.trades.map(validateBackupTrade);
    assertUniqueIds(trades, "Imported trades");
    const campaigns = trades.map(backupTradeToPreview);

    return {
        rawRecordCount: parsed.trades.length,
        sanitizedCount: campaigns.length,
        campaigns,
        entityCounts: { ...EMPTY_COUNTS, trades: campaigns.length },
        isFullBackup: false,
    };
}

function parseCsvContent(fileContent: string): ParsedImport {
    const csvRecords = parseCSVString(fileContent);
    if (csvRecords.length === 0) {
        fail("Empty or invalid CSV file");
    }

    let campaigns: Trades[];
    if (csvRecords[0]["symbolName"] && csvRecords[0]["positionType"]) {
        campaigns = csvRecords.map((record) => {
            let parsedCloseEvents = undefined;
            if (record.closeEvents && record.closeEvents.trim() !== "") {
                try {
                    parsedCloseEvents = JSON.parse(record.closeEvents);
                } catch {
                    parsedCloseEvents = undefined;
                }
            }
            let parsedOpenOther = undefined;
            if (record.openOtherDetails && record.openOtherDetails.trim() !== "") {
                try {
                    parsedOpenOther = JSON.parse(record.openOtherDetails);
                } catch {
                    parsedOpenOther = undefined;
                }
            }
            return {
                id: record.id || `trade-${Date.now()}-${Math.random()}`,
                symbolName: record.symbolName,
                instrumentName: record.symbolName,
                positionType: record.positionType as "buy" | "sell",
                openDate: record.openDate,
                openTime: record.openTime || "09:30:00",
                closeDate: record.closeDate || undefined,
                closeTime: record.closeTime || undefined,
                entryPrice: record.entryPrice || undefined,
                quantity: record.quantity || undefined,
                sellPrice: record.sellPrice || undefined,
                result: record.result || undefined,
                isActiveTrade: record.isActiveTrade === "true",
                notes: record.notes || undefined,
                rating: 0,
                closeEvents: parsedCloseEvents,
                openOtherDetails: parsedOpenOther,
            };
        });
        validateCampaigns(campaigns);
    } else {
        const rawTransactions = convertCSVRecordsToRawTransactions(csvRecords);
        const sanitized = sanitizeTransactions(rawTransactions);
        if (sanitized.length === 0) fail("No valid trades found in CSV file");
        campaigns = validateCampaigns(clusterTransactionsIntoCampaigns(sanitized));
    }

    return {
        rawRecordCount: csvRecords.length,
        sanitizedCount: campaigns.length,
        campaigns,
        entityCounts: { ...EMPTY_COUNTS, trades: campaigns.length },
        isFullBackup: false,
    };
}

function parseImportContent(fileContent: string, fileType: "csv" | "json"): ParsedImport {
    if (fileType === "json") return parseJsonContent(fileContent);
    return parseCsvContent(fileContent);
}

function emptyPreview(error: string): ImportPreviewResult {
    return {
        success: false,
        rawRecordCount: 0,
        sanitizedCount: 0,
        campaigns: [],
        entityCounts: { ...EMPTY_COUNTS },
        isFullBackup: false,
        error,
    };
}

/**
 * Dry-run preview. Parsing and validation happen here without touching the database.
 */
export async function previewImportAction(
    fileContent: string,
    fileType: "csv" | "json"
): Promise<ImportPreviewResult> {
    try {
        const parsed = parseImportContent(fileContent, fileType);
        return {
            success: true,
            rawRecordCount: parsed.rawRecordCount,
            sanitizedCount: parsed.sanitizedCount,
            campaigns: parsed.campaigns,
            entityCounts: parsed.entityCounts,
            isFullBackup: parsed.isFullBackup,
        };
    } catch (error: unknown) {
        return emptyPreview(error instanceof Error ? error.message : "Failed to preview file");
    }
}

function normalizeCampaignNotes(notes: string | undefined): string | null {
    if (!notes || notes.trim() === "") return null;
    try {
        JSON.parse(notes);
        return notes;
    } catch {
        return JSON.stringify([
            {
                id: `note-${Date.now()}`,
                createdAt: new Date().toISOString(),
                text: notes,
                category: "general",
            },
        ]);
    }
}

function campaignToTradeInsert(trade: Trades): TradeInsert {
    return {
        id: trade.id,
        userId: LOCAL_USER_ID,
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
        notes: normalizeCampaignNotes(trade.notes),
        rating: trade.rating ?? 0,
        strategyId: trade.strategyId || null,
        appliedOpenRules: trade.appliedOpenRules ?? null,
        appliedCloseRules: trade.appliedCloseRules ?? null,
        closeEvents: trade.closeEvents ?? null,
        openOtherDetails: trade.openOtherDetails ?? null,
        closeOtherDetails: trade.closeOtherDetails ?? null,
    };
}

function tradeConflictValues(trade: TradeInsert) {
    return {
        positionType: trade.positionType,
        openDate: trade.openDate,
        openTime: trade.openTime,
        closeDate: trade.closeDate ?? null,
        closeTime: trade.closeTime ?? null,
        isActiveTrade: trade.isActiveTrade,
        instrumentName: trade.instrumentName ?? null,
        symbolName: trade.symbolName,
        entryPrice: trade.entryPrice ?? null,
        deposit: trade.deposit ?? null,
        result: trade.result ?? null,
        totalCost: trade.totalCost ?? null,
        quantity: trade.quantity ?? null,
        sellPrice: trade.sellPrice ?? null,
        quantitySold: trade.quantitySold ?? null,
        notes: trade.notes ?? null,
        rating: trade.rating ?? 0,
        strategyId: trade.strategyId ?? null,
        appliedOpenRules: trade.appliedOpenRules ?? null,
        appliedCloseRules: trade.appliedCloseRules ?? null,
        closeEvents: trade.closeEvents ?? null,
        openOtherDetails: trade.openOtherDetails ?? null,
        closeOtherDetails: trade.closeOtherDetails ?? null,
    };
}

function tryRevalidateImportPaths(): void {
    for (const path of [
        "/private/history",
        "/private/calendar",
        "/private/journal",
        "/private/statistics",
        "/private/reports-history",
    ]) {
        try {
            revalidatePath(path);
        } catch {
            // Tests and scripts can invoke the action outside a Next.js request context.
        }
    }
}

/**
 * Import trade files or restore a full backup.
 *
 * Parsing and validation complete before any write. Replace mode deletes and
 * restores only the sections present in the input, all inside one transaction.
 */
export async function importTradesAction(
    fileContent: string,
    fileType: "csv" | "json",
    clearExisting: boolean = false
): Promise<ImportResult> {
    let parsed: ParsedImport;
    try {
        parsed = parseImportContent(fileContent, fileType);
    } catch (error: unknown) {
        return {
            success: false,
            importedCount: 0,
            counts: { ...EMPTY_COUNTS },
            error: error instanceof Error ? error.message : "Failed to validate import file",
        };
    }

    await ensureLocalUser();

    try {
        await db.transaction(async (tx) => {
            const backup = parsed.backup;

            if (backup) {
                if (clearExisting) {
                    if (backup.trades !== undefined) {
                        await tx.delete(TradeTable).where(eq(TradeTable.userId, LOCAL_USER_ID));
                    }
                    if (backup.reports !== undefined) {
                        await tx.delete(ReportsTable).where(eq(ReportsTable.userId, LOCAL_USER_ID));
                    }
                    if (backup.journals !== undefined) {
                        await tx.delete(JournalTable).where(eq(JournalTable.userId, LOCAL_USER_ID));
                    }
                    if (backup.strategies !== undefined) {
                        await tx.delete(StrategyTable).where(eq(StrategyTable.userId, LOCAL_USER_ID));
                    }
                }

                if (backup.user) {
                    await tx
                        .insert(UserTable)
                        .values(backup.user)
                        .onConflictDoUpdate({
                            target: UserTable.id,
                            set: {
                                name: backup.user.name,
                                email: backup.user.email,
                                capital: backup.user.capital ?? null,
                                createdAt: backup.user.createdAt,
                                tokens: backup.user.tokens ?? null,
                                onboardingCompleted: backup.user.onboardingCompleted ?? false,
                                openCustomFieldNames: backup.user.openCustomFieldNames ?? [],
                                closeCustomFieldNames: backup.user.closeCustomFieldNames ?? [],
                            },
                        });
                }

                for (const strategy of backup.strategies ?? []) {
                    await tx
                        .insert(StrategyTable)
                        .values(strategy)
                        .onConflictDoUpdate({
                            target: StrategyTable.id,
                            set: {
                                strategyName: strategy.strategyName,
                                description: strategy.description ?? null,
                                openPositionRules: strategy.openPositionRules ?? [],
                                closePositionRules: strategy.closePositionRules ?? [],
                                createdAt: strategy.createdAt,
                                updatedAt: strategy.updatedAt,
                            },
                        });
                }

                for (const journal of backup.journals ?? []) {
                    await tx
                        .insert(JournalTable)
                        .values(journal)
                        .onConflictDoUpdate({
                            target: JournalTable.id,
                            set: {
                                date: journal.date,
                                content: journal.content,
                                createdAt: journal.createdAt,
                                updatedAt: journal.updatedAt,
                            },
                        });
                }

                for (const report of backup.reports ?? []) {
                    await tx
                        .insert(ReportsTable)
                        .values(report)
                        .onConflictDoUpdate({
                            target: ReportsTable.id,
                            set: {
                                createdAt: report.createdAt,
                                reportData: report.reportData,
                                isFavorite: report.isFavorite ?? false,
                            },
                        });
                }

                for (const trade of backup.trades ?? []) {
                    await tx
                        .insert(TradeTable)
                        .values(trade)
                        .onConflictDoUpdate({
                            target: TradeTable.id,
                            set: tradeConflictValues(trade),
                        });
                }
            } else {
                if (clearExisting) {
                    await tx.delete(TradeTable).where(eq(TradeTable.userId, LOCAL_USER_ID));
                }

                for (const campaign of parsed.campaigns) {
                    const trade = campaignToTradeInsert(campaign);
                    await tx
                        .insert(TradeTable)
                        .values(trade)
                        .onConflictDoUpdate({
                            target: TradeTable.id,
                            set: tradeConflictValues(trade),
                        });
                }
            }
        });

        tryRevalidateImportPaths();

        return {
            success: true,
            importedCount: parsed.entityCounts.trades,
            counts: parsed.entityCounts,
            trades: parsed.campaigns,
        };
    } catch (error: unknown) {
        console.error("Failed to import data:", error);
        return {
            success: false,
            importedCount: 0,
            counts: { ...EMPTY_COUNTS },
            error: error instanceof Error ? error.message : "Failed to process import file",
        };
    }
}

/**
 * Export all user trades to CSV format (RFC 4180).
 */
export async function exportTradesCSVAction(): Promise<string> {
    const userTrades = await db.query.TradeTable.findMany({
        where: eq(TradeTable.userId, LOCAL_USER_ID),
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
 * Export a restorable JSON backup covering every local entity managed by the app.
 */
export async function exportFullBackupAction(): Promise<string> {
    await ensureLocalUser();

    const [user, trades, strategies, journals, reports] = await Promise.all([
        db.query.UserTable.findFirst({
            where: eq(UserTable.id, LOCAL_USER_ID),
        }),
        db.query.TradeTable.findMany({
            where: eq(TradeTable.userId, LOCAL_USER_ID),
        }),
        db.query.StrategyTable.findMany({
            where: eq(StrategyTable.userId, LOCAL_USER_ID),
        }),
        db.query.JournalTable.findMany({
            where: eq(JournalTable.userId, LOCAL_USER_ID),
        }),
        db.query.ReportsTable.findMany({
            where: eq(ReportsTable.userId, LOCAL_USER_ID),
        }),
    ]);

    const backup = {
        version: "1.1.0",
        exportedAt: new Date().toISOString(),
        user: user ?? null,
        trades,
        strategies,
        journals,
        reports,
    };

    return JSON.stringify(backup, null, 2);
}
