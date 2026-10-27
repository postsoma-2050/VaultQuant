"use client";

import { useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/redux/store";
import { setSearchQuery } from "@/redux/slices/strategySlice";

export default function SearchStrategy() {
    const dispatch = useAppDispatch();
    const searchQuery = useAppSelector((state) => state.strategies.searchQuery);
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        if (inputRef.current === null) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
                e.preventDefault();
                inputRef.current?.focus();
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, []);

    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        dispatch(setSearchQuery(e.target.value));
    };

    return (
        <div className="relative w-full min-w-[180px] max-w-xs">
            <input
                ref={inputRef}
                type="search"
                aria-label="Search strategies"
                placeholder="Search strategies"
                value={searchQuery}
                onChange={handleSearchChange}
                className="h-8 w-full rounded-md border border-zinc-200 bg-white py-1 pl-2.5 pr-12 text-[13px] text-zinc-800 placeholder:text-zinc-400 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
            />
            <div className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 text-xs text-zinc-400" aria-hidden="true">
                <kbd className="rounded border border-zinc-200 px-1 py-0.5">
                    ⌘
                </kbd>
                <kbd className="rounded border border-zinc-200 px-1 py-0.5">
                    K
                </kbd>
            </div>
        </div>
    );
}
