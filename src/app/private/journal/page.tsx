"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { formatLocalDate, toJournalPath } from "@/components/journal/journalDate";

export default function JournalPage() {
    const router = useRouter();

    useEffect(() => {
        const path = toJournalPath(formatLocalDate());
        router.replace(path ?? "/private/journal");
    }, [router]);

    return (
        <div className="flex h-full items-center justify-center bg-white">
            <p className="text-sm text-zinc-500">Opening today&apos;s journal...</p>
        </div>
    );
}
