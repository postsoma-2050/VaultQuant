"use client";

import { deleteLocalStrategy } from "@/redux/slices/strategySlice";
import { useAppDispatch } from "@/redux/store";
import { deleteStrategyFromDB } from "@/server/actions/strategies";
import { Strategy } from "@/types/strategies.types";
import { Trash2 } from "lucide-react";
import React, { useRef, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "../ui/dialog";
import { CustomButton } from "../CustomButton";

export default function DeleteStrategyButton({
    strategy,
}: {
    strategy: Strategy;
}) {
    const [isLoading, setIsLoading] = useState(false);
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const deleting = useRef(false);
    const dispatch = useAppDispatch();
    const handleDeleteStrategy = async (e?: React.MouseEvent) => {
        e?.preventDefault();
        e?.stopPropagation();

        if (deleting.current) return;
        deleting.current = true;
        setIsLoading(true);
        try {
            const result = await deleteStrategyFromDB(strategy.id);
            if (!result?.success) throw new Error(result?.error || "Failed to delete strategy");
            dispatch(deleteLocalStrategy({ id: strategy.id }));
            setIsDialogOpen(false);
            toast.success("Strategy deleted successfully!");
        } catch (error) {
            console.error("Failed to delete strategy:", error);
            if (error instanceof Error) {
                toast.error(error.message);
            } else {
                toast.error("Unknown error occurred!");
            }
        } finally {
            deleting.current = false;
            setIsLoading(false);
        }
    };
    return (
        <Dialog open={isDialogOpen} onOpenChange={(open) => { if (!deleting.current) setIsDialogOpen(open); }}>
            <DialogTrigger asChild>
                <button
                    type="button"
                    disabled={isLoading}
                    onClick={(e) => {
                        e?.preventDefault();
                        e?.stopPropagation();
                        setIsDialogOpen(true);
                    }}
                    aria-label={`Delete ${strategy.strategyName}`}
                    className="p-2 rounded-md text-zinc-500 hover:bg-rose-50 hover:text-rose-600 disabled:hover:bg-transparent disabled:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-400">
                    <Trash2 size={16} aria-hidden="true" />
                </button>
            </DialogTrigger>
            <DialogContent className="max-w-sm">
                <div className="sm:max-w-[380px] flex flex-col justify-between min-h-[120px]">
                    <DialogHeader className="mb-2">
                        <DialogTitle className="text-lg">
                            Delete Strategy
                        </DialogTitle>
                    </DialogHeader>
                    <p className="text-sm text-zinc-600">
                        Do you want to delete the strategy &quot;{strategy.strategyName}&quot;?
                    </p>
                    <div className="flex gap-6 justify-end mt-6">
                        <DialogClose asChild>
                            <CustomButton isBlack={false} disabled={isLoading}>
                                Cancel
                            </CustomButton>
                        </DialogClose>
                        <CustomButton
                            isBlack
                            disabled={isLoading}
                            onClick={handleDeleteStrategy}
                        >
                            {isLoading ? "Deleting..." : "Delete"}
                        </CustomButton>
                    </div>
                </div>
            </DialogContent>
        </Dialog>
    );
}
