import { Trades } from "@/types";

export function helperFunctionSP500vsYourReturns(
    trades: Trades[],
    capital: string | undefined
): [number[], string[], number[]] {
    if (trades.length === 0 || capital === undefined) {
        return [[], [], []];
    }
    const initialCapital = parseFloat(capital) || 0;

    // Build a flat list of { closeDt, result } covering:
    //   1. Fully-closed trades  (trade.closeDate  + trade.result)
    //   2. Partially-closed open trades (each closeEvent.date + closeEvent.result)
    interface RealisedEvent {
        closeDt: Date;
        result: number;
    }

    /** Parse a YYYY-MM-DD or ISO string as a local-calendar date (no UTC shift). */
    function parseLocalDate(dateStr: string): Date {
        const datePart = dateStr.split("T")[0];
        const [y, m, d] = datePart.split("-").map(Number);
        return new Date(y, m - 1, d);
    }

    const realisedEvents: RealisedEvent[] = [];

    for (const trade of trades) {
        if (trade.closeEvents && trade.closeEvents.length > 0) {
            // Trade with adjustment/close events (each recorded on its actual date)
            for (const ev of trade.closeEvents) {
                const evResult = ev.result || 0;
                if (evResult === 0 || !ev.date) continue;
                realisedEvents.push({
                    closeDt: parseLocalDate(ev.date),
                    result: evResult,
                });
            }
        } else if (trade.closeDate && trade.closeDate !== "") {
            // Legacy fully-closed trade without closeEvents
            realisedEvents.push({
                closeDt: parseLocalDate(trade.closeDate),
                result: parseFloat(trade.result || "0") || 0,
            });
        }
    }

    if (realisedEvents.length === 0) {
        return [[], [], []];
    }

    const earliestCloseDate = realisedEvents.reduce(
        (earliest, ev) => (ev.closeDt < earliest ? ev.closeDt : earliest),
        realisedEvents[0].closeDt
    );

    const today = new Date();
    const totalRangeMs = today.getTime() - earliestCloseDate.getTime();

    const boundaries: Date[] = [];
    for (let i = 1; i <= 6; i++) {
        boundaries.push(
            new Date(earliestCloseDate.getTime() + (totalRangeMs * i) / 6)
        );
    }

    const capitalChanges: number[] = [];
    const dateLabels: string[] = [];
    const sp500Alternative: number[] = [];

    const totalMonths =
        (today.getFullYear() - earliestCloseDate.getFullYear()) * 12 +
        today.getMonth() -
        earliestCloseDate.getMonth();

    boundaries.forEach((boundaryDate, i) => {
        let cumulativePnL = 0;
        realisedEvents.forEach((ev) => {
            if (ev.closeDt <= boundaryDate) {
                cumulativePnL += ev.result;
            }
        });

        capitalChanges.push(initialCapital + cumulativePnL);

        if (totalMonths < 6) {
            dateLabels.push(i.toString());
        } else {
            dateLabels.push(
                boundaryDate.toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "2-digit",
                })
            );
        }

        const msDiff = boundaryDate.getTime() - earliestCloseDate.getTime();
        const yearsDiff = msDiff / (365.25 * 24 * 3600 * 1000);
        sp500Alternative.push(
            Math.floor(initialCapital * Math.pow(1 + 0.1, yearsDiff))
        );
    });

    return [capitalChanges, dateLabels, sp500Alternative];
}
