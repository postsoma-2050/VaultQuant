"use client";
import React from "react";
import { useAppDispatch, useAppSelector } from "@/redux/store";
import { setActiveTab } from "@/redux/slices/strategySlice";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";

const SlidingTabs: React.FC = () => {
    const dispatch = useAppDispatch();
    const activeTab = useAppSelector((state) => state.strategies.activeTab);

    return (
        <Tabs
            value={activeTab}
            onValueChange={(value) => dispatch(setActiveTab(value as "rules" | "history"))}
        >
            <TabsList className="h-8 rounded-md bg-zinc-100 p-0.5">
                <TabsTrigger value="rules" className="h-7 px-3 text-[13px]">
                    Rules
                </TabsTrigger>
                <TabsTrigger value="history" className="h-7 px-3 text-[13px]">
                    History
                </TabsTrigger>
            </TabsList>
        </Tabs>
    );
};
export default SlidingTabs;
