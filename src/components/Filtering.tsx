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

export default function Filtering({
    isStatisticsPage,
}: {
    isStatisticsPage: boolean;
}) {
    const [instrumentLabels, setInstrumentLabels] = useState<string[]>([]);
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

    // Initialize labels
    useEffect(() => {
        if (trades) {
            setInstrumentLabels([
                ...new Set(
                    trades
                        .map(t => t.symbolName?.trim())
                        .filter((s): s is string => typeof s === "string" && s.trim() !== "")
                ),
            ]);
        }
        dispatch(setFilteredTrades(trades));
    }, [trades, dispatch]);

    // Handle date filter side-effects
    useEffect(() => {
        if (!trades || trades.length === 0) return;

        if (dateRange === null) {
            setInstrumentLabels(allSymbols);
            dispatch(setFilteredTrades(trades));
            return;
        }

        const filteredTrades = trades.filter((trade) => {
            if (dateRange?.from === undefined || dateRange?.to === undefined || trade.closeDate === undefined)
                return;
            const closeDate = new Date(trade.closeDate);

            return (
                closeDate.getTime() >= dateRange.from.getTime() &&
                closeDate.getTime() <= dateRange.to.getTime()
            );
        });

        const newLabels = [
            ...new Set(filteredTrades.map((t) => t.symbolName).filter((s): s is string => typeof s === "string" && s.trim() !== "")),
        ];

        setInstrumentLabels(newLabels);
        dispatch(setFilteredTrades(filteredTrades));
    }, [trades, dateRange, allSymbols, dispatch]);

    const removeInstrumentFromList = (instrument: string) => {
        const updatedLabels = instrumentLabels.filter(
            (item) => item !== instrument
        );
        setInstrumentLabels(updatedLabels);
        applyFilteredTrades(updatedLabels);
    };

    const addInstrumentToTheList = (instrument: string) => {
        const updatedLabels = [...instrumentLabels, instrument];
        setInstrumentLabels(updatedLabels);
        applyFilteredTrades(updatedLabels);
    };

    const applyFilteredTrades = (activeLabels: string[]) => {
        const filtered = (trades ?? []).filter((trade) => {
            const sym = trade.symbolName?.trim();
            if (!sym || !activeLabels.includes(sym)) return false;

            if (!dateRange?.from || !dateRange.to || !trade.closeDate) return true;

            const closeDate = new Date(trade.closeDate).getTime();
            return (
                closeDate >= dateRange.from.getTime() &&
                closeDate <= dateRange.to.getTime()
            );
        });
        dispatch(setFilteredTrades(filtered));
    };

    const handleToggleSymbol = (symbol: string, checked: boolean) => {
        if (checked) {
            addInstrumentToTheList(symbol);
        } else {
            removeInstrumentFromList(symbol);
        }
    };

    const handleSelectAll = () => {
        setInstrumentLabels(allSymbols);
        applyFilteredTrades(allSymbols);
    };

    const handleClearAll = () => {
        setInstrumentLabels([]);
        applyFilteredTrades([]);
    };

    const handleResetAllFilters = () => {
        setDateRange(null);
        dispatch(setSortBy(undefined));
        dispatch(setTimeframe("allHistory"));
        setInstrumentLabels(allSymbols);
        dispatch(setFilteredTrades(trades));
    };

    // Calculate Popover Trigger display label
    const triggerLabel = useMemo(() => {
        const selectedCount = instrumentLabels.length;
        const totalCount = allSymbols.length;

        if (totalCount === 0 || selectedCount === totalCount) {
            return "All Symbols";
        }
        if (selectedCount === 0) {
            return "No Symbols";
        }
        if (selectedCount === 1) {
            return instrumentLabels[0];
        }
        if (selectedCount === 2) {
            return `${instrumentLabels[0]}, ${instrumentLabels[1]}`;
        }
        return `${instrumentLabels[0]}, ${instrumentLabels[1]} +${selectedCount - 2}`;
    }, [instrumentLabels, allSymbols]);

    const filteredSymbols = useMemo(() => {
        const query = searchQuery.trim().toLowerCase();
        if (!query) return allSymbols;
        return allSymbols.filter(s => s.toLowerCase().includes(query));
    }, [allSymbols, searchQuery]);

    return (
        <div className="px-6 md:px-8 py-3 border-b border-zinc-200 bg-white flex flex-wrap items-center justify-between gap-3 select-none text-zinc-800 w-full max-w-none">
            {/* Unified filters row */}
            <div className="flex flex-wrap items-center gap-2.5">
                {/* 1. Searchable popover dropdown */}
                <Popover>
                    <PopoverTrigger asChild>
                        <button className="flex items-center justify-between w-[160px] px-3 py-1.5 text-xs border border-zinc-200 rounded-lg bg-white hover:bg-zinc-50 transition-colors shadow-xs font-medium text-zinc-700">
                            <span className="flex items-center gap-1.5 truncate">
                                <Search className="w-3.5 h-3.5 text-zinc-400" />
                                <span className="truncate">{triggerLabel}</span>
                            </span>
                            <ChevronDown className="w-3 h-3 text-zinc-400" />
                        </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-3 flex flex-col gap-2 bg-white border border-zinc-200 text-zinc-800 shadow-md" align="start">
                        <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
                            <span className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">Symbols</span>
                            <div className="flex gap-2">
                                <button
                                    onClick={handleSelectAll}
                                    className="text-[10px] text-zinc-600 hover:text-zinc-900 font-bold transition-colors"
                                >
                                    All
                                </button>
                                <span className="text-zinc-300 text-[10px]">|</span>
                                <button
                                    onClick={handleClearAll}
                                    className="text-[10px] text-zinc-500 hover:text-rose-600 font-bold transition-colors"
                                >
                                    Clear
                                </button>
                            </div>
                        </div>
                        <Input
                            placeholder="Search symbol..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="h-8 text-xs bg-zinc-50/50 border-zinc-200 text-zinc-800 placeholder:text-zinc-400 focus-visible:ring-zinc-400"
                        />
                        <div className="max-h-56 overflow-y-auto flex flex-col gap-1 pr-1 mt-1 font-mono">
                            {filteredSymbols.length === 0 ? (
                                <p className="text-[11px] text-zinc-400 text-center py-4">No matching symbols</p>
                            ) : (
                                filteredSymbols.map((symbol) => (
                                    <label
                                        key={symbol}
                                        className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-zinc-50 cursor-pointer text-xs text-zinc-700 font-medium transition-colors"
                                    >
                                        <Checkbox
                                            checked={instrumentLabels.includes(symbol)}
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
                        {/* 2. Open / Closed Tab toggle */}
                        <Tabs
                            value={activeTab === "openTrades" ? "open-trades" : "close-trades"}
                            onValueChange={(value) =>
                                dispatch(setActiveTab(value === "open-trades" ? "openTrades" : "closedTrades"))
                            }
                            className="h-8"
                        >
                            <TabsList className="grid w-[130px] grid-cols-2 h-8 bg-zinc-100/80 border border-zinc-200/80 p-0.5 rounded-lg">
                                <TabsTrigger value="open-trades" className="text-xs h-7 py-0 font-medium data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-xs">Open</TabsTrigger>
                                <TabsTrigger value="close-trades" className="text-xs h-7 py-0 font-medium data-[state=active]:bg-white data-[state=active]:text-zinc-900 data-[state=active]:shadow-xs">Closed</TabsTrigger>
                            </TabsList>
                        </Tabs>

                        {/* 3. Date Picker with reset support */}
                        <DatePickerWithRange
                            setDateRangeForFiltering={setDateRange}
                            dateRange={dateRange}
                        />

                        {/* 4. Sort Dropdown */}
                        <Select
                            value={sortBy || ""}
                            onValueChange={(value) => dispatch(setSortBy(value || undefined))}
                        >
                            <SelectTrigger className="w-[120px] h-8 text-xs bg-white border-zinc-200 text-zinc-700 shadow-xs focus:ring-zinc-400">
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

                        {/* 5. Period Select */}
                        <Select
                            value={timeframe}
                            onValueChange={(value) => dispatch(setTimeframe(value))}
                        >
                            <SelectTrigger className="w-[120px] h-8 text-xs bg-white border-zinc-200 text-zinc-700 shadow-xs focus:ring-zinc-400">
                                <SelectValue placeholder="All history" />
                            </SelectTrigger>
                            <SelectContent className="bg-white border-zinc-200 text-zinc-800">
                                <SelectGroup>
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
                    onClick={handleResetAllFilters}
                    className="text-xs text-zinc-500 hover:text-zinc-900 transition-colors font-medium px-3 py-1.5 bg-white hover:bg-zinc-50 rounded-lg border border-zinc-200 shadow-xs"
                >
                    Clear filters
                </button>
            )}
        </div>
    );
}
