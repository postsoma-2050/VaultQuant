import AddCapitalDialog from "./AddCapitalDialog";
import { Pencil } from "lucide-react";

interface OdometerConditionalRenderingProps {
    startingCapital: number;
    currentEquity: number;
    netRealizedPnL: number;
    unrealizedPnL: number;
    openPositionExposure: number;
    exposureMultiple: number;
    hasCapital: boolean;
}

const currency = (value: number, signed = false) => Number.isFinite(value)
    ? new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", signDisplay: signed ? "exceptZero" : "auto" }).format(value)
    : "Unavailable";

export default function OdometerConditionalRendering({
    startingCapital, currentEquity, netRealizedPnL, unrealizedPnL,
    openPositionExposure, exposureMultiple, hasCapital,
}: OdometerConditionalRenderingProps) {
    if (!hasCapital) return <div className="py-4"><AddCapitalDialog /></div>;

    const metrics = [
        { label: "Starting capital", value: currency(startingCapital), detail: "Initial account capital", editable: true },
        { label: "Current equity", value: currency(currentEquity), detail: "Includes open-position P&L" },
        { label: "Realized P&L", value: currency(netRealizedPnL, true), detail: "Closed trades and partial exits", pnl: netRealizedPnL },
        { label: "Unrealized P&L", value: currency(unrealizedPnL, true), detail: "Priced open positions", pnl: unrealizedPnL },
        { label: "Open exposure", value: currency(openPositionExposure), detail: "Gross value of open positions" },
        { label: "Exposure / equity", value: currentEquity > 0 && Number.isFinite(exposureMultiple) ? `${exposureMultiple.toFixed(2)}×` : "Unavailable", detail: "Gross exposure divided by equity" },
    ];

    return <dl className="grid w-full min-w-0 grid-cols-2 min-[1000px]:grid-cols-3 2xl:grid-cols-6 border-l border-t border-zinc-200 bg-white">
        {metrics.map((metric) => <div key={metric.label} className="min-w-0 border-b border-r border-zinc-200 px-4 py-3">
            <dt className="flex items-center justify-between gap-2 text-xs text-zinc-600">
                {metric.label}
                {metric.editable && <AddCapitalDialog trigger={<button type="button" aria-label="Edit starting capital" title="Edit starting capital" className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-zinc-600 hover:bg-zinc-100"><Pencil size={13} /></button>} />}
            </dt>
            <dd className={`mt-2 overflow-x-auto whitespace-nowrap pb-1 font-mono text-xl font-medium tabular-nums ${metric.pnl != null && metric.pnl < 0 ? "text-rose-700" : metric.pnl != null && metric.pnl > 0 ? "text-emerald-700" : "text-zinc-900"}`}>{metric.value}</dd>
            <dd className="mt-1 text-xs leading-5 text-zinc-600">{metric.detail}</dd>
        </div>)}
    </dl>;
}
