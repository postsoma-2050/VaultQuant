"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronLeft, ChevronRight, LayoutGrid, LayoutList, Search, Star, Trash2 } from "lucide-react";
import { addRemoveFavorite, deleteReportFromDB, getReports } from "@/server/actions/archive";
import { ReportsEntry } from "@/types/tradeAI.types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";

type RiskFilter = "all" | "critical" | "warning" | "clear" | "unassessed";
const PAGE_SIZE = 12;

function reportDate(value: string) {
    // SQLite defaults omit a zone; interpret them as UTC, like the database clock.
    const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:/.test(value) ? `${value.replace(" ", "T")}Z` : value;
    const date = new Date(normalized);
    if (!Number.isFinite(date.getTime())) return { date: "Date unavailable", time: "", timestamp: 0 };
    return {
        date: date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }),
        time: date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }),
        timestamp: date.getTime(),
    };
}

function riskLevel(report: ReportsEntry): Exclude<RiskFilter, "all"> {
    if ((report.dangerCount ?? 0) > 0) return "critical";
    if ((report.warningCount ?? 0) > 0) return "warning";
    return report.riskAssessed ? "clear" : "unassessed";
}

function RiskStatus({ report }: { report: ReportsEntry }) {
    const level = riskLevel(report);
    const label = level === "critical" ? `${report.dangerCount} high risk`
        : level === "warning" ? `${report.warningCount} warning${report.warningCount === 1 ? "" : "s"}`
        : level === "clear" ? "No flags" : "Not assessed";
    const tone = level === "critical" ? "text-rose-700" : level === "warning" ? "text-amber-800" : "text-zinc-600";
    return <span className={`inline-flex items-center gap-2 whitespace-nowrap text-xs ${tone}`}>
        <span aria-hidden="true" className={`h-1.5 w-1.5 shrink-0 rounded-full ${level === "critical" ? "bg-rose-600" : level === "warning" ? "bg-amber-600" : "bg-zinc-400"}`} />
        {label}
    </span>;
}

