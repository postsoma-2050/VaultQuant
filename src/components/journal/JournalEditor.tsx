"use client";

import { useEditor, EditorContent, Editor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { saveJournalEntry, deleteJournalEntry } from "@/server/actions/journal";
import {
    Loader2,
    Save,
    Bold,
    Italic,
    Strikethrough,
    Code,
    List,
    ListOrdered,
    Quote,
    Undo,
    Redo,
    Heading1,
    Heading2,
    Heading3,
    Trash2,
    TrendingUp,
    TrendingDown,
    Activity,
    Layers,
    PanelRightClose,
    PanelRightOpen,
    History,
    RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useAppSelector } from "@/redux/store";
import { cn } from "@/lib/utils";
import { useJournalDraft } from "./JournalDraftContext";
import { getCalendarEventsForDay } from "@/features/calendar/getClosedTradesForDay";
import {
    readJournalDraft,
    removeJournalDraft,
    writeJournalDraft,
} from "./journalDraftStorage";

interface JournalEditorProps {
    date: string; // YYYY-MM-DD
    initialContent?: Record<string, unknown>;
    hasExistingEntry: boolean;
}

const MenuBar = ({ editor }: { editor: Editor }) => {
    const [, forceUpdate] = useState({});

    useEffect(() => {
        if (!editor) return;

        const updateHandler = () => {
            forceUpdate({});
        };

        editor.on("selectionUpdate", updateHandler);
        editor.on("transaction", updateHandler);

        return () => {
            editor.off("selectionUpdate", updateHandler);
            editor.off("transaction", updateHandler);
        };
    }, [editor]);

    if (!editor) {
        return null;
    }

    const buttonClass = (isActive: boolean) =>
        `p-1.5 rounded-lg text-xs font-medium transition-colors ${
            isActive
                ? "bg-slate-200 text-slate-900"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
        }`;

    return (
        <div className="border border-slate-200/80 rounded-xl p-1.5 mb-6 flex flex-wrap items-center gap-1 bg-white/95 backdrop-blur sticky top-0 z-10 shadow-2xs">
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBold().run()}
                className={buttonClass(editor.isActive("bold"))}
                title="Bold (Cmd+B)"
            >
                <Bold className="h-4 w-4" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleItalic().run()}
                className={buttonClass(editor.isActive("italic"))}
                title="Italic (Cmd+I)"
            >
                <Italic className="h-4 w-4" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleStrike().run()}
                className={buttonClass(editor.isActive("strike"))}
                title="Strikethrough"
            >
                <Strikethrough className="h-4 w-4" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleCode().run()}
                className={buttonClass(editor.isActive("code"))}
                title="Code"
            >
                <Code className="h-4 w-4" />
            </button>

            <div className="w-px h-5 bg-slate-200 mx-1" />

            <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
                className={buttonClass(editor.isActive("heading", { level: 1 }))}
                title="Heading 1"
            >
                <Heading1 className="h-4 w-4" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                className={buttonClass(editor.isActive("heading", { level: 2 }))}
                title="Heading 2"
            >
                <Heading2 className="h-4 w-4" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                className={buttonClass(editor.isActive("heading", { level: 3 }))}
                title="Heading 3"
            >
                <Heading3 className="h-4 w-4" />
            </button>

            <div className="w-px h-5 bg-slate-200 mx-1" />

            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBulletList().run()}
                className={buttonClass(editor.isActive("bulletList"))}
                title="Bullet List"
            >
                <List className="h-4 w-4" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleOrderedList().run()}
                className={buttonClass(editor.isActive("orderedList"))}
                title="Numbered List"
            >
                <ListOrdered className="h-4 w-4" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().toggleBlockquote().run()}
                className={buttonClass(editor.isActive("blockquote"))}
                title="Blockquote"
            >
                <Quote className="h-4 w-4" />
            </button>

            <div className="w-px h-5 bg-slate-200 mx-1" />

            <button
                type="button"
                onClick={() => editor.chain().focus().undo().run()}
                disabled={!editor.can().undo()}
                className={`${buttonClass(false)} disabled:opacity-30 disabled:cursor-not-allowed`}
                title="Undo (Cmd+Z)"
            >
                <Undo className="h-4 w-4" />
            </button>
            <button
                type="button"
                onClick={() => editor.chain().focus().redo().run()}
                disabled={!editor.can().redo()}
                className={`${buttonClass(false)} disabled:opacity-30 disabled:cursor-not-allowed`}
                title="Redo (Cmd+Shift+Z)"
            >
                <Redo className="h-4 w-4" />
            </button>
        </div>
    );
};

