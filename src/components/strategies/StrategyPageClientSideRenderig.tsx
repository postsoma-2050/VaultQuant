"use client";

import React from "react";
import StrategyCard from "./Strategy";
import { useAppSelector } from "@/redux/store";
import StrategyInfoBanner from "./StrategyInfoBanner";

export default function StrategyPageClientSideRenderig({
    hideAll = false,
}: {
    hideAll?: boolean;
}) {
    const { strategies: localStrategies, searchQuery } = useAppSelector(
        (state) => state.strategies
    );

    // Filter strategies based on search query
    const filteredStrategies = localStrategies.filter((strategy) =>
        strategy.strategyName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3">
            <StrategyInfoBanner />
            {filteredStrategies.length > 0 ? (
                filteredStrategies.map((strategy) => (
                    <StrategyCard key={strategy.id} strategy={strategy} hideAll={hideAll} />
                ))
            ) : (
                <div className="rounded-lg border border-dashed border-zinc-200 bg-white py-12 text-center text-sm text-zinc-500">
                    {searchQuery ?
                        `No strategies found matching "${searchQuery}"` :
                        "No strategies found. Create your first strategy!"
                    }
                </div>
            )}
        </div>
    );
}
