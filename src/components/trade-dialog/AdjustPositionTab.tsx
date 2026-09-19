"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { format } from "date-fns";
import { CalendarIcon, Info, ArrowLeft, PlusCircle, MinusCircle, XCircle } from "lucide-react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";

import { Trades } from "@/types";
import { adjustTradePosition } from "@/server/actions/trades";
import { useAppDispatch } from "@/redux/store";
import { updateTradeInList } from "@/redux/slices/tradeRecordsSlice";
import { updateTradeInFilteredList } from "@/redux/slices/historyPageSlice";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Calendar } from "../ui/calendar";
import { Button } from "../ui/button";
import { Label } from "../ui/label";
import { Input } from "../ui/input";
import { CustomButton } from "../CustomButton";
import { DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";

const adjustPositionClientSchema = z.object({
    adjustQty: z
        .string()
        .min(1, { message: "Quantity is required." })
        .refine((val) => {
            const num = Number(val);
            return Number.isFinite(num) && num > 0;
        }, {
            message: "Quantity must be positive.",
        }),
    adjustPrice: z
        .string()
        .min(1, { message: "Price is required." })
        .refine((val) => {
            return /^[0-9]+(\.[0-9]+)?$/.test(val);
        }, {
            message: "Only positive numbers are allowed.",
        }),
    adjustDate: z.string().min(1, { message: "Adjustment date is required." }),
    adjustTime: z.string().min(1, { message: "Adjustment time is required." }),
});

interface AdjustPositionTabProps {
    existingTrade: Trades;
    onRequestClose?: () => void;
    prefilledQtyChange?: number;
    initialAdjustMode?: "add" | "reduce" | "close";
    onBackToNewTrade?: () => void;
}

const formatQty = (qty: number | string): string => {
    const num = Number(qty);
    if (isNaN(num)) return "0";
    return Number(num.toPrecision(8)).toString();
};

const formatPrice = (price: number | string): string => {
    const num = Number(price);
    if (isNaN(num)) return "0";
    if (Math.abs(num) >= 1) {
        return num.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 4,
        });
    }
    return num.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
    });
};