export function JournalEditor({ date, initialContent, hasExistingEntry }: JournalEditorProps) {
    const [isSaving, setIsSaving] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [hasSavedEntry, setHasSavedEntry] = useState(hasExistingEntry);
    const [isContextOpen, setIsContextOpen] = useState(true);
    const [isRecoveredDraft, setIsRecoveredDraft] = useState(false);
    const savedContentRef = useRef("");
    const router = useRouter();
    const { setDraftDirty } = useJournalDraft();

    const trades = useAppSelector((state) => state.tradeRecords.listOfTrades);

    // Reuse the calendar execution ledger so partial exits belong to their actual day.
    const tradesForDay = useMemo(() => {
        return getCalendarEventsForDay(trades ?? [], dayjs(date).format("DD-MM-YYYY"));
    }, [trades, date]);

    const openedCount = useMemo(() => {
        return tradesForDay.filter(
            (t) => t.eventType === "open" || t.eventType === "add"
        ).length;
    }, [tradesForDay]);

    const closedCount = useMemo(() => {
        return tradesForDay.filter(
            (t) => t.eventType === "reduce" || t.eventType === "close"
        ).length;
    }, [tradesForDay]);

    const realizedPnL = useMemo(() => {
        return tradesForDay.reduce((sum, t) => {
            if (t.eventType === "reduce" || t.eventType === "close") {
                return sum + (Number(t.result) || 0);
            }
            return sum;
        }, 0);
    }, [tradesForDay]);

    const editor = useEditor({
        extensions: [
            StarterKit,
            Placeholder.configure({
                placeholder: "Document trading mindset, market environment, catalysts, and execution lessons...",
            }),
        ],
        content: initialContent || "",
        immediatelyRender: false,
        editorProps: {
            attributes: {
                class: "prose prose-slate prose-base max-w-none focus:outline-none min-h-[calc(100vh-280px)] text-[15px] leading-relaxed [&_h1]:text-[1.35rem] [&_h1]:leading-tight [&_h2]:text-[1.15rem] [&_h3]:text-[1rem] [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5",
            },
        },
        onUpdate: ({ editor: currentEditor }) => {
            const currentContent = JSON.stringify(currentEditor.getJSON());
            const isDirty = currentContent !== savedContentRef.current;
            setHasUnsavedChanges(isDirty);

            if (isDirty) {
                writeJournalDraft(date, currentEditor.getJSON());
            } else {
                removeJournalDraft(date);
                setIsRecoveredDraft(false);
            }
        },
    });

    // Capture the exact initial document once Tiptap has initialized it.
    useEffect(() => {
        if (!editor || savedContentRef.current) return;
        const persistedDraft = readJournalDraft(date);
        savedContentRef.current = JSON.stringify(editor.getJSON());

        if (persistedDraft && JSON.stringify(persistedDraft) !== savedContentRef.current) {
            // The saved baseline remains the database document, never the draft.
            editor.commands.setContent(persistedDraft, { emitUpdate: false });
            setIsRecoveredDraft(true);
            setHasUnsavedChanges(true);
        }
    }, [date, editor, initialContent]);

    useEffect(() => {
        setDraftDirty(hasUnsavedChanges);
    }, [hasUnsavedChanges, setDraftDirty]);

    useEffect(() => {
        return () => setDraftDirty(false);
    }, [setDraftDirty]);

    const handleSave = useCallback(async () => {
        if (!editor || !hasUnsavedChanges || isSaving || isDeleting) return;

        setIsSaving(true);
        try {
            const content = editor.getJSON();
            const result = await saveJournalEntry(date, content);

            if (result.success) {
                const savedContent = JSON.stringify(content);
                const latestContent = editor.getJSON();
                const latestContentString = JSON.stringify(latestContent);
                savedContentRef.current = savedContent;
                setHasUnsavedChanges(latestContentString !== savedContent);
                setHasSavedEntry(true);
                setIsRecoveredDraft(false);
                removeJournalDraft(date);

                if (latestContentString !== savedContent) {
                    writeJournalDraft(date, latestContent);
                }

                toast.success("Journal entry saved");
            } else {
                toast.error(result.error || "Failed to save entry");
            }
        } catch {
            toast.error("Failed to save entry");
        } finally {
            setIsSaving(false);
        }
    }, [editor, hasUnsavedChanges, isSaving, isDeleting, date]);

    const handleDelete = useCallback(async () => {
        if (isDeleting || isSaving) return;
        setIsDeleting(true);
        try {
            const result = await deleteJournalEntry(date);
            if (result.success) {
                savedContentRef.current = JSON.stringify({});
                setHasUnsavedChanges(false);
                setIsRecoveredDraft(false);
                setDraftDirty(false);
                removeJournalDraft(date);
                toast.success("Journal entry deleted");
                router.push("/private/journal");
            } else {
                toast.error(result.error || "Failed to delete entry");
            }
        } catch {
            toast.error("Failed to delete entry");
        } finally {
            setIsDeleting(false);
            setIsDeleteDialogOpen(false);
        }
    }, [date, router, isDeleting, isSaving, setDraftDirty]);

    // Prevent unsaved data loss on page unload / tab close
    useEffect(() => {
        const handleBeforeUnload = (e: BeforeUnloadEvent) => {
            if (hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = "";
            }
        };
        window.addEventListener("beforeunload", handleBeforeUnload);
        return () => window.removeEventListener("beforeunload", handleBeforeUnload);
    }, [hasUnsavedChanges, editor]);

    // Keyboard shortcut for save (Cmd/Ctrl + S)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "s") {
                e.preventDefault();
                if (editor && hasUnsavedChanges) {
                    handleSave();
                }
            }
        };

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [editor, hasUnsavedChanges, handleSave]);

    if (!editor) {
        return null;
    }

    return (
        <div className="flex h-full min-h-0 min-w-0 w-full overflow-hidden">
            {/* Left: Main Journal Writing Area */}
            <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 2xl:p-8">
                <div className="mx-auto max-w-3xl">
                    {/* Header */}
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 pb-3">
                        <div className="min-w-0">
                            <span className="block text-xs font-medium text-zinc-500">
                                Daily journal
                            </span>
                            <h1 className="mt-0.5 text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">
                                {dayjs(date).format("dddd, MMMM D, YYYY")}
                            </h1>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2">
                            {isRecoveredDraft ? (
                                <>
                                    <span
                                        role="status"
                                        className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700"
                                    >
                                        <History className="h-3.5 w-3.5" />
                                        Recovered unsaved draft
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            if (
                                                !window.confirm(
                                                    "Discard the recovered draft and return to the saved entry?"
                                                )
                                            ) {
                                                return;
                                            }

                                            editor.commands.setContent(initialContent || "");
                                            savedContentRef.current = JSON.stringify(
                                                editor.getJSON()
                                            );
                                            setHasUnsavedChanges(false);
                                            setIsRecoveredDraft(false);
                                            setDraftDirty(false);
                                            removeJournalDraft(date);
                                        }}
                                        className="inline-flex items-center gap-1.5 rounded-md border border-amber-200 px-2 py-1 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-50"
                                        title="Discard recovered draft"
                                    >
                                        <RotateCcw className="h-3.5 w-3.5" />
                                        Discard draft
                                    </button>
                                </>
                            ) : hasUnsavedChanges ? (
                                <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700">
                                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                                    Unsaved
                                </span>
                            ) : null}

                            {hasSavedEntry && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsDeleteDialogOpen(true)}
                                    disabled={isDeleting || isSaving}
                                    className="gap-1.5 border-zinc-200 text-xs text-rose-600 hover:border-rose-200 hover:bg-rose-50 hover:text-rose-700"
                                >
                                    <Trash2 className="h-3.5 w-3.5" />
                                    Delete
                                </Button>
                            )}

                            <Button
                                onClick={handleSave}
                                disabled={isSaving || !hasUnsavedChanges}
                                size="sm"
                                className="gap-1.5 bg-zinc-900 text-xs font-semibold text-white shadow-xs hover:bg-zinc-800"
                            >
                                {isSaving ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="h-3.5 w-3.5" />
                                        Save Entry
                                    </>
                                )}
                            </Button>

                            <button
                                type="button"
                                onClick={() => setIsContextOpen((open) => !open)}
                                aria-label={
                                    isContextOpen
                                        ? "Hide day execution context"
                                        : "Show day execution context"
                                }
                                aria-expanded={isContextOpen}
                                title={
                                    isContextOpen
                                        ? "Hide day execution context"
                                        : "Show day execution context"
                                }
                                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-zinc-200 text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400"
                            >
                                {isContextOpen ? (
                                    <PanelRightClose className="h-4 w-4" />
                                ) : (
                                    <PanelRightOpen className="h-4 w-4" />
                                )}
                            </button>
                        </div>
                    </div>

                    <MenuBar editor={editor} />

                    {isContextOpen && (
                        <div className="mb-4 border-b border-zinc-200 pb-3 xl:hidden">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-600">
                                <span className="font-medium text-zinc-800">
                                    Day executions
                                </span>
                                <span className="font-mono tabular-nums">
                                    {tradesForDay.length} events
                                </span>
                                <span
                                    className={`font-mono font-medium tabular-nums ${
                                        realizedPnL > 0
                                            ? "text-emerald-700"
                                            : realizedPnL < 0
                                            ? "text-rose-700"
                                            : "text-zinc-600"
                                    }`}
                                >
                                    {realizedPnL >= 0 ? "+$" : "-$"}
                                    {Math.abs(realizedPnL).toLocaleString("en-US", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                    })}
                                </span>
                                <span className="font-mono tabular-nums">
                                    {closedCount} exits · {openedCount} entries
                                </span>
                            </div>
                        </div>
                    )}

                    {editor && (
                        <BubbleMenu editor={editor}>
                            <div className="flex gap-1 bg-slate-900 border border-slate-800 text-white rounded-lg p-1 shadow-lg items-center select-none">
                                <button
                                    type="button"
                                    onClick={() => editor.chain().focus().toggleBold().run()}
                                    className={cn(
                                        "p-1.5 rounded text-xs font-semibold hover:bg-slate-800",
                                        editor.isActive("bold") ? "text-amber-400 bg-slate-800" : "text-slate-300"
                                    )}
                                    title="Bold"
                                >
                                    B
                                </button>
                                <button
                                    type="button"
                                    onClick={() => editor.chain().focus().toggleItalic().run()}
                                    className={cn(
                                        "p-1.5 rounded text-xs italic hover:bg-slate-800",
                                        editor.isActive("italic") ? "text-amber-400 bg-slate-800" : "text-slate-300"
                                    )}
                                    title="Italic"
                                >
                                    I
                                </button>
                                <button
                                    type="button"
                                    onClick={() => editor.chain().focus().toggleStrike().run()}
                                    className={cn(
                                        "p-1.5 rounded text-xs line-through hover:bg-slate-800",
                                        editor.isActive("strike") ? "text-amber-400 bg-slate-800" : "text-slate-300"
                                    )}
                                    title="Strikethrough"
                                >
                                    S
                                </button>
                                <div className="w-px h-3.5 bg-slate-700 mx-1" />
                                <button
                                    type="button"
                                    onClick={() => editor.chain().focus().toggleCode().run()}
                                    className={cn(
                                        "p-1.5 rounded text-xs font-mono hover:bg-slate-800",
                                        editor.isActive("code") ? "text-amber-400 bg-slate-800" : "text-slate-300"
                                    )}
                                    title="Code"
                                >
                                    Code
                                </button>
                            </div>
                        </BubbleMenu>
                    )}

                    <EditorContent editor={editor} />
                </div>
            </div>

            {/* Right: Day Trading Execution Context Pane */}
            {isContextOpen && (
                <aside className="hidden h-full w-64 min-w-0 shrink-0 flex-col overflow-y-auto border-l border-zinc-200 bg-zinc-50/70 p-4 xl:flex 2xl:w-80">
                <div className="mb-3 flex items-center justify-between border-b border-zinc-200 pb-3">
                    <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4 text-zinc-600" />
                        <h3 className="text-sm font-semibold text-zinc-800">
                            Day executions
                        </h3>
                    </div>
                    <span className="font-mono text-xs tabular-nums text-zinc-500">
                        {tradesForDay.length} events
                    </span>
                </div>

                {/* Day P&L & Volume Summary */}
                <div className="grid grid-cols-2 gap-2 mb-4">
                    <div className="p-3 rounded-xl border border-slate-200/80 bg-white">
                        <span className="block text-xs font-medium text-zinc-500">
                            Realized P&amp;L
                        </span>
                        <p
                            className={`text-base font-bold font-mono tabular-nums mt-0.5 ${
                                realizedPnL > 0
                                    ? "text-emerald-700"
                                    : realizedPnL < 0
                                    ? "text-rose-700"
                                    : "text-slate-600"
                            }`}
                        >
                            {realizedPnL >= 0 ? "+$" : "-$"}
                            {Math.abs(realizedPnL).toLocaleString("en-US", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                            })}
                        </p>
                    </div>

                    <div className="p-3 rounded-xl border border-slate-200/80 bg-white">
                        <span className="block text-xs font-medium text-zinc-500">
                            Fills activity
                        </span>
                        <p className="text-sm font-bold font-mono text-slate-800 tabular-nums mt-1">
                            {closedCount} exits · {openedCount} entries
                        </p>
                    </div>
                </div>

                {/* Executions List */}
                <div className="space-y-2 flex-1">
                    <span className="block px-1 text-xs font-medium text-zinc-500">
                            Executions on this day
                    </span>

                    {tradesForDay.length > 0 ? (
                        tradesForDay.map((trade) => {
                            const isBuy = trade.positionType === "buy";
                            const isClosedToday = trade.eventType === "reduce" || trade.eventType === "close";
                            const result = Number(trade.result) || 0;

                            return (
                                <div
                                    key={trade.id}
                                    className="p-3 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 transition-colors shadow-2xs space-y-1.5"
                                >
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-1.5">
                                            <span
                                                className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase ${
                                                    isBuy
                                                        ? "bg-emerald-50 text-emerald-700 border-emerald-200/80"
                                                        : "bg-rose-50 text-rose-700 border-rose-200/80"
                                                }`}
                                            >
                                                {isBuy ? "Long" : "Short"}
                                            </span>
                                            <span className="text-xs font-bold text-slate-900">
                                                {trade.symbolName}
                                            </span>
                                        </div>

                                        <span className="text-[10px] font-mono font-semibold text-slate-500">
                                            {trade.eventType === "open" ? "Opened" : trade.eventType === "add" ? "Added" : trade.eventType === "reduce" ? "Reduced" : "Closed"}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-600">
                                        <span>
                                            Qty: {Number(trade.quantity ?? 0).toLocaleString()} @ ${Number(trade.price ?? trade.entryPrice ?? 0).toFixed(2)}
                                        </span>

                                        {isClosedToday && trade.result !== undefined && (
                                            <span
                                                className={`font-bold ${
                                                    result >= 0
                                                        ? "text-emerald-700 inline-flex items-center gap-0.5"
                                                        : "text-rose-700 inline-flex items-center gap-0.5"
                                                }`}
                                            >
                                                {result >= 0 ? (
                                                    <TrendingUp className="w-3 h-3" />
                                                ) : (
                                                    <TrendingDown className="w-3 h-3" />
                                                )}
                                                {result >= 0 ? "+$" : "-$"}
                                                {Math.abs(result).toFixed(2)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="p-6 text-center border border-dashed border-slate-200 rounded-xl bg-white/70">
                            <Layers className="w-6 h-6 text-slate-300 mx-auto mb-1.5" />
                            <p className="text-xs text-slate-500 font-medium">
                                No trade executions on this date.
                            </p>
                            <p className="text-[11px] text-slate-400 mt-0.5">
                                Market reflections only.
                            </p>
                        </div>
                    )}
                </div>
                </aside>
            )}

            {/* Delete Confirmation Dialog */}
            <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <DialogContent className="max-w-sm">
                    <div className="sm:max-w-[380px] flex flex-col justify-between min-h-[120px]">
                        <DialogHeader className="mb-2">
                            <DialogTitle className="text-lg font-semibold text-slate-800">
                                Delete Journal Entry
                            </DialogTitle>
                        </DialogHeader>
                        <p className="text-sm text-slate-600">
                            Are you sure you want to delete the journal entry for this day? This action cannot be undone.
                        </p>
                        <div className="flex gap-3 justify-end mt-6">
                            <DialogClose asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    disabled={isDeleting}
                                    className="text-xs"
                                >
                                    Cancel
                                </Button>
                            </DialogClose>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={handleDelete}
                                disabled={isDeleting}
                                className="bg-rose-600 hover:bg-rose-700 text-white gap-2 text-xs font-semibold"
                            >
                                {isDeleting ? (
                                    <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                        Deleting...
                                    </>
                                ) : (
                                    "Confirm Delete"
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
