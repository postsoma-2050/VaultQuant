import { Trades, sortTradesFunctionType } from "@/types";

type DateRangeLike = {
    from?: Date;
    to?: Date;
};

export function parseCalendarDate(value?: string): Date | null {
    if (!value) return null;

    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value.trim());
    if (!match) {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    return new Date(
        Number(match[1]),
        Number(match[2]) - 1,
        Number(match[3])
    );
}

function startOfLocalDay(value: Date): Date {
    const result = new Date(value);
    result.setHours(0, 0, 0, 0);
    return result;
}

function endOfLocalDay(value: Date): Date {
    const result = new Date(value);
    result.setHours(23, 59, 59, 999);
    return result;
}

export function filterTradesBySymbolsAndDate({
    trades,
    selectedSymbols,
    dateRange,
}: {
    trades: Trades[];
    selectedSymbols: string[] | null;
    dateRange?: DateRangeLike | null;
}): Trades[] {
    const selected = selectedSymbols === null
        ? null
        : new Set(selectedSymbols.map((symbol) => symbol.trim()));

    const hasCompleteRange = Boolean(dateRange?.from && dateRange?.to);
    const from = hasCompleteRange ? startOfLocalDay(dateRange!.from!) : null;
    const to = hasCompleteRange ? endOfLocalDay(dateRange!.to!) : null;

    return trades.filter((trade) => {
        const symbol = trade.symbolName?.trim();
        if (selected !== null && (!symbol || !selected.has(symbol))) {
            return false;
        }

        if (!from || !to) return true;

        const tradeDate = parseCalendarDate(trade.closeDate || trade.openDate);
        if (!tradeDate) return false;

        return tradeDate >= from && tradeDate <= to;
    });
}

function timeStringToMinutes(time: string): number {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
}

function getTradeDateForTimeframe(trade: Trades): Date | null {
    return parseCalendarDate(trade.closeDate || trade.openDate);
}

export const sortTrades = ({
    sortBy = "closeDate",
    timeframe = "allHistory",
    tradesToSort,
}: sortTradesFunctionType): Trades[] => {
    const now = new Date();
    let filtered: Trades[] = tradesToSort;

    if (timeframe !== "allHistory") {
        const today = startOfLocalDay(now);
        const endOfToday = endOfLocalDay(now);
        const weekStart = new Date(today);
        weekStart.setDate(weekStart.getDate() - 6);
        const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

        filtered = tradesToSort.filter((trade) => {
            const tradeDate = getTradeDateForTimeframe(trade);
            if (!tradeDate) return false;
            switch (timeframe) {
                case "today": {
                    return tradeDate >= today && tradeDate <= endOfToday;
                }

                case "thisWeek": {
                    return tradeDate >= weekStart && tradeDate <= endOfToday;
                }

                case "thisMonth": {
                    return tradeDate >= monthStart && tradeDate <= endOfToday;
                }
            }
        });
    }
    const sortedTrades = [...filtered].sort((a, b) => {
        switch (sortBy) {
            case "symbolName":
            case "positionType":
                return (a[sortBy] || "").localeCompare(b[sortBy] || "");

            case "openDate":
            case "closeDate": {
                // First compare the date
                const aDate = sortBy === "openDate" ? a.openDate : a.closeDate;
                const bDate = sortBy === "openDate" ? b.openDate : b.closeDate;

                // Skip if date is missing
                if (!aDate || !bDate) return 0;

                const compareDates =
                    (parseCalendarDate(bDate)?.getTime() ?? 0) -
                    (parseCalendarDate(aDate)?.getTime() ?? 0);

                // If they differ, return the date comparison
                if (compareDates !== 0) {
                    return compareDates;
                }

                // Otherwise, compare by time
                const aTime = sortBy === "openDate" ? a.openTime : a.closeTime;
                const bTime = sortBy === "openDate" ? b.openTime : b.closeTime;

                // Skip if time is missing
                if (!aTime || !bTime) return 0;

                return (
                    timeStringToMinutes(bTime) -
                    timeStringToMinutes(aTime)
                );
            }
            case "result":
                return Number(b[sortBy]) - Number(a[sortBy]);

            default:
                return 0;
        }
    });

    return sortedTrades;
};
