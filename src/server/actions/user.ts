"use server";

import { client, db } from "@/drizzle/db";
import { UserTable } from "@/drizzle/schema";
import { eq } from "drizzle-orm";

let dbInitialized = false;

const initTableQueries = [
    `CREATE TABLE IF NOT EXISTS "user" (
        "id" text PRIMARY KEY NOT NULL,
        "name" text DEFAULT '' NOT NULL,
        "email" text DEFAULT '' NOT NULL,
        "capital" text,
        "created_at" text NOT NULL,
        "tokens" integer DEFAULT 5,
        "onboarding_completed" integer DEFAULT 0 NOT NULL,
        "open_custom_field_names" text,
        "close_custom_field_names" text
    );`,
    `CREATE TABLE IF NOT EXISTS "strategies" (
        "id" text PRIMARY KEY NOT NULL,
        "userId" text NOT NULL,
        "strategyName" text NOT NULL,
        "description" text,
        "open_position_rules" text,
        "close_position_rules" text,
        "created_at" text NOT NULL,
        "updated_at" text NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS "trades" (
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
    );`,
    `CREATE TABLE IF NOT EXISTS "journal" (
        "id" text PRIMARY KEY NOT NULL,
        "user_id" text NOT NULL,
        "date" text NOT NULL,
        "content" text,
        "created_at" text NOT NULL,
        "updated_at" text NOT NULL
    );`,
    `CREATE TABLE IF NOT EXISTS "reports" (
        "id" text PRIMARY KEY NOT NULL,
        "user_id" text NOT NULL,
        "created_at" text NOT NULL,
        "report_data" text NOT NULL,
        "is_favorite" integer DEFAULT 0 NOT NULL
    );`
];

export async function ensureLocalUser() {
    if (!dbInitialized) {
        try {
            for (const query of initTableQueries) {
                await client.execute(query);
            }
            dbInitialized = true;
        } catch (initErr) {
            console.error("Error creating tables:", initErr);
        }
    }

    try {
        const user = await db.query.UserTable.findFirst({
            where: eq(UserTable.id, "local-user"),
        });

        if (user == null) {
            await db.insert(UserTable).values({
                id: "local-user",
                name: "Local User",
                email: "local@example.com",
                capital: "10000",
                tokens: 5,
                onboardingCompleted: false,
                createdAt: new Date().toISOString(),
            }).onConflictDoNothing();
        }
    } catch (err: unknown) {
        console.error("Error ensuring local user:", err);
    }
}

export async function addCapitalOrUpdate(
    capital: string
): Promise<{ error: boolean } | undefined> {
    const userId = "local-user";
    await ensureLocalUser();

    try {
        const user = await db.query.UserTable.findFirst({
            where: eq(UserTable.id, userId),
        });

        if (user == null) {
            await db
                .insert(UserTable)
                .values({ capital, id: userId, tokens: 5, createdAt: new Date().toISOString() });
        } else {
            await db
                .update(UserTable)
                .set({ capital })
                .where(eq(UserTable.id, userId));
        }
    } catch (err) {
        console.error(err);
        return { error: true };
    }
}

export async function getCapital(): Promise<
    string | undefined | { error: boolean }
> {
    const userId = "local-user";
    await ensureLocalUser();

    try {
        const data = await db.query.UserTable.findFirst({
            where: eq(UserTable.id, userId),
        });

        return data?.capital ?? undefined;
    } catch (err) {
        console.error(err);
        return { error: true };
    }
}

export async function checkIfUserHasTokens(): Promise<
    | { success: true; tokens: number | null }
    | { success: false; message: string }
> {
    return { success: true, tokens: 9999 };
}

export async function updateCredits(): Promise<
    { success: true; message: string } | { success: false; message: string }
> {
    return { success: true, message: "Credits updated locally." };
}

export async function completeOnboarding() {
    const userId = "local-user";
    await ensureLocalUser();
    await db.update(UserTable).set({ onboardingCompleted: true }).where(eq(UserTable.id, userId));
}

// Custom Field Names Management
export async function getCustomFieldNames(): Promise<{
    openFields: string[];
    closeFields: string[];
} | { error: boolean }> {
    const userId = "local-user";
    await ensureLocalUser();

    try {
        const user = await db.query.UserTable.findFirst({
            where: eq(UserTable.id, userId),
        });

        return {
            openFields: (user?.openCustomFieldNames as string[]) || [],
            closeFields: (user?.closeCustomFieldNames as string[]) || [],
        };
    } catch (err) {
        console.error("Error getting custom field names:", err);
        return { error: true };
    }
}

export async function addCustomFieldName(
    type: "open" | "close",
    fieldName: string
): Promise<{ success: boolean; error?: string }> {
    const userId = "local-user";
    await ensureLocalUser();

    try {
        const user = await db.query.UserTable.findFirst({
            where: eq(UserTable.id, userId),
        });

        if (!user) {
            return { success: false, error: "User not found" };
        }

        const currentFields = type === "open"
            ? (user.openCustomFieldNames as string[]) || []
            : (user.closeCustomFieldNames as string[]) || [];

        if (currentFields.includes(fieldName)) {
            return { success: true };
        }

        const updatedFields = [...currentFields, fieldName];

        if (type === "open") {
            await db.update(UserTable)
                .set({ openCustomFieldNames: updatedFields })
                .where(eq(UserTable.id, userId));
        } else {
            await db.update(UserTable)
                .set({ closeCustomFieldNames: updatedFields })
                .where(eq(UserTable.id, userId));
        }

        return { success: true };
    } catch (err) {
        console.error("Error adding custom field name:", err);
        return { success: false, error: "Failed to add field" };
    }
}

export async function removeCustomFieldName(
    type: "open" | "close",
    fieldName: string
): Promise<{ success: boolean; error?: string }> {
    const userId = "local-user";
    await ensureLocalUser();

    try {
        const user = await db.query.UserTable.findFirst({
            where: eq(UserTable.id, userId),
        });

        if (!user) {
            return { success: false, error: "User not found" };
        }

        const currentFields = type === "open"
            ? (user.openCustomFieldNames as string[]) || []
            : (user.closeCustomFieldNames as string[]) || [];

        const updatedFields = currentFields.filter(f => f !== fieldName);

        if (type === "open") {
            await db.update(UserTable)
                .set({ openCustomFieldNames: updatedFields })
                .where(eq(UserTable.id, userId));
        } else {
            await db.update(UserTable)
                .set({ closeCustomFieldNames: updatedFields })
                .where(eq(UserTable.id, userId));
        }

        return { success: true };
    } catch (err) {
        console.error("Error removing custom field name:", err);
        return { success: false, error: "Failed to remove field" };
    }
}