"use server";

import { db } from "@/drizzle/db";
import { JournalTable } from "@/drizzle/schema";
import { and, eq, desc } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { ensureLocalUser } from "./user";
import { v4 as uuidv4 } from "uuid";

export async function getJournalEntry(date: string) {
    const userId = "local-user";
    await ensureLocalUser();

    const entry = await db.query.JournalTable.findFirst({
        where: and(
            eq(JournalTable.userId, userId),
            eq(JournalTable.date, date)
        ),
    });

    return entry;
}

export async function saveJournalEntry(date: string, content: Record<string, unknown>) {
    const userId = "local-user";
    await ensureLocalUser();

    try {
        const existingEntry = await db.query.JournalTable.findFirst({
            where: and(
                eq(JournalTable.userId, userId),
                eq(JournalTable.date, date)
            ),
        });

        if (existingEntry) {
            await db
                .update(JournalTable)
                .set({
                    content,
                    updatedAt: new Date().toISOString(),
                })
                .where(eq(JournalTable.id, existingEntry.id));
        } else {
            await db.insert(JournalTable).values({
                id: uuidv4(),
                userId,
                date,
                content,
            });
        }

        revalidatePath("/private/journal");
        return { success: true };
    } catch (error) {
        console.error("Error saving journal entry:", error);
        return { success: false, error: "Failed to save entry" };
    }
}

export async function getJournalDates() {
    const userId = "local-user";
    await ensureLocalUser();

    const entries = await db.query.JournalTable.findMany({
        where: eq(JournalTable.userId, userId),
        columns: {
            date: true,
        },
        orderBy: [desc(JournalTable.date)],
    });

    return entries.map((entry) => entry.date);
}

function extractSummary(content: unknown, maxLen = 60): string {
    if (!content || typeof content !== "object") return "";
    let text = "";

    const recurse = (node: unknown) => {
        if (!node || typeof node !== "object") return;
        const n = node as { type?: string; text?: string; content?: unknown[] };
        if (n.type === "text" && typeof n.text === "string") {
            text += " " + n.text;
        }
        if (Array.isArray(n.content)) {
            for (const child of n.content) {
                recurse(child);
                if (text.trim().length >= maxLen) break;
            }
        }
    };

    try {
        recurse(content);
    } catch {
        return "";
    }
    
    const cleaned = text.trim();
    return cleaned.length > maxLen ? cleaned.slice(0, maxLen) + "..." : cleaned;
}

export async function getJournalDatesWithSummaries() {
    const userId = "local-user";
    await ensureLocalUser();

    const entries = await db.query.JournalTable.findMany({
        where: eq(JournalTable.userId, userId),
        columns: {
            date: true,
            content: true,
        },
        orderBy: [desc(JournalTable.date)],
    });

    return entries.map((entry) => {
        const summary = extractSummary(entry.content);
        return {
            date: entry.date,
            summary,
        };
    });
}

export async function deleteJournalEntry(date: string) {
    const userId = "local-user";
    await ensureLocalUser();

    try {
        await db
            .delete(JournalTable)
            .where(
                and(
                    eq(JournalTable.userId, userId),
                    eq(JournalTable.date, date)
                )
            );

        revalidatePath("/private/journal");
        revalidatePath("/private/calendar");
        return { success: true };
    } catch (error) {
        console.error("Error deleting journal entry:", error);
        return { success: false, error: "Failed to delete entry" };
    }
}
