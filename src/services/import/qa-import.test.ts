import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { eq } from "drizzle-orm";
import {
    JournalTable,
    ReportsTable,
    StrategyTable,
    TradeTable,
    UserTable,
} from "@/drizzle/schema";
import type { ReportType } from "@/types/tradeAI.types";

const tempDir = mkdtempSync(join(tmpdir(), "vaultquant-qa-import-"));
const databasePath = join(tempDir, "qa-import.sqlite");
process.env.DATABASE_URL = `file:${databasePath}`;

const VALID_CSV = [
    "id,symbolName,positionType,openDate,openTime,isActiveTrade",
    "original-trade,AAPL,buy,2026-01-02,09:30:00,true",
].join("\n");

const DUPLICATE_CSV = [
    "id,symbolName,positionType,openDate,openTime,isActiveTrade",
    "duplicate-trade,AAPL,buy,2026-01-02,09:30:00,true",
    "duplicate-trade,MSFT,buy,2026-01-03,09:30:00,true",
].join("\n");

const CONSTRAINT_CSV = [
    "id,symbolName,positionType,openDate,openTime,isActiveTrade",
    "constraint-trade,FAIL,buy,2026-01-04,09:30:00,true",
].join("\n");

const reportData: ReportType = {
    moneyManagement: [{ type: "user", content: ["Keep risk bounded."] }],
    instruments: [{ type: "system", content: ["AAPL remains in focus."] }],
    timeManagement: [{ type: "user", content: ["Review after the close."] }],
    liveExposureChecklist: [],
    portfolioSummary: null,
    openPositions: null,
};

function sortById<T extends { id: string }>(items: T[]): T[] {
    return [...items].sort((left, right) => left.id.localeCompare(right.id));
}

function backupSections(backupJson: string) {
    const backup = JSON.parse(backupJson) as {
        user: unknown;
        trades: Array<{ id: string }>;
        strategies: Array<{ id: string }>;
        journals: Array<{ id: string }>;
        reports: Array<{ id: string }>;
    };

    return {
        user: backup.user,
        trades: sortById(backup.trades),
        strategies: sortById(backup.strategies),
        journals: sortById(backup.journals),
        reports: sortById(backup.reports),
    };
}

