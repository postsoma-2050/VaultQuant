"use client";

import { ReactNode, useEffect, useState } from "react";
import { Toaster } from "sonner";
import { useAppDispatch, useAppSelector } from "@/redux/store";
import {
    setInitialMonthViewSummary,
    setInitialTotalOfParticularYearSummary,
    setInitialYearViewSummary,
    setListOfTrades,
    setTradeDetailsForEachDay,
} from "@/redux/slices/tradeRecordsSlice";
import { setStrategyState } from "@/redux/slices/strategySlice";
import { Trades } from "@/types";
import { Strategy } from "@/types/strategies.types";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
    Shield,
    Database,
    Calendar as CalendarIcon,
    History as HistoryIcon,
    Target,
    BarChart2,
    BookOpen,
    Sparkles,
    ExternalLink,
    Github,
    Lightbulb,
    PanelLeftClose,
    PanelLeftOpen,
    Upload
} from "lucide-react";
import { getTradeSummary } from "@/features/calendar/getTradeSummary";
import { getTradeDetailsForEachDay } from "@/features/calendar/getTradeDetailsForEachDay";
import ImportExportModal from "@/components/import-export/ImportExportModal";

interface PrivateLayoutClientProps {
    children: ReactNode;
    initialTradeRecords: Trades[];
    initialStrategies: Strategy[];
}

