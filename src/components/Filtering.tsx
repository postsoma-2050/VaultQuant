"use client";

import { useAppDispatch, useAppSelector } from "@/redux/store";
import { useEffect, useState, useMemo } from "react";
import { ChevronDown, Search } from "lucide-react";
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "./ui/select";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover";
import { Checkbox } from "./ui/checkbox";
import { Input } from "./ui/input";
import {
    setFilteredTrades,
    setSortBy,
    setTimeframe,
    setActiveTab,
} from "@/redux/slices/historyPageSlice";
import { DatePickerWithRange } from "./history/DatePicker";
import { DateRange } from "react-day-picker";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import { filterTradesBySymbolsAndDate } from "@/features/history/sortTrades";

export default function Filtering({
    isStatisticsPage,
}: {
    isStatisticsPage: boolean;
}) {
    const [selectedSymbols, setSelectedSymbols] = useState<string[] | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [dateRange, setDateRange] = useState<DateRange | null>(null);

    const trades = useAppSelector((state) => state.tradeRecords.listOfTrades);
    const sortBy = useAppSelector((state) => state.history.sortBy);
    const timeframe = useAppSelector((state) => state.history.timeframe);
    const activeTab = useAppSelector((state) => state.history.activeTab);

    const dispatch = useAppDispatch();

    // Compile the unique set of all available symbol labels
    const allSymbols = useMemo(() => {
        if (!trades) return [];
        return [...new Set(
            trades
                .map(t => t.symbolName?.trim())
                .filter((s): s is string => typeof s === "string" && s.trim() !== "")
        )].sort();
    }, [trades]);

    const filteredTrades = useMemo(
        () => filterTradesBySymbolsAndDate({
            trades: trades ?? [],
            selectedSymbols,
            dateRange,
        }),
        [trades, selectedSymbols, dateRange]
    );

    useEffect(() => {
        dispatch(setFilteredTrades(filteredTrades));
    }, [filteredTrades, dispatch]);

    const handleToggleSymbol = (symbol: string, checked: boolean) => {
        setSelectedSymbols((current) => {
            const next = new Set(current ?? allSymbols);
            if (checked) next.add(symbol);
            else next.delete(symbol);
            return [...next];
        });
    };

    const handleSelectAll = () => {
        setSelectedSymbols(null);
    };

    const handleClearAll = () => {
        setSelectedSymbols([]);
    };

    const handleResetAllFilters = () => {
        setDateRange(null);
        dispatch(setSortBy(undefined));
        dispatch(setTimeframe("allHistory"));
        setSelectedSymbols(null);
    };

    const handleDateRangeChange: React.Dispatch<
        React.SetStateAction<DateRange | null>
    > = (value) => {
        setDateRange((current) => {
            const range = typeof value === "function" ? value(current) : value;
            return range;
        });
        if (typeof value !== "function" && value?.from && value?.to) {
            dispatch(setTimeframe("allHistory"));
        }
    };

    const handleTimeframeChange = (value: string) => {
        setDateRange(null);
        dispatch(setTimeframe(value));
    };

    // Calculate Popover Trigger display label
    const triggerLabel = useMemo(() => {
        const selectedCount = selectedSymbols?.length ?? allSymbols.length;
        const totalCount = allSymbols.length;

        if (totalCount === 0 || selectedCount === totalCount) {
            return "All Symbols";
        }
        if (selectedCount === 0) {
            return "No Symbols";
        }
        if (selectedCount === 1) {
            return selectedSymbols?.[0] ?? "All Symbols";
        }
        if (selectedCount === 2) {
            return selectedSymbols?.slice(0, 2).join(", ") ?? "All Symbols";
        }
        return `${selectedSymbols?.slice(0, 2).join(", ")} +${selectedCount - 2}`;
    }, [selectedSymbols, allSymbols]);

    const filteredSymbols = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return allSymbols;
        return allSymbols.filter(s => s.toLowerCase().includes(query));
    }, [allSymbols, searchQuery]);

    return (
        <div className="px-4 py-3 border-b border-zinc-200 bg-white flex flex-wrap items-center justify-between gap-3 text-zinc-800 w-full max-w-none">
            {/* Unified filters row */}
            <div className="flex flex-wrap items-center gap-2.5">
                {/* Searchable symbol filter */}
                <Popover>
                    <PopoverTrigger asChild>
                        <button
                            type="button"
                            aria-label={`Filter symbols. ${triggerLabel}`}
                            className="flex items-center justify-between w-[168px] px-3 py-1.5 text-[13px] border border-zinc-200 rounded-md bg-white hover:bg-zinc-50 transition-colors shadow-xs font-medium text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                        >
                            <span className="flex items-center gap-1.5 truncate">
                                <Search className="w-3.5 h-3.5 text-zinc-400" />
                                <span className="truncate">{triggerLabel}</span>
                            </span>
                            <ChevronDown className="w-3 h-3 text-zinc-400" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-3 flex flex-col gap-2 bg-white border border-zinc-200 text-zinc-800 shadow-md" align="start">
                        <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                            <span className="text-xs font-semibold text-zinc-500">Symbols</span>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={handleSelectAll}
                                    className="text-xs text-zinc-600 hover:text-zinc-900 font-medium transition-colors"
                                >
                                    All
                                </button>
                                <span className="text-zinc-300 text-xs">|</span>
                                <button
                                    type="button"
                                    onClick={handleClearAll}
                                    className="text-xs text-zinc-500 hover:text-rose-600 font-medium transition-colors"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                        <Input
                            placeholder="Search symbol..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-8 text-[13px] bg-zinc-50/50 border-zinc-200 text-zinc-800 placeholder:text-zinc-400 focus-visible:ring-zinc-400"
                        />
                        <div className="max-h-56 overflow-y-auto flex flex-col gap-1 pr-1 mt-1">
                            {filteredSymbols.length === 0 ? (
                                <p className="text-xs text-zinc-500 text-center py-4">No matching symbols</p>
                            ) : (
                                filteredSymbols.map((symbol) => (
                                    <label
                                        key={symbol}
                                        className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-zinc-50 cursor-pointer text-[13px] text-zinc-700 font-medium transition-colors"
                                    >
                                        <Checkbox
                                            checked={selectedSymbols === null || selectedSymbols.includes(symbol)}
                                            onCheckedChange={(checked) => handleToggleSymbol(symbol, !!checked)}
                                        />
                                        <span className="truncate">{symbol}</span>
                                    </label>
                                ))
                            )}
                        </div>
                    </PopoverContent>
                </Popover>

                {!isStatisticsPage && (
                    <>
                        {/* Open / Closed tab toggle */}
                        <Tabs
                            value={activeTab === "openTrades" ? "open-trades" : "close-trades"}
                            onValueChange={(value) =>
                                dispatch(setActiveTab(value === "open-trades" ? "openTrades" : "closedTrades"))
                            }
                            className="h-8"
                        >
                            <TabsList className="grid w-[136px] grid-cols-2 h-8 bg-zinc-100 border border-zinc-200 p-0.5 rounded-md">
                                <TabsTrigger value="open-trades" className="text-[13px] h-7 py-0 font-medium data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-xs">Open</TabsTrigger>
                                <TabsTrigger value="close-trades" className="text-[13px] h-7 py-0 font-medium data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-xs">Closed</TabsTrigger>
                            </TabsList>
                        </Tabs>

                        {/* Date range */}
                        <DatePickerWithRange
                            setDateRangeForFiltering={handleDateRangeChange}
                            dateRange={dateRange}
                        />

                        {/* Sort */}
                        <Select
                            value={sortBy || ""}
                            onValueChange={(value) => dispatch(setSortBy(value || undefined))}
                        >
                            <SelectTrigger className="w-[124px] h-8 text-[13px] bg-white border-zinc-200 text-zinc-700 shadow-xs focus:ring-zinc-400">
                                <SelectValue placeholder="Sort by" />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-zinc-200 text-zinc-800">
                                <SelectGroup>
                                    <SelectItem value="symbolName">Symbol</SelectItem>
                                    <SelectItem value="positionType">Type</SelectItem>
                                    <SelectItem value="closeDate">Close date</SelectItem>
                                    <SelectItem value="openDate">Open date</SelectItem>
                                    <SelectItem value="result">Result</SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>

                        {/* Period */}
                        <Select
                            value={dateRange?.from ? "custom" : timeframe}
                            onValueChange={handleTimeframeChange}
                        >
                            <SelectTrigger className="w-[124px] h-8 text-[13px] bg-white border-zinc-200 text-zinc-700 shadow-xs focus:ring-zinc-400">
                                <SelectValue placeholder="All history" />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-zinc-200 text-zinc-800">
                                <SelectGroup>
                                    <SelectItem value="custom" disabled>Custom range</SelectItem>
                                    <SelectItem value="today">Today</SelectItem>
                                    <SelectItem value="thisWeek">Last 7 days</SelectItem>
                                    <SelectItem value="thisMonth">This month</SelectItem>
                                    <SelectItem value="allHistory">All history</SelectItem>
                                </SelectGroup>
                            </SelectContent>
                        </Select>
                    </>
                )}
            </div>

            {/* Clear Filters reset triggers */}
            {!isStatisticsPage && (
                <button
                    type="button"
                    onClick={handleResetAllFilters}
                    className="text-[13px] text-zinc-500 hover:text-zinc-900 transition-colors font-medium px-3 py-1.5 bg-white hover:bg-zinc-50 rounded-md border border-zinc-200 shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                >
                    Clear filters
                </button>
            )}
        </div>
    );
}
