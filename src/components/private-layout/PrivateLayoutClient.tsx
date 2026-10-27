"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
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
    Calendar as CalendarIcon,
    History as HistoryIcon,
    Target,
    BarChart2,
    BookOpen,
    FileText,
    ExternalLink,
    Github,
    Lightbulb,
    PanelLeftClose,
    PanelLeftOpen,
    Upload
} from "lucide-react";
import { VaultQuantLogo } from "@/components/icons";
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
    const [isCollapsed, setIsCollapsed] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const strategiesInitialized = useRef(false);

    const currentTradesInStore = useAppSelector((state) => state.tradeRecords.listOfTrades);
    const currentStrategiesInStore = useAppSelector((state) => state.strategies.strategies);

    useEffect(() => {

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

        if (!strategiesInitialized.current) {
            strategiesInitialized.current = true;
            // Do not restore server props after an in-session strategy deletion.
            if (currentStrategiesInStore.length === 0) dispatch(setStrategyState(initialStrategies));
        }
    }, [
        dispatch,
        initialTradeRecords,
        initialStrategies,
        currentTradesInStore,
        currentStrategiesInStore,
    ]);


    useEffect(() => {
        if (currentTradesInStore === null) return;
        // Rebuild derived totals from the canonical ledger after every mutation.
        dispatch(setInitialMonthViewSummary(getTradeSummary("day", currentTradesInStore)));
        dispatch(setInitialYearViewSummary(getTradeSummary("month", currentTradesInStore)));
        dispatch(setInitialTotalOfParticularYearSummary(getTradeSummary("year", currentTradesInStore)));
        dispatch(setTradeDetailsForEachDay(getTradeDetailsForEachDay(currentTradesInStore)));
    }, [currentTradesInStore, dispatch]);

    const mainNavItems = [
        { label: "Calendar", href: "/private/calendar", icon: CalendarIcon },
        { label: "History", href: "/private/history", icon: HistoryIcon },
        { label: "Strategies", href: "/private/strategies", icon: Target },
        { label: "Statistics", href: "/private/statistics", icon: BarChart2 },
        { label: "Daily Journal", href: "/private/journal", icon: BookOpen },
        { label: "Reports", href: "/private/tradeAI", icon: FileText },
    ];

    const ecosystemItems = [
        { label: "QuantBrew", href: "https://quantbrews.win/", icon: ExternalLink, external: true },
        { label: "Insights", href: "https://www.postsoma-2050.com/", icon: Lightbulb, external: true },
        { label: "GitHub", href: "https://github.com/postsoma-2050/VaultQuant", icon: Github, external: true },
    ];

    return (
        <>
            <Toaster position="top-right" richColors />
            <div className="vaultquant-workspace flex h-dvh min-h-0 bg-zinc-50 text-zinc-900 font-sans selection:bg-zinc-200 overflow-hidden">
                
                {/* PHYSICAL STEP 1: COLLAPSIBLE MINI-SIDEBAR */}
                <aside className={`${
                    isCollapsed ? "w-16 p-2.5" : "w-52 p-3"
                } h-dvh fixed left-0 top-0 bg-zinc-50 border-r border-zinc-200 flex flex-col z-40 shrink-0 select-none`}>
                    <div className="min-h-0 flex-1 overflow-y-auto space-y-6 pb-4">
                        {/* VaultQuant Brand Logo & Toggle Button */}
                        <div className={`flex items-center ${isCollapsed ? "justify-center flex-col gap-2" : "justify-between"} px-1 py-1`}>
                            <div className="flex items-center gap-3">
                                <div className="p-1.5 rounded-xl bg-white border border-zinc-200 text-zinc-800 shadow-xs shrink-0">
                                    <VaultQuantLogo className="w-5 h-5 text-zinc-900" />
                                </div>
                                {!isCollapsed && (
                                    <div>
                                        <span className="font-bold text-sm tracking-tight text-zinc-900 flex items-center gap-1.5">
                                            VaultQuant
                                        </span>
                                        <span className="text-xs text-zinc-500">
                                            Trading journal
                                        </span>
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={() => setIsCollapsed(!isCollapsed)}
                                title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                                aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                                aria-expanded={!isCollapsed}
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
                                        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`) || (item.href === "/private/tradeAI" && pathname.startsWith("/private/reports-history"));
                                        return (
                                            <Link
                                                key={item.href}
                                                href={item.href}
                                                title={isCollapsed ? item.label : undefined}
                                                aria-label={item.label}
                                                aria-current={isActive ? "page" : undefined}
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
                                        className={`w-full flex items-center ${isCollapsed ? "justify-center px-0 py-2.5" : "justify-between px-3 py-2"} rounded-lg text-xs font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-200/50 transition-all cursor-pointer`}
                                    >
                                        <div className="flex items-center gap-2.5">
                                            <Upload className="w-4 h-4 text-zinc-500 shrink-0" />
                                            {!isCollapsed && <span>Import & Backup</span>}
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

                    {/* Sidebar Footer: Engine Badge */}
                    <div className="shrink-0 pt-3 border-t border-zinc-200/80">
                        {!isCollapsed ? (
                            <div className="flex items-center justify-between px-2 text-[11px] font-mono text-zinc-500">
                                <span className="flex items-center gap-1.5 text-zinc-700 font-medium">
                                    <span className="w-2 h-2 rounded-full bg-emerald-600 inline-block" /> Local workspace
                                </span>
                            </div>
                        ) : (
                            <div className="flex justify-center py-1" title="SQLite Active: local.db">
                                <span className="w-2 h-2 rounded-full bg-emerald-500" />
                            </div>
                        )}
                    </div>
                </aside>

                {/* PHYSICAL STEP 2: FULL-BLEED RIGHT CANVAS (w-full max-w-none) */}
                <main id="workspace-content" className={`flex-1 min-w-0 min-h-0 h-full ${isCollapsed ? "ml-16" : "ml-52"} bg-zinc-50/50 overflow-auto`}>
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