export default function PrivateLayoutClient({
    children,
    initialTradeRecords,
    initialStrategies,
}: PrivateLayoutClientProps) {
    const dispatch = useAppDispatch();
    const pathname = usePathname();
    const [isMounted, setIsMounted] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);

    const currentTradesInStore = useAppSelector((state) => state.tradeRecords.listOfTrades);
    const currentStrategiesInStore = useAppSelector((state) => state.strategies.strategies);

    useEffect(() => {
        setIsMounted(true);

        // Only initialize Redux store on initial mount or when store is empty
        if (currentTradesInStore === null) {
            dispatch(setListOfTrades(initialTradeRecords));

            if (initialTradeRecords && initialTradeRecords.length > 0) {
                const monthVal = getTradeSummary("day", initialTradeRecords);
                const yearVal = getTradeSummary("month", initialTradeRecords);
                const particularYearVal = getTradeSummary("year", initialTradeRecords);
                const detailsVal = getTradeDetailsForEachDay(initialTradeRecords);

                dispatch(setInitialMonthViewSummary(monthVal));
                dispatch(setInitialYearViewSummary(yearVal));
                dispatch(setInitialTotalOfParticularYearSummary(particularYearVal));
                dispatch(setTradeDetailsForEachDay(detailsVal));
            } else {
                dispatch(setInitialMonthViewSummary({}));
                dispatch(setInitialYearViewSummary({}));
                dispatch(setInitialTotalOfParticularYearSummary({}));
                dispatch(setTradeDetailsForEachDay({}));
            }
        }

        if (currentStrategiesInStore === null || currentStrategiesInStore.length === 0 || (initialStrategies && initialStrategies.length > currentStrategiesInStore.length)) {
            dispatch(setStrategyState(initialStrategies));
        }
    }, [
        dispatch,
        initialTradeRecords,
        initialStrategies,
        currentTradesInStore,
        currentStrategiesInStore,
    ]);

    const getUserDisplayName = () => {
        return "Local User";
    };

    const mainNavItems = [
        { label: "Calendar", href: "/private/calendar", icon: CalendarIcon },
        { label: "History", href: "/private/history", icon: HistoryIcon },
        { label: "Strategies", href: "/private/strategies", icon: Target },
        { label: "Statistics", href: "/private/statistics", icon: BarChart2 },
        { label: "Daily Journal", href: "/private/journal", icon: BookOpen },
        { label: "AI Reports", href: "/private/tradeAI", icon: Sparkles },
    ];

    const ecosystemItems = [
        { label: "QuantBrew", href: "https://quantbrews.win/", icon: ExternalLink, external: true },
        { label: "Insights", href: "https://www.postsoma-2050.com/", icon: Lightbulb, external: true },
        { label: "Give ⭐ on GitHub", href: "https://github.com/postsoma-2050/VaultQuant", icon: Github, external: true },
    ];

    return (
        <>
            <Toaster position="top-right" richColors />
            <div className="flex h-screen bg-zinc-50/50 text-zinc-900 font-sans selection:bg-zinc-200 overflow-hidden">
                
                {/* PHYSICAL STEP 1: COLLAPSIBLE MINI-SIDEBAR */}
                <aside className={`${
                    isCollapsed ? "w-16 p-2.5" : "w-60 p-4"
                } h-screen fixed left-0 top-0 bg-zinc-50 border-r border-zinc-200 flex flex-col justify-between z-40 shrink-0 select-none transition-all duration-300`}>
                    <div className="space-y-6">
                        {/* VaultQuant Brand Logo & Toggle Button */}
                        <div className={`flex items-center ${isCollapsed ? "justify-center flex-col gap-2" : "justify-between"} px-1 py-1`}>
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 rounded-xl bg-white border border-zinc-200 text-zinc-800 shadow-xs shrink-0">
                                    <Shield className="w-5 h-5" />
                                </div>
                                {!isCollapsed && (
                                    <div>
                                        <h1 className="font-bold text-sm tracking-tight text-zinc-900 flex items-center gap-1.5">
                                            VaultQuant
                                        </h1>
                                        <span className="text-[9.5px] font-mono text-zinc-500 font-semibold px-1.5 py-0.5 rounded-full bg-zinc-200/60 border border-zinc-300 uppercase tracking-wider">
                                            LOCAL-FIRST
                                        </span>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => setIsCollapsed(!isCollapsed)}
                                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                                className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-900 hover:bg-zinc-200/60 transition-colors shrink-0"
                            >
                                {isCollapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
                            </button>
                        </div>

                        {/* Navigation Links Group */}
                        <div className="space-y-4">
                            <div>
                                {!isCollapsed && (
                                    <p className="px-2 text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-2">
                                        Main Navigation
                                    </p>
                                )}
                                <nav className="space-y-1">
                                    {mainNavItems.map((item) => {
                                        const Icon = item.icon;
                                        const isActive = pathname === item.href || (item.href === "/private/tradeAI" && pathname.startsWith("/private/tradeAI"));
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                title={isCollapsed ? item.label : undefined}
                                                className={`w-full flex items-center ${isCollapsed ? "justify-center px-0 py-2.5" : "justify-between px-3 py-2"} rounded-lg text-xs font-medium transition-all ${
                                                    isActive
                                                        ? "bg-white text-zinc-900 font-semibold border border-zinc-200/80 shadow-xs"
                                                        : "text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/40"
                                                }`}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? "text-zinc-900" : "text-zinc-500"}`} />
                                                    {!isCollapsed && <span>{item.label}</span>}
                                                </div>
                                                {!isCollapsed && isActive && <div className="w-1.5 h-1.5 rounded-full bg-zinc-900" />}
                                            </Link>
                                        );
                                    })}
                                    
                                    {/* Data Import & Backup Restore Button */}
                                    <button
                                        onClick={() => setIsImportModalOpen(true)}
                                        title={isCollapsed ? "Import & Backup" : undefined}
                                        className={`w-full flex items-center ${isCollapsed ? "justify-center px-0 py-2.5" : "justify-between px-3 py-2"} rounded-lg text-xs font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 transition-all cursor-pointer mt-2`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <Upload className="w-4 h-4 text-amber-600 shrink-0" />
                                            {!isCollapsed && <span className="font-semibold">Import & Backup</span>}
                                        </div>
                                    </button>
                                </nav>
                            </div>

                            <div>
                                {!isCollapsed && (
                                    <p className="px-2 text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider mb-2">
                                        Ecosystem
                                    </p>
                                )}
                                <nav className="space-y-1">
                                    {ecosystemItems.map((item) => {
                                        const Icon = item.icon;
                                        return (
                                            <a
                                                key={item.href}
                                                href={item.href}
                                                target="_blank"
                                                rel="noreferrer"
                                                title={isCollapsed ? item.label : undefined}
                                                className={`w-full flex items-center ${isCollapsed ? "justify-center px-0 py-2.5" : "justify-between px-3 py-2"} rounded-lg text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/40 transition-all`}
                                            >
                                                <div className="flex items-center gap-2.5">
                                                    <Icon className="w-4 h-4 text-zinc-500 shrink-0" />
                                                    {!isCollapsed && <span>{item.label}</span>}
                                                </div>
                                            </a>
                                        );
                                    })}
                                </nav>
                            </div>
                        </div>
                    </div>

                    {/* Sidebar Footer: Engine Badge & User Avatar */}
                    <div className="space-y-3 pt-3 border-t border-zinc-200">
                        {!isCollapsed ? (
                            <>
                                <div className="flex items-center justify-between px-2 text-[11px] font-mono text-zinc-500">
                                    <span className="flex items-center gap-1.5">
                                        <Database className="w-3.5 h-3.5 text-emerald-600" /> Engine
                                    </span>
                                    <span className="text-[10px] text-zinc-600">file:local.db</span>
                                </div>

                                <div className="flex items-center justify-between p-2 rounded-xl bg-white border border-zinc-200/80 shadow-xs">
                                    {isMounted ? (
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full bg-zinc-900 text-white flex items-center justify-center font-mono font-bold text-xs">
                                                LU
                                            </div>
                                            <span className="text-zinc-800 font-medium text-xs truncate">
                                                {getUserDisplayName()}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="w-7 h-7 rounded-full bg-zinc-200 animate-pulse" />
                                    )}
                                </div>
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-2 py-1">
                                <span title="Engine: file:local.db">
                                    <Database className="w-4 h-4 text-emerald-600" />
                                </span>
                                <div className="w-7 h-7 rounded-full bg-zinc-900 text-white flex items-center justify-center font-mono font-bold text-xs" title="Local User">
                                    LU
                                </div>
                            </div>
                        )}
                    </div>
                </aside>

                {/* PHYSICAL STEP 2: FULL-BLEED RIGHT CANVAS (w-full max-w-none) */}
                <main className={`flex-1 ${isCollapsed ? "ml-16" : "ml-60"} bg-zinc-50/50 min-h-screen overflow-y-auto transition-all duration-300`}>
                    {children}
                </main>
            </div>
            <ImportExportModal
                isOpen={isImportModalOpen}
                onClose={() => setIsImportModalOpen(false)}
            />
        </>
    );
}