export const AdjustPositionTab = ({
    existingTrade,
    onRequestClose,
    prefilledQtyChange,
    initialAdjustMode,
    onBackToNewTrade,
}: AdjustPositionTabProps) => {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const [submitting, setSubmitting] = useState(false);
    const [adjustDateVal, setAdjustDateVal] = useState<Date>(new Date());
    
    const getInitialMode = (): "add" | "reduce" | "close" => {
        if (initialAdjustMode) return initialAdjustMode;
        if (prefilledQtyChange) {
            return prefilledQtyChange < 0 ? "reduce" : "add";
        }
        return "add";
    };

    const [mode, setMode] = useState<"add" | "reduce" | "close">(getInitialMode());

    const originalQty = useMemo(() => Number(existingTrade.quantity) || 0, [existingTrade.quantity]);
    const currentPrice = useMemo(() => Number(existingTrade.entryPrice) || 0, [existingTrade.entryPrice]);
    const isBuy = existingTrade.positionType === "buy";

    const form = useForm<z.infer<typeof adjustPositionClientSchema>>({
        resolver: zodResolver(adjustPositionClientSchema),
        defaultValues: {
            adjustQty: mode === "close" ? String(originalQty) : (prefilledQtyChange ? String(Math.abs(prefilledQtyChange)) : ""),
            adjustPrice: "",
            adjustDate: new Date().toISOString(),
            adjustTime: dayjs().format("HH:mm"),
        },
    });

    const { register, control, handleSubmit, formState: { errors }, watch, setValue } = form;

    const adjustQtyValue = watch("adjustQty");
    const adjustPriceValue = watch("adjustPrice");

    const handleModeChange = useCallback((newMode: "add" | "reduce" | "close") => {
        setMode(newMode);
        if (newMode === "close") {
            setValue("adjustQty", String(originalQty), { shouldValidate: true });
        } else if (mode === "close") {
            setValue("adjustQty", "", { shouldValidate: false });
        }
    }, [setValue, originalQty, mode]);

    useEffect(() => {
        if (initialAdjustMode) {
            handleModeChange(initialAdjustMode);
        }
    }, [initialAdjustMode, handleModeChange]);

    const handleQuickPercent = (pct: number) => {
        if (pct === 100) {
            handleModeChange("close");
        } else {
            const calculatedQty = Number((originalQty * (pct / 100)).toFixed(4));
            setValue("adjustQty", String(calculatedQty), { shouldValidate: true });
        }
    };

    const adjQty = mode === "close" ? originalQty : (Math.abs(Number(adjustQtyValue)) || 0);
    const signedQty = mode === "add" ? adjQty : -adjQty;
    const adjPrice = Number(adjustPriceValue) || 0;

    let previewQty = originalQty;
    let previewPrice = currentPrice;
    let previewPL: number | null = null;
    let previewPLPercent: number | null = null;

    if (adjQty > 0) {
        previewQty = mode === "close" ? 0 : Math.max(0, originalQty + signedQty);
        if (mode === "add") {
            previewPrice = previewQty > 0 ? (currentPrice * originalQty + adjPrice * adjQty) / previewQty : currentPrice;
        } else {
            previewPrice = currentPrice;
            if (adjPrice > 0) {
                previewPL = (adjPrice - currentPrice) * adjQty * (isBuy ? 1 : -1);
                if (currentPrice > 0) {
                    previewPLPercent = ((adjPrice - currentPrice) / currentPrice) * 100 * (isBuy ? 1 : -1);
                }
            }
        }
    }

    const onSubmit = async (data: z.infer<typeof adjustPositionClientSchema>) => {
        setSubmitting(true);
        try {
            const qtyNum = mode === "close" ? originalQty : Math.abs(Number(data.adjustQty));
            
            if (mode !== "add" && qtyNum > originalQty + 0.000001) {
                toast.error(`Cannot reduce more than current position size (${originalQty}).`);
                setSubmitting(false);
                return;
            }

            const isClosing = mode === "close" || qtyNum >= originalQty - 0.000001;
            const finalQtyStr = mode === "add" ? `${qtyNum}` : `-${qtyNum}`;
            const determinedEventType: "add" | "reduce" | "close" = mode === "add" ? "add" : (isClosing ? "close" : "reduce");

            const submitData = {
                ...data,
                adjustQty: finalQtyStr,
                eventType: determinedEventType,
            };

            const result = await adjustTradePosition(existingTrade.id, submitData);
            if (result?.error) {
                toast.error(result.message || "Failed to adjust position. Please check your inputs.");
                return;
            }

            if (result?.updatedTrade) {
                dispatch(updateTradeInList(result.updatedTrade));
                dispatch(updateTradeInFilteredList(result.updatedTrade));
                
                if (determinedEventType === "close") {
                    toast.success(`Position in ${existingTrade.symbolName} fully closed!`);
                } else if (determinedEventType === "reduce") {
                    toast.success(`Reduced ${qtyNum} units from ${existingTrade.symbolName}.`);
                } else {
                    toast.success(`Added ${qtyNum} units to ${existingTrade.symbolName}.`);
                }
            }

            router.refresh();
            if (onRequestClose) {
                onRequestClose();
            }
        } catch {
            toast.error("An unexpected error occurred.");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <form
            onSubmit={handleSubmit(onSubmit)}
            className="flex flex-col flex-1 h-full overflow-hidden pr-1"
        >
            <DialogHeader className="mb-3 shrink-0">
                {onBackToNewTrade && (
                    <button
                        type="button"
                        onClick={onBackToNewTrade}
                        className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-800 font-medium mb-1 transition-colors self-start"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        Back to New Trade
                    </button>
                )}
                <div className="flex items-center justify-between">
                    <DialogTitle className="text-xl font-bold text-zinc-900">
                        {mode === "add" ? "Add to Position" : mode === "reduce" ? "Reduce Position" : "Close Position"}
                    </DialogTitle>
                    <div className="flex items-center gap-1.5">
                        <span className={`text-[11px] font-mono font-bold px-2 py-0.5 rounded ${
                            isBuy ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                        }`}>
                            {isBuy ? "Long" : "Short"}
                        </span>
                        <span className="font-mono font-bold text-xs text-zinc-800 bg-zinc-100 px-2 py-0.5 rounded border border-zinc-200">
                            {existingTrade.symbolName}
                        </span>
                    </div>
                </div>
                <DialogDescription className="text-xs text-zinc-500 text-left">
                    Current holding: <strong className="text-zinc-800 font-mono">{formatQty(originalQty)} units</strong> @ <strong className="text-zinc-800 font-mono">${formatPrice(currentPrice)}</strong>
                </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-100/90 rounded-lg shrink-0 mb-3 border border-zinc-200/60">
                <button
                    type="button"
                    onClick={() => handleModeChange("add")}
                    className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-all duration-150 flex items-center justify-center gap-1.5 ${
                        mode === "add"
                            ? "bg-white text-emerald-700 shadow-xs border border-zinc-200/80 font-bold"
                            : "text-zinc-500 hover:text-zinc-800"
                    }`}
                >
                    <PlusCircle className="w-3.5 h-3.5" />
                    Add
                </button>
                <button
                    type="button"
                    onClick={() => handleModeChange("reduce")}
                    className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-all duration-150 flex items-center justify-center gap-1.5 ${
                        mode === "reduce"
                            ? "bg-white text-amber-700 shadow-xs border border-zinc-200/80 font-bold"
                            : "text-zinc-500 hover:text-zinc-800"
                    }`}
                >
                    <MinusCircle className="w-3.5 h-3.5" />
                    Reduce
                </button>
                <button
                    type="button"
                    onClick={() => handleModeChange("close")}
                    className={`py-1.5 px-2 text-xs font-semibold rounded-md transition-all duration-150 flex items-center justify-center gap-1.5 ${
                        mode === "close"
                            ? "bg-white text-rose-700 shadow-xs border border-zinc-200/80 font-bold"
                            : "text-zinc-500 hover:text-zinc-800"
                    }`}
                >
                    <XCircle className="w-3.5 h-3.5" />
                    Close
                </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
                <div className={`flex items-start gap-2 p-2.5 rounded-lg text-xs border ${
                    mode === "add" 
                        ? "bg-emerald-50/70 border-emerald-200 text-emerald-900"
                        : mode === "reduce"
                        ? "bg-amber-50/70 border-amber-200 text-amber-900"
                        : "bg-rose-50/70 border-rose-200 text-rose-900"
                }`}>
                    <Info className="w-4 h-4 mt-0.5 shrink-0" />
                    <div>
                        {mode === "add" && (
                            <p>Buy more to expand your position. Live VWAP entry price will be recalculated dynamically.</p>
                        )}
                        {mode === "reduce" && (
                            <p>Sell part of your holding. Realized P&L is locked and recorded without altering original entry baseline.</p>
                        )}
                        {mode === "close" && (
                            <p>Exit the entire {formatQty(originalQty)} units. This will finalize the trade and mark it closed.</p>
                        )}
                    </div>
                </div>

                <div className="border border-zinc-200/80 rounded-lg p-3 bg-zinc-50/50">
                    <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Event Timestamp</h3>
                    <div className="flex gap-3">
                        <div className="flex flex-col flex-1 gap-1">
                            <Label className="text-xs text-zinc-500">Date</Label>
                            <Controller
                                name="adjustDate"
                                control={control}
                                render={({ field }) => (
                                    <Popover modal={true}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant="outline"
                                                className="justify-start text-left font-normal text-xs bg-white border-zinc-200 h-9"
                                            >
                                                <CalendarIcon className="h-3.5 w-3.5 mr-2 text-zinc-400" />
                                                {adjustDateVal ? (
                                                    format(adjustDateVal, "dd MMM yyyy")
                                                ) : (
                                                    <span className="text-zinc-400">Pick date</span>
                                                )}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0" align="start">
                                            <Calendar
                                                mode="single"
                                                selected={adjustDateVal}
                                                onSelect={(date) => {
                                                    if (date) {
                                                        setAdjustDateVal(date);
                                                        field.onChange(date.toISOString());
                                                    }
                                                }}
                                            />
                                        </PopoverContent>
                                    </Popover>
                                )}
                            />
                            {errors.adjustDate && (
                                <span className="text-xs text-red-500">{errors.adjustDate.message}</span>
                            )}
                        </div>

                        <div className="flex flex-col flex-1 gap-1">
                            <Label className="text-xs text-zinc-500">Time</Label>
                            <Input
                                type="time"
                                className="w-full text-xs bg-white border-zinc-200 h-9"
                                {...register("adjustTime")}
                            />
                            {errors.adjustTime && (
                                <span className="text-xs text-red-500">{errors.adjustTime.message}</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="border border-zinc-200/80 rounded-lg p-3 bg-zinc-50/50">
                    <div className="flex items-center justify-between mb-2">
                        <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
                            {mode === "add" ? "Scale-in Details" : mode === "reduce" ? "Scale-out Details" : "Exit Details"}
                        </h3>
                        {mode === "reduce" && (
                            <div className="flex items-center gap-1">
                                {[25, 50, 75, 100].map((pct) => (
                                    <button
                                        key={pct}
                                        type="button"
                                        onClick={() => handleQuickPercent(pct)}
                                        className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-zinc-200 hover:bg-zinc-300 text-zinc-700 transition-colors"
                                    >
                                        {pct === 100 ? "100%" : `${pct}%`}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-3">
                        <div className="flex flex-col flex-1 gap-1">
                            <Label htmlFor="adjustQty" className="text-xs text-zinc-600 font-medium">
                                {mode === "add" ? "Quantity to Add" : mode === "reduce" ? "Quantity to Reduce" : "Total Closing Quantity"}
                            </Label>
                            <Input
                                type="number"
                                id="adjustQty"
                                step="any"
                                disabled={mode === "close"}
                                placeholder={mode === "close" ? String(originalQty) : "e.g. 500"}
                                className={`w-full text-sm bg-white border-zinc-200 ${mode === "close" ? "font-mono font-bold text-zinc-600 bg-zinc-100" : ""}`}
                                {...register("adjustQty")}
                            />
                            {errors.adjustQty && (
                                <span className="text-xs text-red-500">{errors.adjustQty.message}</span>
                            )}
                        </div>

                        <div className="flex flex-col flex-1 gap-1">
                            <Label htmlFor="adjustPrice" className="text-xs text-zinc-600 font-medium">
                                {mode === "add" ? "Buy Price" : "Execution / Sell Price"}
                            </Label>
                            <Input
                                type="number"
                                id="adjustPrice"
                                step="any"
                                placeholder="0.00"
                                className="w-full text-sm bg-white border-zinc-200"
                                {...register("adjustPrice")}
                            />
                            {errors.adjustPrice && (
                                <span className="text-xs text-red-500">{errors.adjustPrice.message}</span>
                            )}
                        </div>
                    </div>
                </div>

                <div className="border border-dashed border-zinc-300 rounded-lg p-3 bg-zinc-50/40">
                    <h3 className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider mb-2">Live Preview</h3>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                        <div className="flex flex-col">
                            <span className="text-zinc-400">Current Holding</span>
                            <span className="font-mono font-semibold text-zinc-700">{formatQty(originalQty)} units</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-zinc-400">
                                {mode === "add" ? "Estimated New Total" : "Remaining After Action"}
                            </span>
                            <span className="font-mono font-bold text-zinc-800">
                                {mode === "close" || previewQty <= 0 ? (
                                    <span className="text-rose-600">0 (Position Closed)</span>
                                ) : (
                                    `${formatQty(previewQty)} units`
                                )}
                            </span>
                        </div>
                        <div className="flex flex-col col-span-2 border-t border-zinc-200/60 pt-2 mt-1">
                            {adjQty > 0 && adjPrice > 0 ? (
                                <>
                                    {mode === "add" ? (
                                        <div className="flex items-center justify-between">
                                            <span className="text-zinc-500">Recalculated Average Entry (VWAP):</span>
                                            <span className="font-mono font-bold text-emerald-700 text-sm">
                                                ${formatPrice(previewPrice)}
                                            </span>
                                        </div>
                                    ) : (
                                        <div className="flex items-center justify-between">
                                            <span className="text-zinc-500">
                                                {mode === "close" ? "Final Realized P&L:" : "Realized P&L on this Reduction:"}
                                            </span>
                                            <div className="flex items-center gap-1.5">
                                                <span className={`font-mono font-bold text-sm ${
                                                    previewPL !== null && previewPL >= 0 ? "text-emerald-600" : "text-rose-600"
                                                }`}>
                                                    {previewPL !== null ? `${previewPL >= 0 ? "+" : ""}$${previewPL.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : "—"}
                                                </span>
                                                {previewPLPercent !== null && (
                                                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.2 rounded ${
                                                        previewPLPercent >= 0 ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-rose-50 text-rose-700 border border-rose-200"
                                                    }`}>
                                                        {previewPLPercent >= 0 ? "+" : ""}{previewPLPercent.toFixed(2)}%
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </>
                            ) : (
                                <span className="text-zinc-400 italic text-[11px]">
                                    Enter price & quantity above to see real-time calculation preview
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <div className="shrink-0 pt-3 mt-auto border-t border-zinc-200 bg-white">
                <div className="flex gap-3 justify-end">
                    <CustomButton isBlack={false} type="button" onClick={onRequestClose}>
                        Cancel
                    </CustomButton>
                    <CustomButton
                        isBlack
                        type="submit"
                        disabled={submitting}
                    >
                        {mode === "add" 
                            ? "Confirm Add to Position" 
                            : mode === "reduce" 
                            ? "Confirm Reduction" 
                            : "Confirm Full Close"}
                    </CustomButton>
                </div>
            </div>
        </form>
    );
};
