import Filtering from "@/components/Filtering";
import { ReactNode } from "react";

export default function StatisticsLayout({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <div className="flex min-h-full flex-col">
            <Filtering isStatisticsPage={true} />
            <section className="min-w-0 flex-1 px-3 md:px-6">{children}</section>
        </div>
    );
}
