import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const userId = "local-user";

async function setupDatabase(client: Awaited<ReturnType<typeof createTempDb>>["client"]) {
    await client.execute(`CREATE TABLE "user" (
        "id" text PRIMARY KEY NOT NULL,
        "name" text DEFAULT '' NOT NULL,
        "email" text DEFAULT '' NOT NULL,
        "capital" text,
        "created_at" text NOT NULL,
        "tokens" integer DEFAULT 5,
        "onboarding_completed" integer DEFAULT 0 NOT NULL,
        "open_custom_field_names" text,
        "close_custom_field_names" text
    )`);
    await client.execute(`CREATE TABLE "trades" (
        "id" text PRIMARY KEY NOT NULL,
        "userId" text NOT NULL,
        "positionType" text NOT NULL,
        "openDate" text NOT NULL,
        "openTime" text NOT NULL,
        "closeDate" text,
        "closeTime" text,
        "isActiveTrade" integer DEFAULT 1 NOT NULL,
        "instrumentName" text,
        "symbolName" text NOT NULL,
        "entryPrice" text,
        "deposit" text,
        "result" text,
        "totalCost" text,
        "quantity" text,
        "sellPrice" text,
        "quantitySold" text,
        "notes" text,
        "rating" integer DEFAULT 0,
        "strategy_id" text,
        "applied_open_rules" text,
        "applied_close_rules" text,
        "close_events" text,
        "open_other_details" text,
        "close_other_details" text
    )`);
    await client.execute({
        sql: `INSERT INTO "user" ("id", "name", "email", "capital", "created_at")
              VALUES (?, ?, ?, ?, ?)`,
        args: [userId, "Local User", "local@example.com", "10000", new Date().toISOString()],
    });
}

async function insertTrade({
    db,
    TradeTable,
}: {
    db: Awaited<ReturnType<typeof createTempDb>>["db"];
    TradeTable: Awaited<ReturnType<typeof createTempDb>>["TradeTable"];
}) {
    return async ({
    id,
    positionType,
    initialQty,
    initialPrice,
    events,
    }: {
    id: string;
    positionType: "buy" | "sell";
    initialQty: number;
    initialPrice: number;
    events: Array<{
        id: string;
        date: string;
        time: string;
        quantityChange: number;
        price: number;
        result: number;
        eventType: "add" | "reduce" | "close";
    }>;
    }) => {
    const isClosed = events.reduce((qty, event) => {
        return qty + event.quantityChange;
    }, initialQty) <= 0;
    const result = events.reduce((sum, event) => sum + (event.result || 0), 0);
    const closedQuantity = events.reduce(
        (total, event) =>
            total + (event.quantityChange < 0 ? Math.abs(event.quantityChange) : 0),
        0
    );
    const lastEvent = events[events.length - 1];

    await db.insert(TradeTable).values({
        id,
        userId,
        positionType,
        openDate: "2026-01-02",
        openTime: "09:30",
        closeDate: isClosed ? lastEvent?.date : null,
        closeTime: isClosed ? lastEvent?.time : null,
        isActiveTrade: !isClosed,
        symbolName: "TEST",
        entryPrice: String(initialPrice),
        quantity: isClosed ? "0" : String(initialQty),
        result: isClosed ? String(result) : null,
        sellPrice: isClosed ? String(lastEvent?.price ?? 0) : null,
        quantitySold: isClosed ? String(closedQuantity) : null,
        closeEvents: events,
        openOtherDetails: {
            initialQty: String(initialQty),
            initialEntryPrice: String(initialPrice),
        },
        });
    };
}

async function getTrade(
    db: Awaited<ReturnType<typeof createTempDb>>["db"],
    TradeTable: Awaited<ReturnType<typeof createTempDb>>["TradeTable"],
    eq: typeof import("drizzle-orm").eq,
    id: string
) {
    const [trade] = await db.select().from(TradeTable).where(eq(TradeTable.id, id));
    return trade;
}

