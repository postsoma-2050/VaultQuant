import { isValidJournalDate } from "./journalDate";

const STORAGE_PREFIX = "vaultquant:journal-draft:";

type StoredJournalDraft = {
    version: 1;
    date: string;
    content: Record<string, unknown>;
    updatedAt: number;
};

function storageKey(date: string) {
    return `${STORAGE_PREFIX}${date}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function readJournalDraft(date: string): Record<string, unknown> | null {
    if (!isValidJournalDate(date) || typeof window === "undefined") return null;

    try {
        const raw = window.sessionStorage.getItem(storageKey(date));
        if (!raw) return null;

        const parsed: unknown = JSON.parse(raw);
        if (
            !isRecord(parsed) ||
            parsed.version !== 1 ||
            parsed.date !== date ||
            !isRecord(parsed.content)
        ) {
            window.sessionStorage.removeItem(storageKey(date));
            return null;
        }

        return parsed.content;
    } catch {
        return null;
    }
}

export function writeJournalDraft(
    date: string,
    content: Record<string, unknown>
) {
    if (!isValidJournalDate(date) || typeof window === "undefined") return;

    const draft: StoredJournalDraft = {
        version: 1,
        date,
        content,
        updatedAt: Date.now(),
    };

    try {
        window.sessionStorage.setItem(storageKey(date), JSON.stringify(draft));
    } catch {
        // Persistence is best-effort; the editor remains usable if storage is full.
    }
}

export function removeJournalDraft(date: string) {
    if (!isValidJournalDate(date) || typeof window === "undefined") return;

    try {
        window.sessionStorage.removeItem(storageKey(date));
    } catch {
        // Ignore storage access failures.
    }
}
