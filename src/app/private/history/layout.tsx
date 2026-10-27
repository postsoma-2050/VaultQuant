import Filtering from "@/components/Filtering";
import { ReactNode } from "react";

export default function HistoryLayout({ children }: { children: ReactNode }) {
    return (
        <div className="flex flex-col h-full min-h-0">
            <Filtering isStatisticsPage={false} />
            <section className="flex-1 min-h-0 overflow-auto">
                {children}
            </section>
        </div>
    );
}
