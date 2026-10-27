"use client";

import { ReactNode, useEffect, useState } from "react";
import {
    MdOutlineKeyboardArrowRight,
    MdOutlineKeyboardArrowLeft,
} from "react-icons/md";

import { CustomButton } from "@/components/CustomButton";

import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { useAppDispatch, useAppSelector } from "@/redux/store";
import {
    setCalendarType,
    setIsDialogOpen,
    setMonthView,
    setYearView,
} from "@/redux/slices/calendarSlice";
import dayjs from "dayjs";
import { months } from "@/data/data";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { TradeDialog } from "@/components/trade-dialog";

export default function CalendarLayout({ children }: { children: ReactNode }) {
    const [isDataLoaded, setIsDataLoaded] = useState(false);

    const { month, year } = useAppSelector((state) => state.calendar.monthView);
    const yearView = useAppSelector((state) => state.calendar.yearView);
    const calendarView = useAppSelector((state) => state.calendar.calendarType);
    const isDialogOpen = useAppSelector((state) => state.calendar.isDialogOpen);

    const currentMonth = dayjs().month();
    const currentYear = dayjs().year();

    const monthTradeSummaryForMonthView = useAppSelector(
        (state) => state.tradeRecords.yearViewSummary
    );

    const monthViewTotal =
        monthTradeSummaryForMonthView[`${(month ?? currentMonth) + 1}-${year}`];

    const yearTradeSummaryForYearView = useAppSelector(
        (state) => state.tradeRecords.totalOfParticularYearSummary
    );

    useEffect(() => {
        if (
            monthTradeSummaryForMonthView !== undefined &&
            yearTradeSummaryForYearView !== undefined
        ) {
            setIsDataLoaded(true);
        }
    }, [monthTradeSummaryForMonthView, yearTradeSummaryForYearView]);

    const yearViewTotal = yearTradeSummaryForYearView[yearView ?? currentYear];

    const dispatch = useAppDispatch();

    const handleNextMonth = () => {
        if (month === undefined || year === undefined) {
            if (currentMonth === 11) {
                dispatch(setMonthView({ month: 0, year: currentYear + 1 }));
            } else {
                dispatch(
                    setMonthView({ month: currentMonth + 1, year: currentYear })
                );
            }
        } else {
            if (month === 11) {
                dispatch(setMonthView({ month: 0, year: year + 1 }));
            } else {
                dispatch(setMonthView({ month: month + 1, year: year }));
            }
        }
    };

    const handlePrevMonth = () => {
        if (month === undefined || year === undefined) {
            if (currentMonth === 0) {
                dispatch(setMonthView({ month: 11, year: currentYear - 1 }));
            } else {
                dispatch(
                    setMonthView({ month: currentMonth - 1, year: currentYear })
                );
            }
        } else {
            if (month === 0) {
                dispatch(setMonthView({ month: 11, year: year - 1 }));
            } else {
                dispatch(setMonthView({ month: month - 1, year: year }));
            }
        }
    };

    const handleNextYear = () => {
        if (yearView === undefined) {
            dispatch(setYearView(currentYear + 1));
        } else {
            dispatch(setYearView(yearView + 1));
        }
    };

    const handlePrevYear = () => {
        if (yearView === undefined) {
            dispatch(setYearView(currentYear - 1));
        } else {
            dispatch(setYearView(yearView - 1));
        }
    };

    const handleReturnToToday = () => {
        dispatch(setMonthView({ month: currentMonth, year: currentYear }));
        dispatch(setYearView(currentYear));
    };

    if (!isDataLoaded) {
        return (
            <div className="flex h-full min-h-[360px] items-center justify-center">
                <div className="running-algorithm">
                    <span className="dot"></span>
                    <span className="dot"></span>
                    <span className="dot"></span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 flex-col">
            <div
                className={`flex flex-wrap items-center justify-between gap-3 border-b border-zinc-200 px-3 py-3 md:px-6 ${calendarView === "Month" ? "max-md:flex-col" : ""}`}>
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 md:gap-5">
                    <div
                        className={`flex min-w-0 flex-wrap items-center gap-2.5 ${calendarView === "Year" ? "max-md:hidden" : ""
                            }`}>
                        <Sheet
                            open={!!isDialogOpen["any"]}
                            onOpenChange={(open) =>
                                dispatch(
                                    setIsDialogOpen({
                                        key: "any",
                                        value: open,
                                    })
                                )
                            }>
                            <SheetTrigger asChild>
                                <CustomButton isBlack>New</CustomButton>
                            </SheetTrigger>
                            <SheetContent>
                                <TradeDialog day={undefined} />
                            </SheetContent>
                        </Sheet>
                        <CustomButton
                            onClick={handleReturnToToday}
                            isBlack={false}>
                            Today
                        </CustomButton>

                        <CustomButton
                            isBlack={false}
                            onClick={
                                calendarView === "Month"
                                    ? handlePrevMonth
                                    : handlePrevYear
                            }
                            aria-label={calendarView === "Month" ? "Previous month" : "Previous year"}>
                            <MdOutlineKeyboardArrowLeft className="text-[1.3rem]" />
                        </CustomButton>
                        <CustomButton
                            isBlack={false}
                            onClick={
                                calendarView === "Month"
                                    ? handleNextMonth
                                    : handleNextYear
                            }
                            aria-label={calendarView === "Month" ? "Next month" : "Next year"}>
                            <MdOutlineKeyboardArrowRight className="text-[1.3rem]" />
                        </CustomButton>
                    </div>
                    <div>
                        {calendarView === "Month" ? (
                            <p className="text-center md:text-start">{`${months[month ?? currentMonth]
                                } ${year ?? currentYear}`}</p>
                        ) : (
                            <p>{yearView ?? currentYear}</p>
                        )}
                    </div>
                </div>
                <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 md:gap-5">
                    <div className="rounded-md border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-xs font-medium text-zinc-600">
                        {calendarView === "Month" ? (
                            <p>
                                Realized P&amp;L:{" "}
                                {monthViewTotal !== undefined
                                    ? `${monthViewTotal >= 0 ? "+" : ""}${Number(monthViewTotal).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                    : "0.00"}
                            </p>
                        ) : (
                            <p>
                                Realized P&amp;L:{" "}
                                {yearViewTotal !== undefined
                                    ? `${yearViewTotal >= 0 ? "+" : ""}${Number(yearViewTotal).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                                    : "0.00"}
                            </p>
                        )}
                    </div>
                    <Select
                        value={calendarView}
                        onValueChange={(value) => {
                            dispatch(setCalendarType(value));
                            dispatch(
                                setMonthView({
                                    month: currentMonth,
                                    year: currentYear,
                                })
                            );
                            dispatch(setYearView(currentYear));
                        }}>
                        <SelectTrigger className="w-[100px]">
                            <SelectValue placeholder="Month" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectItem value="Year">Year</SelectItem>
                                <SelectItem value="Month">Month</SelectItem>
                                {/* <SelectItem value="Day">Day</SelectItem> */}
                            </SelectGroup>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            <section className="min-h-0 flex-1 overflow-auto">
                {children}
            </section>
        </div>
    );
}
