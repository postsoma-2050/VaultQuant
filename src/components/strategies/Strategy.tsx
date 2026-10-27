"use client";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";

import { Strategy } from "@/types/strategies.types";
import { ChevronDown } from "lucide-react";
import DeleteStrategyButton from "./DeleteStrategyButton";
import AddStrategyDialog from "./AddStrategyDialog";
import { useState, useEffect, useRef } from "react";
import { useAppSelector } from "@/redux/store";
import StrategyRules from "./StrategyRules";
import StrategyHistory from "./StrategyHistory";



export default function StrategyCard({
    strategy,
    hideAll = false
}: {
    strategy: Strategy;
    hideAll?: boolean;
}) {
    const [isOpen, setIsOpen] = useState(true);
    const lastHideAll = useRef(hideAll);

    // Get activeTab from Redux
    const activeTab = useAppSelector((state) => state.strategies.activeTab);

    useEffect(() => {
        // Only respond to an explicit Hide all / Show all change. A strategy
        // action can remount this card and must not override the user's
        // disclosure choice.
        if (lastHideAll.current !== hideAll) {
            setIsOpen(!hideAll);
            lastHideAll.current = hideAll;
        }
    }, [hideAll]);

    return (
        <Accordion
            type="single"
            collapsible
            className="w-full"
            value={isOpen ? "item-1" : ""}
            onValueChange={(value) => setIsOpen(value === "item-1")}
        >
            <AccordionItem
                value="item-1"
                className="group overflow-hidden rounded-lg border border-zinc-200 bg-white"
            >
                <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <AccordionTrigger className="min-w-0 flex-1 rounded-md py-1 pr-2 hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400">
                        <div className="flex min-w-0 items-center gap-3 text-left">
                            <ChevronDown
                                aria-hidden="true"
                                className="h-4 w-4 shrink-0 text-zinc-500 transition-transform duration-200 group-data-[state=open]:rotate-180"
                            />
                            <div className="min-w-0">
                                <div className="flex min-w-0 items-center gap-2">
                                    <span className="truncate text-sm font-semibold text-zinc-900">
                                        {strategy.strategyName}
                                    </span>
                                    <span className="shrink-0 text-xs text-zinc-500 tabular-nums">
                                        {strategy.openPositionRules.length} entry · {strategy.closePositionRules.length} exit
                                    </span>
                                </div>
                                {strategy.description && (
                                    <span className="mt-0.5 block truncate text-xs font-normal text-zinc-500">
                                        {strategy.description}
                                    </span>
                                )}
                            </div>
                        </div>
                    </AccordionTrigger>
                    <div className="flex shrink-0 items-center gap-1 border-l border-zinc-100 pl-2">
                        <AddStrategyDialog
                            openPositionRulesEditing={strategy.openPositionRules}
                            closePositionRulesEditing={strategy.closePositionRules}
                            strategyNameEditing={strategy.strategyName}
                            descriptionEditing={strategy.description}
                            idEditing={strategy.id}
                        />
                        <DeleteStrategyButton strategy={strategy} />
                    </div>
                </div>
                <AccordionContent className="border-t border-zinc-100 px-3 pb-3 pt-2">
                    {activeTab === "rules" ? (
                        <StrategyRules strategy={strategy} />
                    ) : (
                        <StrategyHistory strategy={strategy} />
                    )}
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
}
