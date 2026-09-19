import { TradeDisplayItem } from "@/features/calendar/getClosedTradesForDay";
import { Trades } from "@/types";

interface TradeListProps {
    trades?: Trades[];
    displayItems?: TradeDisplayItem[];
    title: string;
    type: "open" | "closed" | "all";
}

export const TradeList = ({ trades, displayItems, title, type }: TradeListProps) => {
    // Convert trades to display items if displayItems not provided
    const items: TradeDisplayItem[] = displayItems || (trades || []).map((t) => ({
        id: t.id,
        tradeId: t.id,
        symbolName: t.symbolName,
        positionType: t.positionType,
        eventType: type === "open" ? "open" : "close",
        quantity: t.quantity,
        entryPrice: t.entryPrice,
        price: t.sellPrice || t.entryPrice,
        result: Number(t.result) || 0,
        time: t.openTime,
        isPartialClose: false,
        originalTrade: t,
    }));

    if (items.length === 0) return null;

    return (
        <div className="border border-zinc-200 rounded-lg overflow-hidden bg-white shadow-2xs">
            {/* Header */}
            <div className="flex items-center justify-between px-3.5 py-2 bg-zinc-50 border-b border-zinc-200">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-600">
                    {title}
                </h4>
                <span className="text-[11px] font-mono font-medium text-zinc-500 bg-zinc-200/70 px-2 py-0.2 rounded-full">
                    {items.length}
                </span>
            </div>
            
            {/* Body */}
            <div className="divide-y divide-zinc-100 max-h-[220px] overflow-y-auto">
                {items.map((item) => {
                    const isBuy = item.positionType === "buy";
                    const isScaleIn = item.eventType === "add" || item.eventType === "open";
                    const isReduce = item.eventType === "reduce";
                    const isClose = item.eventType === "close";

                    return (
                        <div
                            key={item.id}
                            className="flex items-center justify-between px-3.5 py-2 hover:bg-zinc-50/80 transition-colors"
                        >
                            <div className="flex items-center gap-2 min-w-0">
                                <span
                                    className={`shrink-0 text-[10px] w-4 h-4 rounded font-mono font-bold flex items-center justify-center ${
                                        isBuy ? "bg-emerald-100 text-emerald-800 border border-emerald-300" : "bg-rose-100 text-rose-800 border border-rose-300"
                                    }`}
                                >
                                    {isBuy ? "L" : "S"}
                                </span>
                                <div className="flex flex-col min-w-0">
                                    <div className="flex items-center gap-1.5">
                                        <span className="font-bold text-xs text-zinc-800 truncate">
                                            {item.symbolName}
                                        </span>
                                        {item.eventType === "open" && (
                                            <span className="shrink-0 text-[9px] px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 font-semibold uppercase">
                                                Open
                                            </span>
                                        )}
                                        {item.eventType === "add" && (
                                            <span className="shrink-0 text-[9px] px-1.5 py-0.2 rounded bg-emerald-100 text-emerald-800 font-semibold uppercase">
                                                Add
                                            </span>
                                        )}
                                        {isReduce && (
                                            <span className="shrink-0 text-[9px] px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 font-semibold uppercase">
                                                Reduce
                                            </span>
                                        )}
                                        {isClose && (
                                            <span className="shrink-0 text-[9px] px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 font-semibold uppercase">
                                                Close
                                            </span>
                                        )}
                                    </div>
                                    {item.time && (
                                        <span className="text-[10px] text-zinc-400 font-mono">
                                            {item.time}
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
                                {/* Quantity */}
                                <div className="text-right">
                                    <span className="text-[10px] text-zinc-400 block font-sans">Qty</span>
                                    <p className="font-semibold text-zinc-700 text-xs">
                                        {isScaleIn ? "+" : "-"}{Number(item.quantity ?? 0).toLocaleString()}
                                    </p>
                                </div>

                                {/* Price / Result */}
                                <div className="text-right min-w-[55px]">
                                    <span className="text-[10px] text-zinc-400 block font-sans">
                                        {item.result !== undefined ? "P/L" : "Price"}
                                    </span>
                                    {item.result !== undefined ? (
                                        <p className={`font-bold text-xs ${item.result >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                                            {item.result >= 0 ? "+" : ""}${Number(item.result).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                    ) : (
                                        <p className="font-medium text-zinc-700 text-xs">
                                            ${Number(item.price ?? item.entryPrice ?? 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
