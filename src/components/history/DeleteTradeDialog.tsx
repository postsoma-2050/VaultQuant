"use client";

import { useRef, useState } from "react";
import { LoaderCircle, Trash2 } from "lucide-react";

import { confirmDeleteTrade } from "./deleteTradeDialogFlow";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog";

type DeleteTradeDialogProps = {
    isOpen: boolean;
    onOpenChange: (open: boolean) => void;
    message?: string;
    symbolName?: string;
    onConfirm: () => Promise<boolean>;
};

export default function DeleteTradeDialog({
    isOpen,
    onOpenChange,
    message,
    symbolName,
    onConfirm,
}: DeleteTradeDialogProps) {
    const [isPending, setIsPending] = useState(false);
    const pendingRef = useRef(false);

    const handleOpenChange = (open: boolean) => {
        if (!open && pendingRef.current) return;
        onOpenChange(open);
    };

    const handleDelete = async () => {
        if (pendingRef.current) return;

        pendingRef.current = true;
        setIsPending(true);

        try {
            await confirmDeleteTrade(onConfirm, () => onOpenChange(false));
        } finally {
            pendingRef.current = false;
            setIsPending(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent
                className="max-w-sm bg-white border border-zinc-200 p-6"
                aria-busy={isPending}
                onEscapeKeyDown={(event) => {
                    if (pendingRef.current) event.preventDefault();
                }}
                onPointerDownOutside={(event) => {
                    if (pendingRef.current) event.preventDefault();
                }}
            >
                <div className="flex flex-col gap-4">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-rose-50 dark:bg-rose-950/30 text-rose-600 flex items-center justify-center shrink-0">
                            <Trash2 className="w-5 h-5 text-rose-600" />
                        </div>
                        <div>
                            <DialogHeader>
                                <DialogTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                                    Delete Trade
                                </DialogTitle>
                            </DialogHeader>
                            <p className="text-[13px] text-zinc-500 mt-0.5">
                                This action cannot be undone.
                            </p>
                        </div>
                    </div>

                    <p className="text-[13px] text-zinc-600 leading-relaxed">
                        {message || `Are you sure you want to delete trade record for ${symbolName ? `"${symbolName}"` : "this item"}?`}
                    </p>

                    <div className="flex items-center justify-end gap-2.5 pt-2 mt-1 border-t border-zinc-100 dark:border-zinc-800">
                        <button
                            type="button"
                            disabled={isPending}
                            onClick={() => handleOpenChange(false)}
                            className="px-3.5 py-2 text-[13px] font-medium text-zinc-600 hover:bg-zinc-100 rounded-md transition-colors disabled:cursor-not-allowed disabled:opacity-50">
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={isPending}
                            onClick={handleDelete}
                            className="px-4 py-2 text-[13px] font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-md transition-colors flex items-center gap-1.5 disabled:cursor-not-allowed disabled:opacity-50">
                            {isPending ? (
                                <LoaderCircle size={14} className="animate-spin" />
                            ) : (
                                <Trash2 size={14} />
                            )}
                            {isPending ? "Deleting..." : "Delete"}
                        </button>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
