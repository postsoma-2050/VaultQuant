import { JournalEditor } from "@/components/journal/JournalEditor";
import { isValidJournalDate } from "@/components/journal/journalDate";
import { getJournalEntry } from "@/server/actions/journal";
import { notFound } from "next/navigation";

interface PageProps {
    params: Promise<{
        slug: string[];
    }>;
}

export default async function JournalEntryPage({ params }: PageProps) {
    const { slug } = await params;

    // Validate slug (YYYY/MM/DD)
    if (slug.length !== 3) {
        notFound();
    }

    const dateStr = slug.join("-");

    if (!isValidJournalDate(dateStr)) {
        notFound();
    }

    const entry = await getJournalEntry(dateStr);

    return (
        <JournalEditor
            key={dateStr}
            date={dateStr}
            initialContent={entry?.content as Record<string, unknown> | undefined}
            hasExistingEntry={!!entry}
        />
    );
}
