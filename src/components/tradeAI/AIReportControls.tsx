"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { FileText, FolderOpen, Sparkles, ShieldCheck, Database, ArrowRight, Activity, Clock, BarChart3, AlertTriangle } from "lucide-react";
import { useAppSelector } from "@/redux/store";

export default function AIReportControls() {
    const router = useRouter();
    const trades = useAppSelector((state) => state.tradeRecords.listOfTrades);
    const [loading, setLoading] = useState(false);
    const tradeCount = trades?.length ?? 0;
    const canGenerate = tradeCount >= 3;

    const handleNavigate = async () => {
        if (loading) return;
        setLoading(true);

        if (!canGenerate) {
            toast.error(
                "You need at least 3 trades to generate a report. Keep trading and try again!"
            );
            setLoading(false);
            return;
        }

        router.push("/private/tradeAI/report");
    };

    return (
        <div className="min-h-full w-full space-y-4 bg-zinc-50/50 p-4 text-zinc-900 md:p-6">
            
            {/* BENTO CARD 1: Header Banner Card (Span 12) */}
            <div className="w-full p-5 md:p-6 rounded-2xl bg-white border border-zinc-200/80 shadow-xs relative overflow-hidden">
                <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="space-y-1.5">
                        <div className="flex items-center gap-2.5">
                            <div className="p-2 rounded-xl bg-zinc-100 text-zinc-700 border border-zinc-200 shadow-xs">
                                <FileText size={18} />
                            </div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-xl font-bold text-zinc-900 tracking-tight">
                                    Trading Reports
                                </h2>
                                <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-600 border border-zinc-200 uppercase tracking-wider">
                                    VaultQuant Engine
                                </span>
                            </div>
                        </div>
                        <p className="text-xs text-zinc-500 max-w-xl leading-relaxed">
                            Review money management, instrument performance, and timing from your trade history.
                        </p>
                    </div>

                    {/* Clean Monospace Metric Badge */}
                        <div className="flex shrink-0 items-center gap-2 self-start rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-mono text-zinc-700 sm:self-auto">
                        <Activity size={14} className="text-zinc-500" />
                        <span>{tradeCount} trades recorded</span>
                    </div>
                </div>
            </div>

            {/* BENTO GRID ROW 2: Primary Actions Grid (Span 7 + Span 5) */}
            <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                
                {/* BENTO CARD 2: Primary Action Card - Generate AI Report (Span 7) */}
                <div className="md:col-span-7 p-5 md:p-6 rounded-2xl bg-white border border-zinc-200/80 flex flex-col justify-between gap-5 shadow-xs hover:border-zinc-300 transition-all">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="w-9 h-9 rounded-xl bg-zinc-100 border border-zinc-200 text-zinc-800 flex items-center justify-center shadow-xs">
                                <Sparkles size={18} />
                            </div>
                            <span className="text-[10px] font-mono text-zinc-400 flex items-center gap-1">
                                <Database size={12} className="text-emerald-600" /> LOCAL-FIRST
                            </span>
                        </div>

                        <div>
                            <h3 className="text-base font-bold text-zinc-900 tracking-tight">
                                Generate AI Performance Report
                            </h3>
                            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                                Run rule engine &amp; LLM reasoning model on your trading history for behavioral diagnostics.
                            </p>
                        </div>

                        {/* Quantitative Rule Check Tags */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-zinc-100 text-[11px] font-mono text-zinc-600">
                            <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-zinc-50 border border-zinc-200/80">
                                <ShieldCheck size={13} className="text-emerald-600 shrink-0" />
                                <span className="truncate">Money Management</span>
                            </div>
                            <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-zinc-50 border border-zinc-200/80">
                                <BarChart3 size={13} className="text-blue-600 shrink-0" />
                                <span className="truncate">Win-Rate by Asset</span>
                            </div>
                            <div className="flex items-center gap-1.5 p-1.5 rounded-lg bg-zinc-50 border border-zinc-200/80">
                                <Clock size={13} className="text-amber-600 shrink-0" />
                                <span className="truncate">3-Hour Windows</span>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleNavigate}
                        disabled={loading || !canGenerate}
                        className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-lg bg-zinc-900 px-5 py-3 text-xs font-semibold text-white shadow-xs transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
                    >
                        {canGenerate ? (
                            <FileText size={15} />
                        ) : (
                            <AlertTriangle size={15} />
                        )}
                        <span>
                            {loading
                                ? "Opening report..."
                                : canGenerate
                                ? "Generate report"
                                : "3 trades required"}
                        </span>
                        {canGenerate && <ArrowRight size={15} />}
                    </button>
                </div>

                {/* BENTO CARD 3: Archive Secondary Card - Past Reports (Span 5) */}
                <div className="md:col-span-5 p-5 md:p-6 rounded-2xl bg-white border border-zinc-200/80 flex flex-col justify-between gap-5 shadow-xs hover:border-zinc-300 transition-all">
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <div className="w-9 h-9 rounded-xl bg-zinc-50 border border-zinc-200 text-zinc-700 flex items-center justify-center">
                                <FolderOpen size={18} />
                            </div>
                            <span className="text-[10px] font-mono text-zinc-400">SQLITE ARCHIVE</span>
                        </div>

                        <div>
                            <h3 className="text-base font-bold text-zinc-900 tracking-tight">
                                Past Reports Archive
                            </h3>
                            <p className="text-xs text-zinc-500 mt-1 leading-relaxed">
                                Access your historical AI trade diagnoses stored locally in your database.
                            </p>
                        </div>

                        {/* Embed Preview Items */}
                        <div className="space-y-1.5 pt-2 border-t border-zinc-100 text-[11px] font-mono text-zinc-600">
                            <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-200/80 flex items-center justify-between">
                                <span>Storage Engine</span>
                                <span className="text-zinc-500 font-semibold">SQLite reports</span>
                            </div>
                            <div className="p-2 rounded-lg bg-zinc-50 border border-zinc-200/80 flex items-center justify-between">
                                <span>Audit Scope</span>
                                <span className="text-zinc-500 font-semibold">VWAP &amp; Discipline</span>
                            </div>
                        </div>
                    </div>

                    <Link
                        href="/private/reports-history"
                        className="w-full flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-zinc-200 bg-white text-xs font-semibold text-zinc-800 hover:bg-zinc-50 active:scale-[0.98] transition-all duration-150 shadow-xs group"
                    >
                        <FolderOpen size={15} />
                        <span>View Archive →</span>
                    </Link>
                </div>

            </div>

        </div>
    );
}
