"use client";

import React, { useState, useRef } from "react";
import { toast } from "sonner";
import { importTradesAction, previewImportAction, exportFullBackupAction, exportTradesCSVAction, ImportPreviewResult } from "@/server/actions/importExport";
import { useAppDispatch } from "@/redux/store";
import { setListOfTrades, setInitialMonthViewSummary, setInitialYearViewSummary, setInitialTotalOfParticularYearSummary, setTradeDetailsForEachDay } from "@/redux/slices/tradeRecordsSlice";
import { getTradeSummary } from "@/features/calendar/getTradeSummary";
import { getTradeDetailsForEachDay } from "@/features/calendar/getTradeDetailsForEachDay";
import { getAllTradeRecords } from "@/server/actions/trades";
import { Upload, Download, FileText, CheckCircle2, Loader2, X, Eye } from "lucide-react";

interface ImportExportModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function ImportExportModal({ isOpen, onClose }: ImportExportModalProps) {
    const dispatch = useAppDispatch();
    const [activeTab, setActiveTab] = useState<"import" | "export">("import");
    const [file, setFile] = useState<File | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [progressStatus, setProgressStatus] = useState<string>("");
    const [clearExisting, setClearExisting] = useState(false);
    const [previewData, setPreviewData] = useState<ImportPreviewResult | null>(null);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    if (!isOpen) return null;

