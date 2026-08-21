"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { CalendarIcon, Info } from "lucide-react";
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
}

const formatQty = (qty: number | string): string => {
    const num = Number(qty);
    if (isNaN(num)) return "0";
    return Number(num.toPrecision(8)).toString();
};

const formatPrice = (price: number | string): string => {
    const num = Number(price);
    if (isNaN(num)) return "0";
    return Number(num.toPrecision(8)).toString();
};

export const AdjustPositionTab = ({
    existingTrade,
    onRequestClose,
    prefilledQtyChange,
}: AdjustPositionTabProps) => {
    const router = useRouter();
    const dispatch = useAppDispatch();
    const [submitting, setSubmitting] = useState(false);
    const [adjustDateVal, setAdjustDateVal] = useState<Date>(new Date());
    const [mode, setMode] = useState<"add" | "reduce">(
        prefilledQtyChange && prefilledQtyChange < 0 ? "reduce" : "add"
    );

    // Calculate remaining quantity
    const originalQty = Number(existingTrade.quantity) || 0;
    const currentPrice = Number(existingTrade.entryPrice) || 0;

    const form = useForm<z.infer<typeof adjustPositionClientSchema>>({
        resolver: zodResolver(adjustPositionClientSchema),
        defaultValues: {
            adjustQty: prefilledQtyChange ? String(Math.abs(prefilledQtyChange)) : "",
            adjustPrice: "",
            adjustDate: new Date().toISOString(),
            adjustTime: dayjs().format("HH:mm"),
        },
    });

    const { register, control, handleSubmit, formState: { errors }, watch } = form;

    const adjustQtyValue = watch("adjustQty");
    const adjustPriceValue = watch("adjustPrice");

    useEffect(() => {
        if (adjustQtyValue && String(adjustQtyValue).trim().startsWith("-")) {
            setMode("reduce");
            form.setValue("adjustQty", String(Math.abs(Number(adjustQtyValue))));
        }
    }, [adjustQtyValue, form]);

    // Real-time Live Preview Calculations
    const adjQty = Math.abs(Number(adjustQtyValue)) || 0;
    const signedQty = mode === "reduce" ? -adjQty : adjQty;
    const adjPrice = Number(adjustPriceValue) || 0;

    let previewQty = originalQty;
    let previewPrice = currentPrice;
    let previewPL: number | null = null;

    if (adjQty !== 0) {
        previewQty = originalQty + signedQty;
        if (mode === "add") {
            // Scale-in (add): recalculate VWAP entry price
            previewPrice = previewQty > 0 ? (currentPrice * originalQty + adjPrice * adjQty) / previewQty : currentPrice;
        } else {
            // Scale-out (reduce): average price remains same, realized P/L is generated
            previewPrice = currentPrice;
            previewPL = (adjPrice - currentPrice) * adjQty * (existingTrade.positionType === "buy" ? 1 : -1);
        }
    }

    const onSubmit = async (data: z.infer<typeof adjustPositionClientSchema>) => {
        setSubmitting(true);
        try {
            // Internally convert to negative if in reduce mode
            const qtyNum = Math.abs(Number(data.adjustQty));
            const finalQtyStr = mode === "reduce" ? `-${qtyNum}` : `${qtyNum}`;

            const submitData = {
                ...data,
                adjustQty: finalQtyStr,
            };

            const result = await adjustTradePosition(existingTrade.id, submitData);
            if (result?.error) {
                toast.error("Failed to adjust position. Please check your inputs.");
                return;
            }

            if (result?.updatedTrade) {
                dispatch(updateTradeInList(result.updatedTrade));
                dispatch(updateTradeInFilteredList(result.updatedTrade));
                toast.success(previewQty <= 0 ? "Position closed successfully!" : "Position adjusted successfully!");
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
            <DialogHeader className="mb-4 shrink-0">
                <DialogTitle className="text-center text-[1.4rem]">
                    Adjust Position
                </DialogTitle>
                <DialogDescription className="text-center text-[.85rem] text-tertiary">
                    {mode === "reduce" && previewQty <= 0 
                        ? `Close this trade by selling remaining units.`
                        : `Scale in (add to position) or scale out (reduce position).`}
                </DialogDescription>
            </DialogHeader>

            {/* Mode Selector */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-zinc-100 rounded-lg shrink-0 mb-4">
                <button
                    type="button"
                    onClick={() => {
                        setMode("add");
                        const currentVal = form.getValues("adjustQty");
                        if (currentVal) {
                            form.setValue("adjustQty", String(Math.abs(Number(currentVal))));
                        }
                    }}
                    className={`py-2 text-xs font-semibold rounded-md transition-all duration-200 ${
                        mode === "add"
                            ? "bg-white text-zinc-800 shadow-sm"
                            : "text-zinc-500 hover:text-zinc-700"
                    }`}
                >
                    Add to Position
                </button>
                <button
                    type="button"
                    onClick={() => {
                        setMode("reduce");
                        const currentVal = form.getValues("adjustQty");
                        if (currentVal) {
                            form.setValue("adjustQty", String(Math.abs(Number(currentVal))));
                        }
                    }}
                    className={`py-2 text-xs font-semibold rounded-md transition-all duration-200 ${
                        mode === "reduce"
                            ? "bg-white text-zinc-800 shadow-sm"
                            : "text-zinc-500 hover:text-zinc-700"
                    }`}
                >
                    Reduce Position
                </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
                {/* Info Tip */}
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-800">
                    <Info className="w-4 h-4 mt-0.5 shrink-0" />
                    <div className="text-xs">
                        <p className="font-medium">Adjustment Guide:</p>
                        <p className="mt-1 text-blue-700">
                            {mode === "add"
                                ? "Enter a positive quantity to increase the position size. The new Volume Weighted Average Price (VWAP) entry price will be recalculated."
                                : "Enter a positive quantity to decrease the position size. The realized profit or loss will be calculated based on the entry price."}
                        </p>
                    </div>
                </div>

                {/* Date and Time Picker */}
                <div className="border border-zinc-200 rounded-lg p-4 bg-zinc-50/50">
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Adjustment Timestamp</h3>
                    <div className="flex gap-4">
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
                                                className="justify-start text-left font-normal text-sm bg-white border-zinc-200"
                                            >
                                                <CalendarIcon className="h-4 w-4 mr-2 text-zinc-400" />
                                                {adjustDateVal ? (
                                                    format(adjustDateVal, "dd MMM yyyy")
                                                ) : (
                                                    <span className="text-zinc-400">Pick a date</span>
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
                                                disabled={(date) =>
                                                    date < new Date(existingTrade.openDate)
                                                }
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
                                className="w-full text-sm bg-white border-zinc-200"
                                {...register("adjustTime")}
                            />
                            {errors.adjustTime && (
                                <span className="text-xs text-red-500">{errors.adjustTime.message}</span>
                            )}
                        </div>
                    </div>
                </div>

                {/* Adjustment Details */}
                <div className="border border-zinc-200 rounded-lg p-4 bg-zinc-50/50">
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Adjustment details</h3>
                    <div className="flex gap-4">
                        <div className="flex flex-col flex-1 gap-1">
                            <Label htmlFor="adjustQty" className="text-xs text-zinc-500 font-medium">
                                {mode === "add" ? "Quantity to Add" : "Quantity to Reduce"}
                            </Label>
                            <Input
                                type="number"
                                id="adjustQty"
                                step="any"
                                placeholder="5"
                                className="w-full text-sm bg-white border-zinc-200"
                                {...register("adjustQty")}
                            />
                            {errors.adjustQty && (
                                <span className="text-xs text-red-500">{errors.adjustQty.message}</span>
                            )}
                        </div>

                        <div className="flex flex-col flex-1 gap-1">
                            <Label htmlFor="adjustPrice" className="text-xs text-zinc-500">Adjustment price</Label>
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

                {/* Live Preview Card */}
                <div className="border border-dashed border-zinc-200 rounded-lg p-4 bg-zinc-50/30">
                    <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Live Preview</h3>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="flex flex-col">
                            <span className="text-xs text-zinc-400">Current Qty</span>
                            <span className="font-semibold text-zinc-700">{formatQty(originalQty)}</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xs text-zinc-400">
                                {mode === "add" ? "New Total Qty" : "Remaining Qty"}
                            </span>
                            <span className="font-semibold text-zinc-700">
                                {previewQty <= 0 ? (
                                    <span className="text-red-500 font-bold">Closed</span>
                                ) : (
                                    formatQty(previewQty)
                                )}
                            </span>
                        </div>
                        <div className="flex flex-col col-span-2 border-t border-zinc-100 pt-2 mt-1">
                            {adjQty > 0 ? (
                                <>
                                    {mode === "add" ? (
                                        <>
                                            <span className="text-xs text-zinc-400">New Avg Entry Price</span>
                                            <span className="font-bold text-emerald-600">
                                                ${formatPrice(previewPrice)}
                                            </span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="text-xs text-zinc-400">Estimated Realized P/L</span>
                                            <span className={`font-bold ${previewPL !== null && previewPL >= 0 ? "text-buy" : "text-sell"}`}>
                                                {previewPL !== null ? (
                                                    `${previewPL >= 0 ? "+" : ""}${previewPL.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                                ) : (
                                                    "—"
                                                )}
                                            </span>
                                        </>
                                    )}
                                </>
                            ) : (
                                <span className="text-xs text-zinc-400 italic">
                                    {mode === "add" 
                                        ? "Enter quantity to add to preview adjustments"
                                        : "Enter quantity to reduce to preview adjustments"}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer buttons */}
            <div className="shrink-0 pt-4 mt-auto border-t border-zinc-200 bg-white">
                <div className="flex gap-4 justify-end">
                    <CustomButton isBlack={false} type="button" onClick={onRequestClose}>
                        Cancel
                    </CustomButton>
                    <CustomButton
                        isBlack
                        type="submit"
                        disabled={submitting}
                    >
                        {mode === "reduce" && previewQty <= 0 ? "Close Position" : "Apply Adjustment"}
                    </CustomButton>
                </div>
            </div>
        </form>
    );
};
