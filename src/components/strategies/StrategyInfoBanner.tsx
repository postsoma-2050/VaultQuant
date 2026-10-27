"use client";

import { ChevronDown } from "lucide-react";

export default function StrategyInfoBanner() {
    return (
        <details className="group rounded-lg border border-zinc-200 bg-white">
            <summary className="flex cursor-pointer list-none items-center gap-1.5 rounded-md px-3 py-2 text-[13px] font-medium text-zinc-600 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-zinc-400 [&::-webkit-details-marker]:hidden">
                <ChevronDown
                    aria-hidden="true"
                    className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180"
                />
                About strategies
            </summary>
            <div className="grid grid-cols-1 gap-4 border-t border-zinc-100 px-3 py-3 text-[13px] text-zinc-600 md:grid-cols-2">
                <p className="leading-relaxed">
                    A strategy is a checklist of entry and exit rules. When logging a
                    trade, select the strategy and mark the rules you followed so the
                    record reflects your process.
                </p>
                <div className="rounded-md bg-zinc-50 p-3">
                    <p className="font-medium text-zinc-700">Example</p>
                    <p className="mt-1 leading-relaxed">
                        Entry: price closes above the 20-day SMA. Exit: price closes
                        below it, or reaches a 2R target.
                    </p>
                </div>
            </div>
        </details>
    );
}
