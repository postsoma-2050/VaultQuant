"use client";

import { CustomButton } from "@/components/CustomButton";
import AddStrategyDialog from "@/components/strategies/AddStrategyDialog";
import SearchStrategy from "@/components/strategies/SearchStrategy";
import SlidingTabs from "@/components/strategies/SlidingTabs";
import StrategyPageClientSideRenderig from "@/components/strategies/StrategyPageClientSideRenderig";
import { useState } from "react";

export default function StrategiesPage() {
    const [hideAll, setHideAll] = useState(false);

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div className="shrink-0 px-4 pt-4 border-b border-zinc-200">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div>
                            <h1 className="text-xl font-semibold text-zinc-900">Strategies</h1>
                            <p className="text-[13px] text-zinc-500">Define the rules you want to follow.</p>
                        </div>
                    </div>
                    <AddStrategyDialog />
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                    <SlidingTabs />

                    <div className="flex min-w-0 items-center gap-2 pb-2">
                        <SearchStrategy />
                        <CustomButton
                            isBlack={false}
                            className="h-8 px-2.5 text-[13px]"
                            onClick={() => setHideAll((value) => !value)}
                        >
                            {hideAll ? "Show all" : "Hide all"}
                        </CustomButton>
                    </div>

                </div>
            </div>
            <StrategyPageClientSideRenderig hideAll={hideAll} />
        </div >
    );
}
