"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import dayjs from "dayjs";

import { Trades } from "@/types";
import { DialogClose, DialogTitle, DialogHeader, DialogDescription } from "../ui/dialog";
import { CustomButton } from "../CustomButton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";

import { useTradeForm } from "./hooks/useTradeForm";
import { OpenDetailsTab } from "./OpenDetailsTab";
import { CloseDetailsTab } from "./CloseDetailsTab";
import { StrategyTab } from "./StrategyTab";
import { TradeNotesTab } from "./TradeNotesTab";
import { AdjustPositionTab } from "./AdjustPositionTab";
import { getCustomFieldNames } from "@/server/actions/user";
import { useAppSelector } from "@/redux/store";

interface TradeDialogProps {
    editMode?: boolean;
    existingTrade?: Trades;
    day?: dayjs.Dayjs | undefined;
    onRequestClose?: () => void;
    initialTab?: "open-details" | "close-details" | "strategy" | "notes" | "adjust-position";
    prefilledQtyChange?: number;
    initialAdjustMode?: "add" | "reduce" | "close";
}

export const TradeDialog = ({
    editMode = false,
    existingTrade,
    day,
    onRequestClose,
    initialTab = "open-details",
    prefilledQtyChange,
    initialAdjustMode,
}: TradeDialogProps) => {
    const [activeTab, setActiveTab] = useState(initialTab);
    const [adjustTargetTrade, setAdjustTargetTrade] = useState<Trades | null>(existingTrade || null);
    const [adjustMode, setAdjustMode] = useState<"add" | "reduce" | "close">(initialAdjustMode || (prefilledQtyChange && prefilledQtyChange < 0 ? "reduce" : "add"));
    const [isFromNewTradeFlow, setIsFromNewTradeFlow] = useState(false);

    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab);
        }
    }, [initialTab]);

    useEffect(() => {
        if (initialAdjustMode) {
            setAdjustMode(initialAdjustMode);
        }
    }, [initialAdjustMode]);

    useEffect(() => {
        if (existingTrade) {
            setAdjustTargetTrade(existingTrade);
        }
    }, [existingTrade]);

    const tradeForm = useTradeForm({
        editMode,
        existingTrade,
        day,
        onRequestClose,
    });

    // State for custom field names
    const [openFieldNames, setOpenFieldNames] = useState<string[]>([]);
    const [closeFieldNames, setCloseFieldNames] = useState<string[]>([]);

    // Fetch custom field names on mount
    const fetchFieldNames = useCallback(async () => {
        const result = await getCustomFieldNames();
        if (!("error" in result)) {
            setOpenFieldNames(result.openFields);
            setCloseFieldNames(result.closeFields);
        }
    }, []);

    useEffect(() => {
        fetchFieldNames();
    }, [fetchFieldNames]);

    const handleSelectExistingPosition = (targetTrade: Trades, selectedMode: "add" | "reduce" | "close") => {
        setAdjustTargetTrade(targetTrade);
        setAdjustMode(selectedMode);
        setIsFromNewTradeFlow(true);
        setActiveTab("adjust-position");
    };

    const tradesInStore = useAppSelector((state) => state.tradeRecords.listOfTrades);
    const formSymbol = (tradeForm.form.watch("symbolName") || "").trim().toUpperCase();
    const formPositionType = (tradeForm.form.watch("positionType") || "").toLowerCase();

    const hasMatchingActiveTrade = useMemo(() => {
        if (editMode || !formSymbol || !formPositionType || !tradesInStore) return false;
        return tradesInStore.some((t) => {
            const isActive = t.isActiveTrade !== false && (!t.closeDate || t.closeDate === "");
            return isActive &&
                   (t.symbolName || "").trim().toUpperCase() === formSymbol &&
                   (t.positionType || "").toLowerCase() === formPositionType;
        });
    }, [editMode, formSymbol, formPositionType, tradesInStore]);

    if (activeTab === "adjust-position" && (adjustTargetTrade || existingTrade)) {
        const tradeToAdjust = adjustTargetTrade || existingTrade!;
        return (
            <div className="sm:max-w-[460px] flex flex-col flex-1 h-full overflow-hidden">
                <AdjustPositionTab
                    existingTrade={tradeToAdjust}
                    onRequestClose={onRequestClose}
                    prefilledQtyChange={prefilledQtyChange}
                    initialAdjustMode={adjustMode}
                    onBackToNewTrade={isFromNewTradeFlow ? () => {
                        setActiveTab("open-details");
                        setIsFromNewTradeFlow(false);
                    } : undefined}
                />
            </div>
        );
    }

    return (
        <form
            onSubmit={tradeForm.form.handleSubmit(tradeForm.onSubmit, (errors) => {
                console.log("Form validation errors:", errors);
            })}
            className="sm:max-w-[460px] flex flex-col flex-1 h-full overflow-hidden">

            <DialogHeader className="mb-4 shrink-0">
                <DialogTitle className="text-center text-[1.4rem]">
                    {editMode ? "Edit Trade" : "Add a New Trade"}
                </DialogTitle>
                <DialogDescription className="text-center text-[.85rem] text-tertiary">
                    Fill in the details below. Open trades appear on the calendar in blue.
                </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue={initialTab} onValueChange={(val) => setActiveTab(val as "open-details" | "close-details" | "strategy" | "notes" | "adjust-position")} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                <TabsList className={`grid w-full mb-4 shrink-0 ${editMode ? "grid-cols-4" : "grid-cols-3"}`}>
                    <TabsTrigger value="open-details">Open</TabsTrigger>
                    <TabsTrigger value="close-details">Close</TabsTrigger>
                    <TabsTrigger value="strategy">Strategy</TabsTrigger>
                    {editMode && <TabsTrigger value="notes">Notes</TabsTrigger>}
                </TabsList>

                {/* Scrollable content area */}
                <div className="flex-1 overflow-y-auto min-h-0 pr-1">
                    <TabsContent value="open-details" className="mt-0 data-[state=inactive]:hidden">
                        <OpenDetailsTab
                            form={tradeForm.form}
                            openDate={tradeForm.openDate}
                            setOpenDate={tradeForm.setOpenDate}
                            symbolLabels={tradeForm.symbolLabels}
                            day={day}
                            userFieldNames={openFieldNames}
                            onFieldNamesChange={fetchFieldNames}
                            editMode={editMode}
                            existingTrade={existingTrade}
                            validationState={tradeForm.validationState}
                            validationPrice={tradeForm.validationPrice}
                            setValidationState={tradeForm.setValidationState}
                            setValidationPrice={tradeForm.setValidationPrice}
                            bypassValidation={tradeForm.bypassValidation}
                            setBypassValidation={tradeForm.setBypassValidation}
                            onSelectExistingPosition={handleSelectExistingPosition}
                        />
                    </TabsContent>

                    <TabsContent value="close-details" className="mt-0 data-[state=inactive]:hidden">
                        <CloseDetailsTab
                            form={tradeForm.form}
                            openDate={tradeForm.openDate}
                            closeDate={tradeForm.closeDate}
                            setCloseDate={tradeForm.setCloseDate}
                            userFieldNames={closeFieldNames}
                            onFieldNamesChange={fetchFieldNames}
                            closeEvents={existingTrade?.closeEvents || []}
                        />
                    </TabsContent>

                    <TabsContent value="strategy" className="mt-0 data-[state=inactive]:hidden">
                        <StrategyTab
                            form={tradeForm.form}
                            strategies={tradeForm.localStrategies}
                            selectedStrategyId={tradeForm.selectedStrategyId}
                            checkedOpenRules={tradeForm.checkedOpenRules}
                            checkedCloseRules={tradeForm.checkedCloseRules}
                            onStrategyChange={tradeForm.handleStrategyChange}
                            onOpenRuleToggle={tradeForm.handleOpenRuleToggle}
                            onCloseRuleToggle={tradeForm.handleCloseRuleToggle}
                        />
                    </TabsContent>

                    {editMode && existingTrade && (
                        <TabsContent value="notes" className="mt-0 data-[state=inactive]:hidden">
                            <TradeNotesTab 
                                existingTrade={existingTrade} 
                                onNotesChange={(newNotesJson) => tradeForm.form.setValue("notes", newNotesJson)}
                            />
                        </TabsContent>
                    )}
                </div>
            </Tabs>

            {/* Fixed footer with buttons - outside Tabs to stick to bottom */}
            <div className="shrink-0 pt-4 mt-auto border-t border-zinc-200 bg-white">
                <div className="flex gap-4 justify-end">
                    {activeTab === "notes" ? (
                        <DialogClose asChild>
                            <CustomButton isBlack={true} onClick={onRequestClose}>Close</CustomButton>
                        </DialogClose>
                    ) : (
                        <>
                            <DialogClose asChild>
                                <CustomButton isBlack={false}>Cancel</CustomButton>
                            </DialogClose>
                            <div
                                title={
                                    !editMode && hasMatchingActiveTrade
                                        ? "An open position already exists. Use Add to Pos / Reduce Pos / Close Pos to adjust it."
                                        : !editMode && tradeForm.validationState === "invalid" && !tradeForm.bypassValidation
                                        ? "Symbol has no market data. Price tracking will be unavailable."
                                        : undefined
                                }
                            >
                                <CustomButton
                                    isBlack
                                    type="submit"
                                    disabled={
                                        tradeForm.submittingTrade ||
                                        tradeForm.validationState === "validating" ||
                                        (!editMode && tradeForm.validationState === "invalid" && !tradeForm.bypassValidation) ||
                                        (!editMode && hasMatchingActiveTrade)
                                    }
                                >
                                    {editMode ? "Update Trade" : "Add Trade"}
                                </CustomButton>
                            </div>
                        </>
                    )}
                </div>
            </div>
        </form>
    );
};