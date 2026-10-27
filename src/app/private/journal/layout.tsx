import { getJournalDatesWithSummaries } from "@/server/actions/journal";
import { JournalSidebar } from "@/components/journal/JournalSidebar";
import { JournalDraftProvider } from "@/components/journal/JournalDraftContext";

export default async function JournalLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const dates = await getJournalDatesWithSummaries();

    return (
        <JournalDraftProvider>
            <div className="flex h-full min-h-0 min-w-0">
            <JournalSidebar dates={dates} />
            <div className="min-w-0 flex-1 bg-white">
                {children}
            </div>
            </div>
        </JournalDraftProvider>
    );
}