async function run(): Promise<void> {
    assert.notEqual(
        databasePath,
        join(process.cwd(), "local.db"),
        "the QA test must never target the workspace database"
    );

    const [{ db, client }, { ensureLocalUser }, importExport] = await Promise.all([
        import("@/drizzle/db"),
        import("@/server/actions/user"),
        import("@/server/actions/importExport"),
    ]);

    await ensureLocalUser();

    await db.update(UserTable)
        .set({
            name: "Round Trip User",
            email: "roundtrip@example.com",
            capital: "54321.00",
            tokens: 17,
            onboardingCompleted: true,
            openCustomFieldNames: ["setup"],
            closeCustomFieldNames: ["review"],
        })
        .where(eq(UserTable.id, "local-user"));

    await db.insert(StrategyTable).values({
        id: "strategy-roundtrip",
        userId: "local-user",
        strategyName: "Breakout",
        description: "Round-trip strategy",
        openPositionRules: [],
        closePositionRules: [],
        createdAt: "2026-01-01T12:00:00.000Z",
        updatedAt: "2026-01-02T12:00:00.000Z",
    });

    await db.insert(JournalTable).values({
        id: "journal-roundtrip",
        userId: "local-user",
        date: "2026-01-02",
        content: {
            type: "doc",
            content: [{ type: "paragraph", content: [{ type: "text", text: "Journal body" }] }],
        },
        createdAt: "2026-01-02T21:00:00.000Z",
        updatedAt: "2026-01-02T21:05:00.000Z",
    });

    await db.insert(ReportsTable).values({
        id: "report-roundtrip",
        userId: "local-user",
        createdAt: "2026-01-02T22:00:00.000Z",
        reportData,
        isFavorite: true,
    });

    await db.insert(TradeTable).values({
        id: "original-trade",
        userId: "local-user",
        symbolName: "AAPL",
        instrumentName: "Apple Inc.",
        positionType: "buy",
        openDate: "2026-01-02",
        openTime: "09:30:00",
        closeDate: "2026-01-02",
        closeTime: "15:55:00",
        isActiveTrade: false,
        entryPrice: "100.25",
        deposit: "10025",
        result: "75.50",
        totalCost: "10025",
        quantity: "100",
        sellPrice: "101",
        quantitySold: "100",
        notes: JSON.stringify([
            {
                id: "note-roundtrip",
                createdAt: "2026-01-02T16:00:00.000Z",
                text: "Round-trip note",
                category: "general",
            },
        ]),
        rating: 4,
        strategyId: "strategy-roundtrip",
        appliedOpenRules: [],
        appliedCloseRules: [],
        closeEvents: [
            {
                id: "event-roundtrip",
                date: "2026-01-02",
                time: "15:55:00",
                quantitySold: 100,
                sellPrice: 101,
                result: 75.5,
                quantityChange: -100,
                price: 101,
            },
        ],
        openOtherDetails: { setup: "opening range" },
        closeOtherDetails: { review: "clean exit" },
    });

    const originalBackup = await importExport.exportFullBackupAction();
    const originalSections = backupSections(originalBackup);
    const originalPreview = await importExport.previewImportAction(originalBackup, "json");

    assert.equal(originalPreview.success, true, "full backup preview succeeds");
    assert.equal(originalPreview.isFullBackup, true, "full backup is identified explicitly");
    assert.deepEqual(
        originalPreview.entityCounts,
        { trades: 1, strategies: 1, journals: 1, reports: 1, users: 1 },
        "preview counts match every exported entity type"
    );

    const incompleteBackup = JSON.parse(originalBackup) as Record<string, unknown>;
    delete incompleteBackup.reports;
    const incompleteRestore = await importExport.importTradesAction(
        JSON.stringify(incompleteBackup),
        "json",
        true
    );
    assert.equal(incompleteRestore.success, false, "incomplete full backup is rejected");
    assert.match(incompleteRestore.error ?? "", /missing required section.*reports/i);
    assert.equal(
        (await db.select().from(TradeTable)).length,
        1,
        "incomplete full backup is rejected before deleting existing trades"
    );

    const invalidCsv = await importExport.importTradesAction(
        "this is not csv trade data",
        "csv",
        true
    );
    assert.equal(invalidCsv.success, false, "invalid CSV is rejected");
    assert.equal(
        (await db.select().from(TradeTable)).length,
        1,
        "invalid CSV replace does not delete existing trades"
    );

    const invalidJson = await importExport.importTradesAction(
        "{not valid json",
        "json",
        true
    );
    assert.equal(invalidJson.success, false, "invalid JSON is rejected");
    assert.equal(
        (await db.select().from(TradeTable)).length,
        1,
        "invalid JSON replace does not delete existing trades"
    );

    const duplicate = await importExport.importTradesAction(DUPLICATE_CSV, "csv", true);
    assert.equal(duplicate.success, false, "duplicate IDs are rejected");
    assert.match(duplicate.error ?? "", /duplicate id/i);
    assert.equal(
        (await db.select().from(TradeTable)).length,
        1,
        "duplicate-ID validation failure preserves existing trades"
    );

    await client.execute(`
        CREATE TRIGGER reject_fail_symbol
        BEFORE INSERT ON trades
        WHEN NEW.symbolName = 'FAIL'
        BEGIN
            SELECT RAISE(ABORT, 'injected constraint failure');
        END
    `);

    const originalConsoleError = console.error;
    console.error = () => undefined;
    let constraintFailure;
    try {
        constraintFailure = await importExport.importTradesAction(
            CONSTRAINT_CSV,
            "csv",
            true
        );
    } finally {
        console.error = originalConsoleError;
    }
    assert.equal(constraintFailure.success, false, "database constraint failure is reported");
    const tradesAfterRollback = await db.select().from(TradeTable);
    assert.deepEqual(
        tradesAfterRollback.map((trade) => trade.id),
        ["original-trade"],
        "constraint failure rolls back the preceding replace delete"
    );

    await client.execute("DROP TRIGGER reject_fail_symbol");

    await db.update(UserTable)
        .set({ name: "Mutated User", capital: "0" })
        .where(eq(UserTable.id, "local-user"));
    await db.delete(TradeTable);
    await db.delete(ReportsTable);
    await db.delete(JournalTable);
    await db.delete(StrategyTable);

    const restore = await importExport.importTradesAction(originalBackup, "json", true);
    assert.equal(restore.success, true, "full backup restore succeeds");
    assert.deepEqual(
        restore.counts,
        originalPreview.entityCounts,
        "restore result reports the previewed entity counts"
    );

    const restoredSections = backupSections(await importExport.exportFullBackupAction());
    assert.deepEqual(
        restoredSections,
        originalSections,
        "full backup round trip restores profile, trades, strategies, journals, and reports"
    );

    const validReplace = await importExport.importTradesAction(VALID_CSV, "csv", true);
    assert.equal(validReplace.success, true, "valid CSV replace succeeds");
    assert.deepEqual(
        (await db.select().from(TradeTable)).map((trade) => trade.id),
        ["original-trade"],
        "valid CSV replace applies the expected trade scope"
    );

    console.log("qa-import: invalid-input preservation, rollback, and full-backup round trip passed");
}

run()
    .catch((error) => {
        console.error(error);
        process.exitCode = 1;
    })
    .finally(async () => {
        try {
            const { client } = await import("@/drizzle/db");
            client.close();
        } catch {
            // Ignore cleanup failures after the test has already reported its result.
        }
        rmSync(tempDir, { recursive: true, force: true });
    });
