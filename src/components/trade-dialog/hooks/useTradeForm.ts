"use client";

import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { v4 as uuidv4 } from "uuid";
import dayjs from "dayjs";
import { useRouter } from "next/navigation";

import { newTradeFormSchema } from "@/zodSchema/schema";
import { createNewTradeRecord, updateTradeRecord, adjustTradePosition } from "@/server/actions/trades";
import { useAppDispatch, useAppSelector } from "@/redux/store";
import {
    setMonthViewSummary,
    setTotalOfParticularYearSummary,
    setYearViewSummary,
    updateListOfTrades,
    updateTradeDetailsForEachDay,
    updateTradeInList,
} from "@/redux/slices/tradeRecordsSlice";
import { setIsDialogOpen } from "@/redux/slices/calendarSlice";
import { updateTradeInFilteredList } from "@/redux/slices/historyPageSlice";
import { Trades } from "@/types";

interface UseTradeFormProps {
    editMode?: boolean;
    existingTrade?: Trades;
    day?: dayjs.Dayjs | undefined;
    onRequestClose?: () => void;
}

export const useTradeForm = ({ editMode = false, existingTrade, day, onRequestClose }: UseTradeFormProps) => {
    const [openDate, setOpenDate] = useState<Date>();
    const [closeDate, setCloseDate] = useState<Date>();
    const [symbolLabels, setSymbolLabels] = useState<string[]>([]);
    const [submittingTrade, setSubmittingTrade] = useState(false);
    const [selectedStrategyId, setSelectedStrategyId] = useState<string>("");
    const [checkedOpenRules, setCheckedOpenRules] = useState<string[]>([]);
    const [checkedCloseRules, setCheckedCloseRules] = useState<string[]>([]);
    const [validationState, setValidationState] = useState<"idle" | "validating" | "valid" | "invalid">("idle");
    const [validationPrice, setValidationPrice] = useState<number | undefined>(undefined);
    const [bypassValidation, setBypassValidation] = useState(false);

    const router = useRouter();
    const dispatch = useAppDispatch();
    const trades = useAppSelector((state) => state.tradeRecords.listOfTrades);
    const { strategies: localStrategies } = useAppSelector((state) => state.strategies);

    const form = useForm<z.infer<typeof newTradeFormSchema>>({
        resolver: zodResolver(newTradeFormSchema),
        defaultValues: editMode && existingTrade ? {
            positionType: existingTrade.positionType || "buy",
            openDate: existingTrade.openDate,
            openTime: existingTrade.openTime || "12:30",
            closeDate: existingTrade.closeDate || "",
            closeTime: existingTrade.closeTime || "",
            isActiveTrade: existingTrade.isActiveTrade ?? true,
            deposit: existingTrade.deposit || "",
            instrumentName: existingTrade.instrumentName || "",
            symbolName: existingTrade.symbolName || "",
            entryPrice: existingTrade.openOtherDetails?.initialEntryPrice || existingTrade.entryPrice || "",
            totalCost: existingTrade.totalCost || "",
            quantity: existingTrade.openOtherDetails?.initialQty || existingTrade.quantity || "",
            sellPrice: existingTrade.sellPrice || "",
            quantitySold: existingTrade.quantitySold || "",
            strategyName: existingTrade.strategyName || "",
            strategyId: existingTrade.strategyId || null,
            appliedOpenRules: existingTrade.appliedOpenRules || [],
            appliedCloseRules: existingTrade.appliedCloseRules || [],
            closeEvents: existingTrade.closeEvents || [],
            openOtherDetails: existingTrade.openOtherDetails || {},
            closeOtherDetails: existingTrade.closeOtherDetails || {},
            result: existingTrade.result || "",
            notes: existingTrade.notes || "",
            rating: existingTrade.rating || 0,
        } : {
            positionType: "buy",
            openDate: undefined,
            openTime: "12:30",
            closeDate: "",
            closeTime: "",
            isActiveTrade: true,
            deposit: "",
            instrumentName: "",
            symbolName: "",
            entryPrice: "",
            totalCost: "",
            quantity: "",
            sellPrice: "",
            quantitySold: "",
            strategyName: "",
            strategyId: null,
            appliedOpenRules: [],
            appliedCloseRules: [],
            closeEvents: [],
            openOtherDetails: {},
            closeOtherDetails: {},
            result: "",
            notes: "",
            rating: 0,
        },
    });

    const handleOpenRuleToggle = (ruleId: string, rule: unknown) => {
        const updatedCheckedRules = checkedOpenRules.includes(ruleId)
            ? checkedOpenRules.filter(id => id !== ruleId)
            : [...checkedOpenRules, ruleId];

        setCheckedOpenRules(updatedCheckedRules);

        // Mark parameter as intentionally unused
        void rule;

        const selectedStrategy = localStrategies.find(s => s.id === selectedStrategyId);
        if (selectedStrategy) {
            const appliedRules = selectedStrategy.openPositionRules.filter(r =>
                updatedCheckedRules.includes(r.id)
            );
            form.setValue("appliedOpenRules", appliedRules);
        }
    };

    const handleCloseRuleToggle = (ruleId: string, rule: unknown) => {
        const updatedCheckedRules = checkedCloseRules.includes(ruleId)
            ? checkedCloseRules.filter(id => id !== ruleId)
            : [...checkedCloseRules, ruleId];

        setCheckedCloseRules(updatedCheckedRules);

        // Mark parameter as intentionally unused
        void rule;

        const selectedStrategy = localStrategies.find(s => s.id === selectedStrategyId);
        if (selectedStrategy) {
            const appliedRules = selectedStrategy.closePositionRules.filter(r =>
                updatedCheckedRules.includes(r.id)
            );
            form.setValue("appliedCloseRules", appliedRules);
        }
    };

    const handleStrategyChange = (value: string) => {
        form.setValue("strategyName", value);
        const selectedStrategy = localStrategies.find(s => s.strategyName === value);
        const strategyId = selectedStrategy?.id || "";
        setSelectedStrategyId(strategyId);
        form.setValue("strategyId", strategyId || null);
        // Reset checked rules when strategy changes
        setCheckedOpenRules([]);
        setCheckedCloseRules([]);
        form.setValue("appliedOpenRules", []);
        form.setValue("appliedCloseRules", []);
    };

    // Submit handler
    const onSubmit = async (tradeData: z.infer<typeof newTradeFormSchema>) => {
        setSubmittingTrade(true);

        // Normalize close fields: if closeDate provided but closeTime missing, default to 12:30
        const hasCloseDate = Boolean(tradeData.closeDate && tradeData.closeDate.trim() !== "");
        const baseData = { ...tradeData };
        if (hasCloseDate && (!baseData.closeTime || baseData.closeTime.trim() === "")) {
            baseData.closeTime = "12:30";
        }

        // Require result if closeDate is provided
        if (hasCloseDate) {
            const res = baseData.result?.trim();
            if (!res) {
                toast.error("Please provide a result when setting a close date.");
                setSubmittingTrade(false);
                return;
            }
        }

        // Remaining quantity is the current remaining holding quantity on existingTrade
        const remainingQty = Number(existingTrade?.quantity || baseData.quantity) || 0;
        const currentSoldQty = Number(baseData.quantitySold) || 0;

        // Determine if this is a partial close
        const isPartialClose = editMode && existingTrade && hasCloseDate && currentSoldQty > 0 && currentSoldQty < remainingQty;

        try {
            let result;
            if (editMode && existingTrade) {
                if (hasCloseDate) {
                    // Unified adjust position path for closing/reducing
                    const adjustQty = isPartialClose ? -currentSoldQty : -remainingQty;
                    const adjustData = {
                        adjustQty: String(adjustQty),
                        adjustPrice: baseData.sellPrice || "0",
                        adjustDate: baseData.closeDate || "",
                        adjustTime: baseData.closeTime || "12:30",
                    };

                    const { notes, ...extraFields } = baseData;
                    void notes;
                    result = await adjustTradePosition(existingTrade.id, adjustData, extraFields as unknown as Partial<Trades>);

                    if (result?.error) {
                        toast.error("There was an error closing/adjusting your trade!");
                        setSubmittingTrade(false);
                        return;
                    }

                    if (result?.updatedTrade) {
                        // Calculate differences for Redux state updates
                        const oldResult = Number(existingTrade.result) || 0;
                        const newResult = Number(result.updatedTrade.result) || 0;
                        const resultDifference = newResult - oldResult;

                        // Only update statistics if trade has been closed
                        if (result.updatedTrade.closeDate) {
                            const [stringDay, month, year] = new Date(result.updatedTrade.closeDate)
                                .toLocaleDateString("en-GB")
                                .split("/");
                            const numericMonth = parseInt(month, 10);
                            const convertedMonthView = `${stringDay}-${month}-${year}`;
                            const convertedYearView = `${numericMonth}-${year}`;

                            if (resultDifference !== 0) {
                                dispatch(setMonthViewSummary({
                                    month: convertedMonthView,
                                    value: resultDifference,
                                }));
                                dispatch(setYearViewSummary({
                                    year: convertedYearView,
                                    value: resultDifference,
                                }));
                                dispatch(setTotalOfParticularYearSummary({
                                    year: year,
                                    value: resultDifference,
                                }));
                            }
                        }

                        // Preserving notes from DB
                        const tradeForRedux = {
                            ...result.updatedTrade,
                            notes: existingTrade.notes, // keep notes unchanged here
                        };

                        dispatch(updateTradeInList(tradeForRedux));
                        dispatch(updateTradeInFilteredList(tradeForRedux));
                    }

                    toast.success(isPartialClose ? `Partial close recorded! ${remainingQty - currentSoldQty} units remaining.` : "Trade closed successfully!");
                } else {
                    // Regular edit (no close date)
                    result = await updateTradeRecord(baseData, existingTrade.id);

                    if (result?.error) {
                        toast.error("There was an error updating your trade!");
                        setSubmittingTrade(false);
                        return;
                    }

                    const tradeForRedux = {
                        id: existingTrade.id,
                        ...baseData,
                        notes: existingTrade.notes,
                    };
                    dispatch(updateTradeInList(tradeForRedux));
                    dispatch(updateTradeInFilteredList(tradeForRedux));
                    toast.success("Trade updated successfully!");
                }

                // Refresh server data to sync across all pages
                router.refresh();
            } else {
                const customId = uuidv4();
                const updatedTradeData = {
                    ...baseData,
                    isActiveTrade: !baseData.closeDate || baseData.closeDate === ""
                };
                result = await createNewTradeRecord(updatedTradeData, customId);

                if (result?.error) {
                    toast.error("There was an error saving your trade!");
                    return;
                }

                // Only update statistics if trade has a closeDate (is closed)
                if (updatedTradeData.closeDate && updatedTradeData.closeDate !== "") {
                    const [stringDay, month, year] = new Date(updatedTradeData.closeDate)
                        .toLocaleDateString("en-GB")
                        .split("/");
                    const numericMonth = parseInt(month, 10);
                    const convertedMonthView = `${stringDay}-${month}-${year}`;
                    const convertedYearView = `${numericMonth}-${year}`;

                    // Guard against undefined results before dispatching
                    const resultValue = Number(updatedTradeData.result);
                    if (!isNaN(resultValue)) {
                        dispatch(setMonthViewSummary({
                            month: convertedMonthView,
                            value: resultValue,
                        }));
                        dispatch(setYearViewSummary({
                            year: convertedYearView,
                            value: resultValue,
                        }));
                        dispatch(setTotalOfParticularYearSummary({
                            year: year,
                            value: resultValue,
                        }));
                        dispatch(updateTradeDetailsForEachDay({
                            date: convertedMonthView,
                            result: resultValue,
                            value: 1,
                        }));
                    }
                }

                // Always update the trade list (for both open and closed trades)
                dispatch(updateListOfTrades({
                    id: customId,
                    ...updatedTradeData,
                }));

                // Refresh server data to sync across all pages
                router.refresh();

                toast.success("A new record has been created!");
            }

            // Close dialog: close calendar dialog via Redux, and optionally parent-controlled dialog via callback
            const dayKey = day !== undefined ? day.format("DD-MM-YYYY") : "any";
            dispatch(setIsDialogOpen({ key: dayKey, value: false }));
            if (onRequestClose) {
                onRequestClose();
            }
        } catch {
            toast.error("An unexpected error occurred!");
        } finally {
            setSubmittingTrade(false);
        }
    };

    const symbolName = form.watch("symbolName");

    // Debounced real-time validation of Yahoo Finance symbol availability
    useEffect(() => {
        if (!symbolName || symbolName.trim().length === 0) {
            setValidationState("idle");
            setValidationPrice(undefined);
            setBypassValidation(false);
            return;
        }

        setValidationState("validating");
        setValidationPrice(undefined);

        const debounceTimer = setTimeout(async () => {
            try {
                const res = await fetch(`/api/market-price?symbols=${encodeURIComponent(symbolName.trim())}`);
                if (!res.ok) {
                    setValidationState("invalid");
                    return;
                }
                const json = await res.json();
                const price = json[symbolName.trim()];
                if (price !== undefined && price !== null && Number(price) > 0) {
                    setValidationState("valid");
                    setValidationPrice(Number(price));
                } else {
                    setValidationState("invalid");
                }
            } catch {
                setValidationState("invalid");
            }
        }, 500);

        return () => clearTimeout(debounceTimer);
    }, [symbolName]);

    // Effects
    useEffect(() => {
        if (day && !editMode) {
            const convertedDate = day.toDate().toISOString();
            form.setValue("openDate", convertedDate);
            setOpenDate(day.toDate());
        }
        if (trades) {
            setSymbolLabels([
                ...new Set(
                    trades
                        .map(t => t.symbolName?.trim())
                        .filter((s): s is string => typeof s === "string" && s.trim() !== "")
                ),
            ])
        }
    }, [day, trades, editMode, form]);

    // Initialize edit mode data
    useEffect(() => {
        if (editMode && existingTrade) {
            // Set strategy ID and rules if trade has strategy
            if (existingTrade.strategyId) {
                setSelectedStrategyId(existingTrade.strategyId);
                // Set checked rules based on applied rules
                if (existingTrade.appliedOpenRules) {
                    setCheckedOpenRules(existingTrade.appliedOpenRules.map(rule => rule.id));
                }
                if (existingTrade.appliedCloseRules) {
                    setCheckedCloseRules(existingTrade.appliedCloseRules.map(rule => rule.id));
                }
            }

            // Set dates for date pickers
            if (existingTrade.openDate) {
                setOpenDate(new Date(existingTrade.openDate));
            }
            if (existingTrade.closeDate) {
                setCloseDate(new Date(existingTrade.closeDate));
            }
        }
    }, [editMode, existingTrade]);

    return {
        // Form
        form,
        onSubmit,
        submittingTrade,

        // Symbol Validation
        validationState,
        setValidationState,
        validationPrice,
        setValidationPrice,
        bypassValidation,
        setBypassValidation,

        // Dates
        openDate,
        setOpenDate,
        closeDate,
        setCloseDate,

        // Instruments
        symbolLabels,

        // Strategy
        selectedStrategyId,
        localStrategies,
        handleStrategyChange,

        // Rules
        checkedOpenRules,
        checkedCloseRules,
        handleOpenRuleToggle,
        handleCloseRuleToggle,

        // Form values
        rating: form.watch("rating"),

        // Mode
        editMode,
    };
};