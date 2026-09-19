"use client";

import { cn } from "@/lib/utils";
import { ChevronRight, FileText, Calendar as CalendarIcon, Plus, Search } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useMemo, useEffect } from "react";
import dayjs from "dayjs";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface JournalSidebarProps {
    dates: string[] | { date: string; summary?: string }[];
}

type TreeStructure = {
    [year: string]: {
        [month: string]: string[]; // Array of days
    };
};

export function JournalSidebar({ dates }: JournalSidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [expandedYears, setExpandedYears] = useState<string[]>([]);
    const [expandedMonths, setExpandedMonths] = useState<string[]>([]);
    const [isCalendarOpen, setIsCalendarOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");

    // Normalize dates prop
    const entriesList = useMemo(() => {
        return dates.map((d) => {
            if (typeof d === "string") {
                return { date: d, summary: "" };
            }
            return d;
        });
    }, [dates]);

    // Client-side search and filter
    const filteredEntries = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return entriesList;
        return entriesList.filter(
            (entry) =>
                entry.date.toLowerCase().includes(query) ||
                (entry.summary && entry.summary.toLowerCase().includes(query))
        );
    }, [entriesList, searchQuery]);

    // Build tree structure from filtered entries
    const tree = useMemo(() => {
        const t: TreeStructure = {};
        filteredEntries.forEach((entry) => {
            const d = dayjs(entry.date);
            const year = d.format("YYYY");
            const month = d.format("MMM");
            const day = entry.date;

            if (!t[year]) t[year] = {};
            if (!t[year][month]) t[year][month] = [];
            t[year][month].push(day);
        });
        return t;
    }, [filteredEntries]);

    // Sort years descending
    const sortedYears = useMemo(() => {
        return Object.keys(tree).sort((a, b) => Number(b) - Number(a));
    }, [tree]);

    const summariesMap = useMemo(() => {
        const map = new Map<string, string>();
        entriesList.forEach((entry) => {
            map.set(entry.date, entry.summary || "");
        });
        return map;
    }, [entriesList]);

    // Automatically expand active year/month and collapse other branches
    useEffect(() => {
        const match = pathname.match(/^\/private\/journal\/(\d{4})\/(\d{2})\/(\d{2})$/);
        if (match) {
            const formattedDatePath = pathname.replace("/private/journal/", "").replace(/\//g, "-");
            const d = dayjs(formattedDatePath);
            if (d.isValid()) {
                const year = d.format("YYYY");
                const month = d.format("MMM");
                const monthKey = `${year}-${month}`;
                
                setExpandedYears([year]);
                setExpandedMonths([monthKey]);
            }
        }
    }, [pathname]);

    const toggleYear = (year: string) => {
        setExpandedYears((prev) =>
            prev.includes(year)
                ? prev.filter((y) => y !== year)
                : [...prev, year]
        );
    };

    const toggleMonth = (monthKey: string) => {
        setExpandedMonths((prev) =>
            prev.includes(monthKey)
                ? prev.filter((m) => m !== monthKey)
                : [...prev, monthKey]
        );
    };

    const handleDateSelect = (date: Date | undefined) => {
        if (date) {
            const formattedDate = dayjs(date).format("YYYY/MM/DD");
            router.push(`/private/journal/${formattedDate}`);
            setIsCalendarOpen(false);
        }
    };

    return (
        <div className="w-64 border-r h-full bg-zinc-50/50 flex flex-col">
            <div className="flex-1 p-4 overflow-y-auto">
                <div className="font-semibold text-sm text-zinc-500 mb-3 px-2">
                    Daily Journal Entries
                </div>
                <Link
                    href={`/private/journal/${dayjs().format("YYYY/MM/DD")}`}
                    className="flex items-center justify-center gap-2 w-full py-2 mb-3 text-xs font-semibold bg-zinc-900 text-white hover:bg-zinc-800 rounded-md transition-colors shadow-sm text-center"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Write Today&apos;s Entry
                </Link>
                <div className="relative mb-4 px-1.5">
                    <Search className="absolute left-3.5 top-2.5 h-3.5 w-3.5 text-zinc-400" />
                    <Input
                        placeholder="Search entries..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-8 h-8 text-xs focus-visible:ring-zinc-400 bg-white"
                    />
                </div>
                <div className="space-y-1">
                    {sortedYears.map((year) => (
                        <div key={year}>
                            <button
                                onClick={() => toggleYear(year)}
                                className="flex items-center w-full px-2 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 rounded-md transition-colors"
                            >
                                <ChevronRight
                                    className={cn(
                                        "h-4 w-4 mr-1 text-zinc-400 transition-transform",
                                        expandedYears.includes(year) && "rotate-90"
                                    )}
                                />
                                {year}
                            </button>

                            {expandedYears.includes(year) && (
                                <div className="ml-4 mt-1 space-y-1 border-l border-zinc-200 pl-2">
                                    {Object.keys(tree[year]).map((month) => {
                                        const monthKey = `${year}-${month}`;
                                        return (
                                            <div key={monthKey}>
                                                <button
                                                    onClick={() => toggleMonth(monthKey)}
                                                    className="flex items-center w-full px-2 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors"
                                                >
                                                    <ChevronRight
                                                        className={cn(
                                                            "h-3.5 w-3.5 mr-1 text-zinc-400 transition-transform",
                                                            expandedMonths.includes(monthKey) && "rotate-90"
                                                        )}
                                                    />
                                                    {month}
                                                </button>

                                                {expandedMonths.includes(monthKey) && (
                                                    <div className="ml-4 mt-1 space-y-1 border-l border-zinc-200 pl-2">
                                                        {tree[year][month].map((date) => {
                                                            const d = dayjs(date);
                                                            const isActive = pathname === `/private/journal/${d.format("YYYY/MM/DD")}`;
                                                            const summary = summariesMap.get(date);
                                                            return (
                                                                <Link
                                                                    key={date}
                                                                    href={`/private/journal/${d.format("YYYY/MM/DD")}`}
                                                                    className={cn(
                                                                        "flex flex-col w-full px-2 py-1.5 text-sm rounded-md transition-colors gap-0.5",
                                                                        isActive
                                                                            ? "bg-orange-50 text-orange-600 font-medium"
                                                                            : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
                                                                    )}
                                                                >
                                                                    <div className="flex items-center w-full">
                                                                        <FileText className="h-3.5 w-3.5 mr-2 opacity-70 shrink-0" />
                                                                        <span>{d.format("D MMM")}</span>
                                                                    </div>
                                                                    {summary && (
                                                                        <span className="text-[10px] text-zinc-400 font-normal truncate pl-5 block max-w-full">
                                                                            {summary}
                                                                        </span>
                                                                    )}
                                                                </Link>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ))}
                    {sortedYears.length === 0 && (
                        <div className="text-sm text-zinc-400 px-2 py-4 text-center">
                            No entries yet
                        </div>
                    )}
                </div>
            </div>
            
            <div className="p-4 border-t border-zinc-200">
                <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            className="w-full justify-start text-left font-normal text-sm"
                        >
                            <CalendarIcon className="mr-2 h-4 w-4 text-zinc-400" />
                            Select day
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-2 bg-white border border-zinc-200 shadow-md rounded-md flex flex-col gap-1" align="start">
                        <Calendar
                            mode="single"
                            onSelect={handleDateSelect}
                            initialFocus
                        />
                        <div className="flex justify-end border-t border-zinc-100 pt-2 mt-1">
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setIsCalendarOpen(false)}
                                className="text-xs h-7 py-1 px-3 text-zinc-500 hover:text-zinc-800"
                            >
                                Cancel
                            </Button>
                        </div>
                    </PopoverContent>
                </Popover>
            </div>
        </div>
    );
}
