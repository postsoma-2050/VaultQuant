"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { DateRange } from "react-day-picker";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";

interface DatePickerWithRangeProps
    extends React.HTMLAttributes<HTMLDivElement> {
    setDateRangeForFiltering: React.Dispatch<
        React.SetStateAction<DateRange | null>
    >;
    dateRange: DateRange | null;
}

export function DatePickerWithRange({
    className,
    setDateRangeForFiltering,
    dateRange,
}: DatePickerWithRangeProps) {
    const formatDate = (value: Date) =>
        new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "2-digit",
            year: "numeric",
        }).format(value);

    const [date, setDate] = React.useState<DateRange | undefined>(
        dateRange || { from: undefined, to: undefined }
    );

    React.useEffect(() => {
        setDate(dateRange || { from: undefined, to: undefined });
    }, [dateRange]);

    return (
        <div className={cn("grid gap-2", className)}>
            <Popover>
                <PopoverTrigger asChild>
                    <Button
                        type="button"
                        id="date"
                        aria-label="Filter by date range"
                        variant={"outline"}
                        className={cn(
                            "w-[206px] h-8 px-2.5 text-[13px] bg-white border-zinc-200 text-zinc-800 hover:bg-zinc-50 font-medium shadow-xs justify-start text-left focus-visible:ring-zinc-400",
                            !date && "text-zinc-500"
                        )}>
                        <CalendarIcon className="w-4 h-4 mr-1.5 text-zinc-400" />
                        {date?.from ? (
                            date.to ? (
                                <>
                                    {formatDate(date.from)} -{" "}
                                    {formatDate(date.to)}
                                </>
                            ) : (
                                formatDate(date.from)
                            )
                        ) : (
                            <span>Date range</span>
                        )}
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                        initialFocus
                        mode="range"
                        defaultMonth={date?.from}
                        selected={date}
                        onSelect={(newRange) => {
                            setDate(newRange);
                            setDateRangeForFiltering(newRange ?? null);
                        }}
                        numberOfMonths={1}
                    />
                </PopoverContent>
            </Popover>
        </div>
    );
}