    const processFilePreview = async (selectedFile: File) => {
        setFile(selectedFile);
        setIsLoading(true);
        setProgressStatus("Parsing & running Ghostfolio Dry-Run Preview...");

        try {
            const text = await selectedFile.text();
            const ext = selectedFile.name.split(".").pop()?.toLowerCase();
            const fileType = ext === "json" ? "json" : "csv";

            const preview = await previewImportAction(text, fileType);
            if (preview.success) {
                setPreviewData(preview);
                toast.success(`Preview ready: ${preview.sanitizedCount} transactions clustered into ${preview.campaigns.length} campaigns`);
            } else {
                toast.error(preview.error || "Failed to preview file");
                setPreviewData(null);
            }
        } catch (err: unknown) {
            console.error("Preview error:", err);
            const msg = err instanceof Error ? err.message : "Unknown error";
            toast.error("File preview error: " + msg);
            setPreviewData(null);
        } finally {
            setIsLoading(false);
            setProgressStatus("");
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            processFilePreview(e.target.files[0]);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            processFilePreview(e.dataTransfer.files[0]);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
    };

    const handleConfirmImport = async () => {
        if (!file) {
            toast.error("Please select a CSV or JSON file to import");
            return;
        }

        setIsLoading(true);
        setProgressStatus("Committing campaigns to SQLite database...");

        try {
            const text = await file.text();
            const ext = file.name.split(".").pop()?.toLowerCase();
            const fileType = ext === "json" ? "json" : "csv";

            const result = await importTradesAction(text, fileType, clearExisting);

            if (result.success) {
                setProgressStatus("Updating system views and Redux store...");
                
                const updatedTrades = await getAllTradeRecords();
                dispatch(setListOfTrades(updatedTrades));

                if (updatedTrades && updatedTrades.length > 0) {
                    const monthVal = getTradeSummary("day", updatedTrades);
                    const yearVal = getTradeSummary("month", updatedTrades);
                    const particularYearVal = getTradeSummary("year", updatedTrades);
                    const detailsVal = getTradeDetailsForEachDay(updatedTrades);

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

                toast.success(`Successfully committed ${result.importedCount} Trade Campaigns!`);
                setFile(null);
                setPreviewData(null);
                onClose();
            } else {
                toast.error(result.error || "Failed to import file. Please check file format.");
            }
        } catch (err: unknown) {
            console.error("Import error:", err);
            const msg = err instanceof Error ? err.message : "Unknown error";
            toast.error("Import error: " + msg);
        } finally {
            setIsLoading(false);
            setProgressStatus("");
        }
    };

    const handleExportCSV = async () => {
        try {
            setIsLoading(true);
            const csvContent = await exportTradesCSVAction();
            const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `VaultQuant_Trades_${new Date().toISOString().split("T")[0]}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("CSV trades export completed!");
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            toast.error("Failed to export CSV: " + msg);
        } finally {
            setIsLoading(false);
        }
    };

    const handleExportJSON = async () => {
        try {
            setIsLoading(true);
            const jsonContent = await exportFullBackupAction();
            const blob = new Blob([jsonContent], { type: "application/json;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.setAttribute("download", `VaultQuant_Backup_${new Date().toISOString().split("T")[0]}.json`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success("Full JSON backup export completed!");
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "Unknown error";
            toast.error("Failed to export JSON backup: " + msg);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className={`bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-2xl w-full ${previewData ? "max-w-3xl" : "max-w-xl"} overflow-hidden flex flex-col transition-all duration-200`}>
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 dark:border-zinc-800">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-xl">
                            <Upload size={20} />
                        </div>
                        <div>
                            <h3 className="font-semibold text-base text-zinc-900 dark:text-zinc-100">
                                Data Import & Backup Restore
                            </h3>
                            <p className="text-xs text-zinc-500">
                                Ghostfolio-Grade CSV Sanitization & Campaign Engine Preview
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-zinc-100 dark:border-zinc-800 px-6 pt-2">
                    <button
                        onClick={() => setActiveTab("import")}
                        className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === "import"
                                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                        }`}>
                        Import Trades
                    </button>
                    <button
                        onClick={() => setActiveTab("export")}
                        className={`pb-3 px-4 text-sm font-medium border-b-2 transition-colors ${
                            activeTab === "export"
                                ? "border-amber-500 text-amber-600 dark:text-amber-400"
                                : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
                        }`}>
                        Export Backup
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto max-h-[75vh]">
                    {activeTab === "import" ? (
                        <div className="space-y-4">
                            {!previewData ? (
                                <>
                                    {/* Drag and Drop Zone */}
                                    <div
                                        onDrop={handleDrop}
                                        onDragOver={handleDragOver}
                                        onClick={() => fileInputRef.current?.click()}
                                        className="border-2 border-dashed border-zinc-200 dark:border-zinc-700 hover:border-amber-500/50 dark:hover:border-amber-500/50 rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer bg-zinc-50/50 dark:bg-zinc-800/20 hover:bg-amber-500/5 transition-all">
                                        <input
                                            type="file"
                                            ref={fileInputRef}
                                            onChange={handleFileChange}
                                            accept=".csv,.json"
                                            className="hidden"
                                        />
                                        <div className="p-3 bg-white dark:bg-zinc-800 rounded-full shadow-sm border border-zinc-100 dark:border-zinc-700">
                                            <FileText className="w-6 h-6 text-amber-500" />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
                                                {file ? file.name : "Click to choose file or drag & drop here"}
                                            </p>
                                            <p className="text-xs text-zinc-400 mt-1">
                                                Supports Futu / Moomoo, IBKR, Webull, Schwab & VaultQuant JSON
                                            </p>
                                        </div>
                                    </div>

                                    {/* Features Banner */}
                                    <div className="bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-xs text-amber-800 dark:text-amber-300 space-y-1">
                                        <div className="font-semibold flex items-center gap-1.5">
                                            <CheckCircle2 size={14} className="text-amber-500" />
                                            Automatic Campaign Clustering & VWAP Aggregation
                                        </div>
                                        <p className="text-zinc-600 dark:text-zinc-400">
                                            Scale-in buys are aggregated into campaign VWAPs, and scale-outs are grouped into clean trade cards with Dry-Run validation.
                                        </p>
                                    </div>
                                </>
                            ) : (
                                /* Ghostfolio-Style Data Import Preview Table */
                                <div className="space-y-4">
                                    {/* Stats Header */}
                                    <div className="flex items-center justify-between bg-zinc-50 dark:bg-zinc-800/40 p-3 rounded-xl border border-zinc-200/60 dark:border-zinc-800 text-xs">
                                        <div className="flex items-center gap-2">
                                            <Eye className="w-4 h-4 text-amber-500" />
                                            <span className="font-semibold text-zinc-800 dark:text-zinc-200">{file?.name}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-zinc-500 font-mono">
                                            <span>Raw Rows: <b>{previewData.rawRecordCount}</b></span>
                                            <span>•</span>
                                            <span>Sanitized: <b>{previewData.sanitizedCount}</b></span>
                                            <span>•</span>
                                            <span className="text-amber-600 dark:text-amber-400 font-bold">Campaigns: {previewData.campaigns.length}</span>
                                        </div>
                                    </div>

                                    {/* Table */}
                                    <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-xs">
                                        <div className="max-h-60 overflow-y-auto">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 font-mono uppercase sticky top-0 border-b border-zinc-200 dark:border-zinc-700">
                                                    <tr>
                                                        <th className="px-3 py-2">Symbol</th>
                                                        <th className="px-3 py-2">Type</th>
                                                        <th className="px-3 py-2">Status</th>
                                                        <th className="px-3 py-2">Open / Close Date</th>
                                                        <th className="px-3 py-2 text-right">Qty</th>
                                                        <th className="px-3 py-2 text-right">VWAP Entry</th>
                                                        <th className="px-3 py-2 text-right">Exit / PnL</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                                                    {previewData.campaigns.map((c, idx) => {
                                                        const pnlNum = c.result ? Number(c.result) : 0;
                                                        return (
                                                            <tr key={c.id || idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 font-mono">
                                                                <td className="px-3 py-2.5 font-bold text-zinc-900 dark:text-zinc-100">
                                                                    {c.symbolName}
                                                                </td>
                                                                <td className="px-3 py-2.5">
                                                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-600">
                                                                        {c.positionType}
                                                                    </span>
                                                                </td>
                                                                <td className="px-3 py-2.5">
                                                                    {c.isActiveTrade ? (
                                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400">
                                                                            OPEN
                                                                        </span>
                                                                    ) : (
                                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                                                                            CLOSED
                                                                        </span>
                                                                    )}
                                                                </td>
                                                                <td className="px-3 py-2.5 text-zinc-500 text-[11px]">
                                                                    {c.openDate} {c.closeDate ? `→ ${c.closeDate}` : ""}
                                                                </td>
                                                                <td className="px-3 py-2.5 text-right font-medium">
                                                                    {c.quantity}
                                                                </td>
                                                                <td className="px-3 py-2.5 text-right">
                                                                    ${c.entryPrice}
                                                                </td>
                                                                <td className="px-3 py-2.5 text-right font-bold">
                                                                    {c.isActiveTrade ? (
                                                                        <span className="text-zinc-400">—</span>
                                                                    ) : pnlNum >= 0 ? (
                                                                        <span className="text-emerald-600 dark:text-emerald-400">+${pnlNum.toFixed(2)}</span>
                                                                    ) : (
                                                                        <span className="text-rose-600 dark:text-rose-400">-${Math.abs(pnlNum).toFixed(2)}</span>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>

                                    {/* Options Checkbox */}
                                    <div className="flex items-center justify-between px-1 pt-1">
                                        <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-600 dark:text-zinc-400 select-none">
                                            <input
                                                type="checkbox"
                                                checked={clearExisting}
                                                onChange={(e) => setClearExisting(e.target.checked)}
                                                className="w-4 h-4 rounded border-zinc-300 text-amber-500 focus:ring-amber-500/20 cursor-pointer"
                                            />
                                            <span>Overwrite / Replace existing trades (Clean Re-sync)</span>
                                        </label>

                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPreviewData(null);
                                                setFile(null);
                                            }}
                                            className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 underline cursor-pointer">
                                            Select another file
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Progress / Loading indicator */}
                            {isLoading && (
                                <div className="flex items-center gap-3 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs text-zinc-600 dark:text-zinc-300">
                                    <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                                    <span>{progressStatus}</span>
                                </div>
                            )}

                            {/* Action Buttons */}
                            {previewData && (
                                <button
                                    onClick={handleConfirmImport}
                                    disabled={isLoading}
                                    className="w-full py-3 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-medium rounded-xl text-sm transition-all shadow-md shadow-amber-500/20 flex items-center justify-center gap-2 cursor-pointer mt-2">
                                    {isLoading ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Committing to Database...
                                        </>
                                    ) : (
                                        <>
                                            <Upload size={16} />
                                            Confirm & Import {previewData.campaigns.length} Campaigns
                                        </>
                                    )}
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-4">
                            <p className="text-xs text-zinc-500">
                                Export all historical trade records and system configurations for full data archive and backup.
                            </p>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                                <button
                                    onClick={handleExportCSV}
                                    disabled={isLoading}
                                    className="p-5 border border-zinc-200 dark:border-zinc-700 hover:border-amber-500 dark:hover:border-amber-500 rounded-xl bg-white dark:bg-zinc-800 text-left hover:shadow-lg transition-all group flex flex-col justify-between h-32 cursor-pointer">
                                    <div className="flex items-center justify-between">
                                        <FileText className="w-6 h-6 text-emerald-500" />
                                        <Download className="w-4 h-4 text-zinc-400 group-hover:text-amber-500 transition-colors" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                                            Export CSV Format
                                        </h4>
                                        <p className="text-xs text-zinc-400 mt-0.5">
                                            Compatible with Excel & quantitative tools
                                        </p>
                                    </div>
                                </button>

                                <button
                                    onClick={handleExportJSON}
                                    disabled={isLoading}
                                    className="p-5 border border-zinc-200 dark:border-zinc-700 hover:border-amber-500 dark:hover:border-amber-500 rounded-xl bg-white dark:bg-zinc-800 text-left hover:shadow-lg transition-all group flex flex-col justify-between h-32 cursor-pointer">
                                    <div className="flex items-center justify-between">
                                        <FileText className="w-6 h-6 text-blue-500" />
                                        <Download className="w-4 h-4 text-zinc-400 group-hover:text-amber-500 transition-colors" />
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                                            Full JSON Backup
                                        </h4>
                                        <p className="text-xs text-zinc-400 mt-0.5">
                                            Includes trades, daily journals, & strategy rules
                                        </p>
                                    </div>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