function Pnl({ value }: { value: number | null | undefined }) {
    if (value == null || !Number.isFinite(value)) return <span className="text-zinc-500">Unavailable</span>;
    return <span className={`whitespace-nowrap font-mono tabular-nums ${value < 0 ? "text-rose-700" : value > 0 ? "text-emerald-700" : "text-zinc-700"}`}>
        {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", signDisplay: "exceptZero" }).format(value)}
    </span>;
}

export default function ReportsHistory() {
    const [reports, setReports] = useState<ReportsEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [query, setQuery] = useState("");
    const [risk, setRisk] = useState<RiskFilter>("all");
    const [favorites, setFavorites] = useState(false);
    const [order, setOrder] = useState("desc");
    const [view, setView] = useState<"table" | "cards">("table");
    const [page, setPage] = useState(1);
    const [pending, setPending] = useState<Set<string>>(new Set());
    const inFlight = useRef(new Set<string>());
    const [toDelete, setToDelete] = useState<ReportsEntry | null>(null);
    const tableScroll = useRef<HTMLDivElement>(null);

    const fetchReports = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const result = await getReports();
            if (result && !result.success) throw new Error(result.error);
            setReports(result?.reports ?? []);
        } catch {
            setError("Reports could not be loaded. Please try again.");
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { void fetchReports(); }, [fetchReports]);

    const filtered = useMemo(() => reports.filter((report) => {
        if (favorites && !report.isFavorite) return false;
        if (risk !== "all" && riskLevel(report) !== risk) return false;
        const date = reportDate(report.createdAt);
        const searchable = [date.date, date.time, report.createdAt, report.keyObservation, ...(report.instruments ?? [])].join(" ").toLowerCase();
        return searchable.includes(query.trim().toLowerCase());
    }).sort((a, b) => (order === "desc" ? -1 : 1) * (reportDate(a.createdAt).timestamp - reportDate(b.createdAt).timestamp)), [reports, favorites, risk, query, order]);
    const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const visible = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
    const flagged = reports.filter((report) => ["critical", "warning"].includes(riskLevel(report))).length;

    const startAction = (id: string) => {
        if (inFlight.current.has(id)) return false;
        inFlight.current.add(id);
        setPending(new Set(inFlight.current));
        return true;
    };
    const finishAction = (id: string) => {
        inFlight.current.delete(id);
        setPending(new Set(inFlight.current));
    };
    const toggleFavorite = async (report: ReportsEntry) => {
        if (!startAction(report.reportId)) return;
        try {
            const result = await addRemoveFavorite(report.reportId);
            if (!result?.success) throw new Error("Favorite update failed");
            setReports((previous) => previous.map((item) => item.reportId === report.reportId ? { ...item, isFavorite: !item.isFavorite } : item));
        } catch {
            toast.error("Favorite could not be updated. Please try again.");
        } finally { finishAction(report.reportId); }
    };
    const confirmDelete = async () => {
        if (!toDelete || !startAction(toDelete.reportId)) return;
        const id = toDelete.reportId;
        try {
            const result = await deleteReportFromDB(id);
            if (!result?.success) throw new Error("Delete failed");
            setReports((previous) => previous.filter((item) => item.reportId !== id));
            setToDelete(null);
            toast.success("Report deleted");
        } catch {
            toast.error("Report could not be deleted. Please try again.");
        } finally { finishAction(id); }
    };
    const resetFilters = () => { setQuery(""); setRisk("all"); setFavorites(false); setPage(1); };
    const actionButtons = (report: ReportsEntry) => <div className="flex items-center justify-end gap-1">
        <button type="button" disabled={pending.has(report.reportId)} aria-label={report.isFavorite ? "Remove favorite" : "Add favorite"} aria-pressed={report.isFavorite} title={report.isFavorite ? "Remove favorite" : "Add favorite"} onClick={() => void toggleFavorite(report)} className="report-icon-button">
            <Star size={15} className={report.isFavorite ? "fill-amber-400 text-amber-700" : ""} />
        </button>
        <button type="button" disabled={pending.has(report.reportId)} aria-label={`Delete report from ${reportDate(report.createdAt).date}`} title="Delete report" onClick={() => setToDelete(report)} className="report-icon-button hover:!text-rose-700"><Trash2 size={15} /></button>
        <Link href={`/private/reports-history/${report.reportId}`} aria-label={`Open report from ${reportDate(report.createdAt).date}`} title="Open report" className="report-icon-button"><ArrowRight size={15} /></Link>
    </div>;

    return <section className="reports-page mx-auto flex w-full max-w-[1600px] min-w-0 flex-col gap-5 px-6 py-6 text-[13px] text-zinc-800 [&>*]:shrink-0">
        <header className="flex flex-wrap items-start justify-between gap-4">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Reports</h1>
                <p className="mt-1 text-sm text-zinc-600">Saved analysis and position snapshots.</p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
                <div className="inline-flex rounded-md border border-zinc-200 bg-white p-0.5" aria-label="Report layout">
                    {(["table", "cards"] as const).map((mode) => <button key={mode} type="button" aria-pressed={view === mode} onClick={() => setView(mode)} className={`inline-flex items-center gap-1.5 rounded px-2.5 py-1.5 text-xs ${view === mode ? "bg-zinc-100 font-medium text-zinc-900" : "text-zinc-600 hover:bg-zinc-50"}`}>
                        {mode === "table" ? <LayoutList size={14} /> : <LayoutGrid size={14} />}{mode === "table" ? "Table" : "Cards"}
                    </button>)}
                </div>
                <Link href="/private/tradeAI" className="inline-flex h-9 items-center gap-2 whitespace-nowrap rounded-md bg-zinc-900 px-3 text-sm font-medium text-white hover:bg-zinc-800">New report<ArrowRight size={14} /></Link>
            </div>
        </header>

        {!loading && !error && <div className="flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-zinc-200 py-3 text-zinc-600">
            <span><strong className="font-medium tabular-nums text-zinc-900">{reports.length}</strong> saved reports</span>
            <span><strong className="font-medium tabular-nums text-zinc-900">{flagged}</strong> with risk flags</span>
            {reports.length > 0 && <span className="ml-auto text-xs">Latest {reportDate([...reports].sort((a, b) => reportDate(b.createdAt).timestamp - reportDate(a.createdAt).timestamp)[0].createdAt).date}</span>}
        </div>}

        <div className="flex flex-wrap items-center gap-3">
            <div className="relative min-w-[220px] flex-1 max-w-sm">
                <Search size={15} aria-hidden="true" className="absolute left-3 top-2.5 text-zinc-500" />
                <input aria-label="Search reports" value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search date, symbol or observation" className="h-9 w-full rounded-md border border-zinc-300 bg-white pl-9 pr-3 text-sm placeholder:text-zinc-500" />
            </div>
            <select aria-label="Filter by risk" value={risk} onChange={(event) => { setRisk(event.target.value as RiskFilter); setPage(1); }} className="h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm">
                <option value="all">All risk levels</option><option value="critical">High risk</option><option value="warning">Warnings</option><option value="clear">No flags</option><option value="unassessed">Not assessed</option>
            </select>
            <button type="button" aria-pressed={favorites} onClick={() => { setFavorites(!favorites); setPage(1); }} className={`inline-flex h-9 items-center gap-2 rounded-md border px-3 text-sm ${favorites ? "border-zinc-800 bg-zinc-100" : "border-zinc-300 bg-white hover:bg-zinc-50"}`}><Star size={14} />Favorites</button>
            <select aria-label="Sort reports" value={order} onChange={(event) => { setOrder(event.target.value); setPage(1); }} className="ml-auto h-9 rounded-md border border-zinc-300 bg-white px-2 text-sm"><option value="desc">Newest first</option><option value="asc">Oldest first</option></select>
        </div>

        {view === "table" && visible.length > 0 && <div className="report-scroll-hint items-center justify-between gap-3 text-xs text-zinc-600">
            <span>Scroll across for P&amp;L, risk flags and actions.</span>
            <div className="flex gap-1"><button type="button" aria-label="Scroll table left" className="report-icon-button border border-zinc-200 bg-white" onClick={() => tableScroll.current?.scrollBy({ left: -300 })}><ChevronLeft size={14} /></button><button type="button" aria-label="Scroll table right" className="report-icon-button border border-zinc-200 bg-white" onClick={() => tableScroll.current?.scrollBy({ left: 300 })}><ChevronRight size={14} /></button></div>
        </div>}
        {loading ? <div role="status" className="rounded-md border border-zinc-200 bg-white p-6 text-zinc-600">Loading reports...</div>
            : error ? <div role="alert" className="rounded-md border border-zinc-200 bg-white p-6"><p>{error}</p><Button variant="outline" onClick={() => void fetchReports()} className="mt-3">Retry</Button></div>
            : visible.length === 0 ? <div className="rounded-md border border-zinc-200 bg-white px-6 py-12 text-center">
                <h2 className="font-medium text-zinc-900">{reports.length ? "No matching reports" : "No saved reports"}</h2>
                <p className="mt-2 text-zinc-600">{reports.length ? "Change your search or filters to see more results." : "Create a report, then save it to revisit your analysis here."}</p>
                {reports.length ? <Button variant="outline" onClick={resetFilters} className="mt-4">Clear filters</Button> : <Link href="/private/tradeAI" className="mt-4 inline-block underline underline-offset-4">Create a report</Link>}
            </div>
            : view === "table" ? <div ref={tableScroll} className="overflow-x-auto rounded-md border border-zinc-200 bg-white" tabIndex={0} role="region" aria-label="Saved reports table; scroll horizontally for all columns">
                <table className="w-full min-w-[1040px] table-fixed border-collapse text-left">
                    <caption className="sr-only">Saved trading reports, position snapshots, risk flags and actions</caption>
                    <colgroup><col style={{ width: 155 }} /><col style={{ width: 190 }} /><col /><col style={{ width: 150 }} /><col style={{ width: 135 }} /><col style={{ width: 115 }} /></colgroup>
                    <thead className="border-b border-zinc-200 bg-zinc-50 text-xs font-medium text-zinc-600"><tr>
                        <th scope="col" className="px-4 py-3 font-medium">Saved</th><th scope="col" className="px-4 py-3 font-medium">Positions</th><th scope="col" className="px-4 py-3 font-medium">Observation</th><th scope="col" className="px-4 py-3 text-right font-medium whitespace-nowrap">Unrealized P&amp;L</th><th scope="col" className="px-4 py-3 font-medium">Risk flags</th><th scope="col" className="px-4 py-3 text-right font-medium">Actions</th>
                    </tr></thead>
                    <tbody className="divide-y divide-zinc-100">{visible.map((report) => {
                        const date = reportDate(report.createdAt);
                        return <tr key={report.reportId} className="align-top hover:bg-zinc-50/70">
                            <td className="px-4 py-4"><Link href={`/private/reports-history/${report.reportId}`} className="whitespace-nowrap font-medium text-zinc-900 underline-offset-4 hover:underline">{date.date}</Link><time dateTime={report.createdAt} className="mt-1 block tabular-nums text-xs text-zinc-600">{date.time}</time></td>
                            <td className="px-4 py-4"><span className="text-zinc-900">{report.openPositionsCount ?? 0} open lots</span><p className="mt-1 break-words text-xs leading-5 text-zinc-600">{report.instruments?.join(", ") || "No position snapshot"}</p></td>
                            <td className="px-4 py-4 leading-6 text-zinc-700">{report.keyObservation || `${report.numberOfMessages} analysis items`}</td>
                            <td className="px-4 py-4 text-right"><Pnl value={report.totalUnrealizedPnL} /></td>
                            <td className="px-4 py-4"><RiskStatus report={report} /></td><td className="px-3 py-3">{actionButtons(report)}</td>
                        </tr>;
                    })}</tbody>
                </table>
            </div> : <div className="grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-4">{visible.map((report) => {
                const date = reportDate(report.createdAt);
                return <article key={report.reportId} className="flex min-w-0 flex-col rounded-md border border-zinc-200 bg-white p-4">
                    <div className="flex items-center justify-between gap-2"><Link href={`/private/reports-history/${report.reportId}`} className="font-medium underline-offset-4 hover:underline">{date.date} <span className="ml-1 text-xs text-zinc-600">{date.time}</span></Link>{actionButtons(report)}</div>
                    <p className="mt-3 flex-1 leading-6">{report.keyObservation || `${report.numberOfMessages} analysis items`}</p>
                    <p className="mt-2 break-words text-xs text-zinc-600">{report.openPositionsCount ?? 0} open lots{report.instruments?.length ? ` · ${report.instruments.join(", ")}` : ""}</p>
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-zinc-100 pt-3"><RiskStatus report={report} /><Pnl value={report.totalUnrealizedPnL} /></div>
                </article>;
            })}</div>}

        {!loading && !error && <footer className="flex flex-wrap items-center justify-between gap-3 pb-4 text-xs text-zinc-600" aria-live="polite">
            <span>{filtered.length ? `${(currentPage - 1) * PAGE_SIZE + 1}–${Math.min(currentPage * PAGE_SIZE, filtered.length)} of ${filtered.length} reports` : "0 reports"}{filtered.length !== reports.length ? ` (${reports.length} total)` : ""}</span>
            {totalPages > 1 && <div className="flex items-center gap-3"><Button variant="outline" size="sm" onClick={() => setPage(currentPage - 1)} disabled={currentPage === 1} aria-label="Previous page"><ChevronLeft size={14} /></Button><span>Page {currentPage} of {totalPages}</span><Button variant="outline" size="sm" onClick={() => setPage(currentPage + 1)} disabled={currentPage === totalPages} aria-label="Next page"><ChevronRight size={14} /></Button></div>}
        </footer>}
        <Dialog open={Boolean(toDelete)} onOpenChange={(open) => { if (!open && !pending.has(toDelete?.reportId ?? "")) setToDelete(null); }}>
            <DialogContent onEscapeKeyDown={(event) => { if (pending.has(toDelete?.reportId ?? "")) event.preventDefault(); }}>
                <DialogHeader><DialogTitle>Delete this report?</DialogTitle><DialogDescription>The report saved on {toDelete ? reportDate(toDelete.createdAt).date : ""} will be permanently removed. Your trades and journal entries are kept.</DialogDescription></DialogHeader>
                <div className="mt-5 flex justify-end gap-2"><Button variant="outline" disabled={pending.has(toDelete?.reportId ?? "")} onClick={() => setToDelete(null)}>Cancel</Button><Button variant="destructive" disabled={pending.has(toDelete?.reportId ?? "")} onClick={() => void confirmDelete()}>{pending.has(toDelete?.reportId ?? "") ? "Deleting..." : "Delete report"}</Button></div>
            </DialogContent>
        </Dialog>
    </section>;
}
