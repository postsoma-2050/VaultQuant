import { getYear } from "@/features/calendar/getTime";
import { setCalendarType, setMonthView } from "@/redux/slices/calendarSlice";
import { useAppDispatch, useAppSelector } from "@/redux/store";
import dayjs from "dayjs";
import { FaArrowTrendDown, FaArrowTrendUp } from "react-icons/fa6";

export default function YearView() {
    const currentYear =
        useAppSelector((state) => state.calendar.yearView) ?? dayjs().year();
    const yearTradeSummary = useAppSelector(
        (state) => state.tradeRecords.yearViewSummary
    );
    const dispatch = useAppDispatch();
    const yearData = getYear(currentYear);

    const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const handlePickMonth = ({ i }: { i: number }) => {
        dispatch(setCalendarType("Month"));
        dispatch(setMonthView({ month: i, year: currentYear }));
    };

    return (
        <div className="grid h-full min-h-[620px] grid-cols-1 gap-3 p-4 md:grid-cols-3 xl:grid-cols-4 xl:grid-rows-3">
            {yearData.map((month, i) => {
                const monthName = dayjs(new Date(currentYear, i, 1)).format(
                    "MMM"
                );
                const rawSum = yearTradeSummary[`${i + 1}-${currentYear}`];
                const currentMonthSum = rawSum ?? 0;
                const isMonthSummaryAvailable = rawSum !== undefined && rawSum !== 0;

                return (
                    <button
                        type="button"
                        key={i}
                        onClick={() => handlePickMonth({ i })}
                        aria-label={`Open ${monthName} ${currentYear}${isMonthSummaryAvailable ? `, realized P&L ${currentMonthSum >= 0 ? "positive" : "negative"} ${Math.abs(currentMonthSum).toFixed(2)} dollars` : ""}`}
                        className={`flex min-h-[160px] w-full min-w-0 flex-col gap-2 rounded-xl p-3.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500 focus-visible:ring-offset-2 ${
                            isMonthSummaryAvailable
                                ? currentMonthSum >= 0
                                    ? "border border-emerald-200/80 bg-emerald-50/70 hover:bg-emerald-100/80"
                                    : "border border-rose-200/80 bg-rose-50/70 hover:bg-rose-100/80"
                                : "border border-zinc-200/80 bg-white hover:border-zinc-300 hover:bg-zinc-50"
                        } shadow-2xs`}>
                        <div className="mb-2 flex min-w-0 items-center justify-between gap-2 px-1">
                            <div
                                className={`flex min-w-0 items-center gap-2 font-mono tabular-nums ${
                                    isMonthSummaryAvailable
                                        ? currentMonthSum >= 0
                                            ? "text-emerald-700 font-bold"
                                            : "text-rose-700 font-bold"
                                        : "text-slate-400 font-medium"
                                }`}>
                                {isMonthSummaryAvailable && (
                                    currentMonthSum >= 0 ? (
                                        <FaArrowTrendUp />
                                    ) : (
                                        <FaArrowTrendDown />
                                    )
                                )}
                                <p className="truncate font-mono text-sm font-bold tabular-nums tracking-tight">
                                    {isMonthSummaryAvailable
                                        ? (currentMonthSum >= 0 ? "+$" : "-$") + Math.abs(currentMonthSum).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                                        : "$0.00"}
                                </p>
                            </div>
                            <div className="shrink-0 font-semibold text-zinc-800">
                                {monthName} {currentYear}
                            </div>
                        </div>

                        <div className="mb-1 grid grid-cols-7 border-b border-zinc-300 pb-1 text-center text-[10px] font-medium text-zinc-500">
                            {weekdayLabels.map((dow) => (
                                <div key={dow}>{dow}</div>
                            ))}
                        </div>
                        <div
                            className="grid"
                            style={{
                                gridTemplateColumns: "repeat(7, 1fr)",
                            }}>
                            {month.flatMap((week) =>
                                week.map((day, dayIndex) => {
                                    const isToday =
                                        day &&
                                        day.format("DD-MM-YYYY") ===
                                            dayjs().format("DD-MM-YYYY");
                                    return (
                                        <div
                                            key={`${day?.format("YYYY-MM-DD") ?? "empty"}-${dayIndex}`}
                                            className={`flex items-center justify-center p-0.5 font-mono text-[11px] tabular-nums ${
                                                isToday
                                                    ? "mx-auto h-6 w-6 place-self-center rounded-full bg-amber-500 font-bold text-white shadow-xs"
                                                    : "text-zinc-700"
                                            }`}>
                                            {day ? day.date() : ""}
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
