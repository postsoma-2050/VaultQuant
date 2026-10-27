import { useAppDispatch } from "@/redux/store";
import { deleteTradeRecord } from "@/server/actions/trades";
import {
    removeRecordFromListOfTrades,
    setMonthViewSummary,
    setYearViewSummary,
    setTotalOfParticularYearSummary,
    updateTradeDetailsForEachDay,
} from "@/redux/slices/tradeRecordsSlice";
import { removeTradeFromFilteredList } from "@/redux/slices/historyPageSlice";
import { toast } from "sonner";
import { parseCalendarDate } from "@/features/history/sortTrades";

export const useDeleteTrade = () => {
    const dispatch = useAppDispatch();

    const handleDeleteTradeRecord = async (
        tradeId: string,
        result?: string,
        closeDate?: string
    ): Promise<boolean> => {
        try {
            const deleteResult = await deleteTradeRecord(tradeId);
            if (deleteResult?.error) {
                toast.error("Failed to delete record. Please try again.");
                return false;
            }

            dispatch(removeRecordFromListOfTrades(tradeId));
            dispatch(removeTradeFromFilteredList(tradeId));

            if (closeDate && result !== undefined && result !== null && result !== "") {
                try {
                    const parsedDate = parseCalendarDate(closeDate);
                    if (parsedDate) {
                        const [stringDay, month, year] = parsedDate
                            .toLocaleDateString("en-GB")
                            .split("/");
                        const numericMonth = parseInt(month, 10);
                        const convertedMonthView = `${stringDay}-${month}-${year}`;
                        const convertedYearView = `${numericMonth}-${year}`;

                        dispatch(
                            setMonthViewSummary({
                                month: convertedMonthView,
                                value: -Number(result),
                            })
                        );
                        dispatch(
                            setYearViewSummary({
                                year: convertedYearView,
                                value: -Number(result),
                            })
                        );
                        dispatch(
                            setTotalOfParticularYearSummary({
                                year: year,
                                value: -Number(result),
                            })
                        );
                        dispatch(
                            updateTradeDetailsForEachDay({
                                date: convertedMonthView,
                                result: Number(result),
                                value: -1,
                            })
                        );
                    }
                } catch (err) {
                    console.error("Summary update warning:", err);
                }
            }

            toast.success("Trade record deleted successfully!");
            return true;
        } catch (error) {
            console.error(error);
            toast.error("Failed to delete record. Please try again.");
            return false;
        }
    };

    return { handleDeleteTradeRecord };
};