async function createTempDb() {
    const tempDir = await mkdtemp(path.join(tmpdir(), "vaultquant-ledger-"));
    process.env.DATABASE_URL = `file:${path.join(tempDir, "ledger.db")}`;

    const { client, db } = await import("@/drizzle/db");
    const { TradeTable } = await import("@/drizzle/schema");
    const { eq } = await import("drizzle-orm");
    return { tempDir, client, db, TradeTable, eq };
}

async function run() {
    const { tempDir, client, db, TradeTable, eq } = await createTempDb();
    const { deletePositionEvent, updateTradeRecord } = await import("./trades");
    const { v4: uuidv4 } = await import("uuid");
    const insert = await insertTrade({ db, TradeTable });

    await setupDatabase(client);

    const addId = uuidv4();
    const longId = uuidv4();
    await insert({
        id: longId,
        positionType: "buy",
        initialQty: 10,
        initialPrice: 100,
        events: [
            {
                id: addId,
                date: "2026-01-03",
                time: "10:00",
                quantityChange: 10,
                price: 200,
                result: 0,
                eventType: "add",
            },
            {
                id: uuidv4(),
                date: "2026-01-04",
                time: "11:00",
                quantityChange: -5,
                price: 180,
                result: 150,
                eventType: "reduce",
            },
        ],
    });

    const longDelete = await deletePositionEvent(longId, addId);
    assert.equal(longDelete?.error, false);
    assert.equal(longDelete?.updatedTrade?.quantity, "5");
    assert.equal(longDelete?.updatedTrade?.entryPrice, "100");
    assert.equal(longDelete?.updatedTrade?.result, undefined);
    assert.deepEqual(
        longDelete?.updatedTrade?.closeEvents?.map((event) => event.result),
        [400]
    );

    const impossibleAddId = uuidv4();
    const impossibleId = uuidv4();
    await insert({
        id: impossibleId,
        positionType: "buy",
        initialQty: 10,
        initialPrice: 100,
        events: [
            {
                id: impossibleAddId,
                date: "2026-02-02",
                time: "10:00",
                quantityChange: 10,
                price: 200,
                result: 0,
                eventType: "add",
            },
            {
                id: uuidv4(),
                date: "2026-02-03",
                time: "11:00",
                quantityChange: -15,
                price: 180,
                result: 150,
                eventType: "reduce",
            },
        ],
    });
    const beforeRejectedDelete = await getTrade(db, TradeTable, eq, impossibleId);
    const rejected = await deletePositionEvent(impossibleId, impossibleAddId);
    assert.equal(rejected?.error, true);
    assert.match(rejected?.message || "", /only 10 remain/);
    assert.deepEqual(await getTrade(db, TradeTable, eq, impossibleId), beforeRejectedDelete);

    const shortId = uuidv4();
    const shortReduceId = uuidv4();
    await insert({
        id: shortId,
        positionType: "sell",
        initialQty: 10,
        initialPrice: 100,
        events: [
            {
                id: uuidv4(),
                date: "2026-03-02",
                time: "10:00",
                quantityChange: 10,
                price: 80,
                result: 0,
                eventType: "add",
            },
            {
                id: shortReduceId,
                date: "2026-03-03",
                time: "11:00",
                quantityChange: -5,
                price: 120,
                result: -250,
                eventType: "reduce",
            },
        ],
    });
    const shortDelete = await deletePositionEvent(shortId, shortReduceId);
    assert.equal(shortDelete?.error, false);
    assert.equal(shortDelete?.updatedTrade?.quantity, "20");
    assert.equal(shortDelete?.updatedTrade?.entryPrice, "90");
    assert.equal(shortDelete?.updatedTrade?.isActiveTrade, true);

    const finalCloseId = uuidv4();
    const finalCloseEventId = uuidv4();
    await insert({
        id: finalCloseId,
        positionType: "buy",
        initialQty: 10,
        initialPrice: 100,
        events: [
            {
                id: uuidv4(),
                date: "2026-04-02",
                time: "10:00",
                quantityChange: 5,
                price: 110,
                result: 0,
                eventType: "add",
            },
            {
                id: uuidv4(),
                date: "2026-04-03",
                time: "11:00",
                quantityChange: -3,
                price: 120,
                result: 50,
                eventType: "reduce",
            },
            {
                id: finalCloseEventId,
                date: "2026-04-04",
                time: "15:00",
                quantityChange: -12,
                price: 130,
                result: 320,
                eventType: "close",
            },
        ],
    });

    const beforeFinalEdit = await getTrade(db, TradeTable, eq, finalCloseId);
    assert.equal(beforeFinalEdit.result, "370");
    assert.equal(beforeFinalEdit.quantitySold, "15");

    const finalEditData: import("zod").infer<
        typeof import("@/zodSchema/schema").newTradeFormSchema
    > = {
        positionType: "buy",
        openDate: "2026-04-01",
        openTime: "09:30",
        closeDate: "2026-04-07",
        closeTime: "16:30",
        isActiveTrade: false,
        symbolName: "TEST",
        entryPrice: "100",
        quantity: "10",
        sellPrice: "135",
        quantitySold: "15",
        result: "300",
        closeEvents: (beforeFinalEdit.closeEvents || []).map((event) => ({
            ...event,
            quantitySold: event.quantitySold ?? 0,
            sellPrice: event.sellPrice ?? 0,
            result: event.result ?? 0,
        })),
        openOtherDetails: {
            initialQty: "10",
            initialEntryPrice: "100",
        },
        notes: "",
        rating: 0,
        appliedOpenRules: [],
        appliedCloseRules: [],
        closeOtherDetails: {},
    };
    const finalEdit = await updateTradeRecord(finalEditData, finalCloseId);
    assert.equal(finalEdit?.error, undefined);

    const afterFinalEdit = await getTrade(db, TradeTable, eq, finalCloseId);
    assert.equal(afterFinalEdit.result, "430");
    assert.equal(afterFinalEdit.sellPrice, "135");
    assert.equal(afterFinalEdit.closeDate, "2026-04-07");
    assert.equal(afterFinalEdit.closeTime, "16:30");
    const finalEvent = afterFinalEdit.closeEvents?.find(
        (event) => event.id === finalCloseEventId
    );
    assert.equal(finalEvent?.price, 135);
    assert.equal(finalEvent?.sellPrice, 135);
    assert.equal(finalEvent?.date, "2026-04-07");
    assert.equal(finalEvent?.time, "16:30");
    assert.equal(finalEvent?.quantityChange, -12);
    assert.equal(finalEvent?.quantitySold, 12);

    const beforeRejectedAggregateEdit = afterFinalEdit;
    const rejectedAggregateEdit = await updateTradeRecord(
        {
            ...finalEditData,
            closeDate: afterFinalEdit.closeDate || "",
            closeTime: afterFinalEdit.closeTime || "",
            sellPrice: afterFinalEdit.sellPrice || "",
            quantitySold: "19",
            closeEvents: (afterFinalEdit.closeEvents || []).map((event) => ({
                ...event,
                quantitySold: event.quantitySold ?? 0,
                sellPrice: event.sellPrice ?? 0,
                result: event.result ?? 0,
            })),
        },
        finalCloseId
    );
    assert.equal(rejectedAggregateEdit?.error, true);
    assert.match(
        rejectedAggregateEdit?.message || "",
        /aggregate quantity sold is not supported/
    );
    assert.deepEqual(
        await getTrade(db, TradeTable, eq, finalCloseId),
        beforeRejectedAggregateEdit
    );

    await client.close();
    await rm(tempDir, { recursive: true, force: true });
    console.log("Ledger replay assertions passed");
}

run().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
