const JOURNAL_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidJournalDate(value: string): boolean {
    if (!JOURNAL_DATE_PATTERN.test(value)) return false;

    const parsed = new Date(`${value}T00:00:00.000Z`);
    return (
        !Number.isNaN(parsed.getTime()) &&
        parsed.toISOString().slice(0, 10) === value
    );
}

export function formatLocalDate(date = new Date()): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

export function toJournalPath(date: string): string | null {
    if (!isValidJournalDate(date)) return null;
    return `/private/journal/${date.replaceAll("-", "/")}`;
}
