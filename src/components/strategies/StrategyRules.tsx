import {
    Table,
    TableHeader,
    TableRow,
    TableHead,
    TableBody,
    TableCell,
} from "@/components/ui/table";
import { Strategy } from "@/types/strategies.types";
import { Rule } from "@/types/dbSchema.types";

interface StrategyRulesProps {
    strategy: Strategy;
    checkedOpenRules?: string[];
    checkedCloseRules?: string[];
}

const priorityLabel: Record<Rule["priority"], string> = {
    high: "High",
    medium: "Medium",
    low: "Low",
};

const priorityTone: Record<Rule["priority"], string> = {
    high: "text-rose-700",
    medium: "text-amber-700",
    low: "text-emerald-700",
};

function RuleTable({
    title,
    rules,
    checkedRules,
}: {
    title: string;
    rules: Rule[];
    checkedRules?: string[];
}) {
    const hasChecklist = checkedRules !== undefined;

    return (
        <section className="min-w-0 flex-1" aria-labelledby={`${title}-heading`}>
            <div className="flex items-baseline justify-between gap-3 py-3">
                <h3 id={`${title}-heading`} className="text-[13px] font-medium text-zinc-700">
                    {title}
                </h3>
                <span className="text-xs text-zinc-500">{rules.length}</span>
            </div>
            {rules.length > 0 ? (
                <Table>
                    <TableHeader>
                        <TableRow className="hover:bg-transparent">
                            {hasChecklist && <TableHead className="w-10" aria-label="Followed" />}
                            <TableHead>Rule</TableHead>
                                    <TableHead className="w-24 text-right pr-3">Priority</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {rules.map((rule) => {
                            const isChecked = checkedRules?.includes(rule.id);
                            return (
                                <TableRow key={rule.id}>
                                    {hasChecklist && (
                                        <TableCell>
                                            <span
                                                aria-label={isChecked ? "Rule followed" : "Rule not followed"}
                                                className={`inline-block h-2 w-2 rounded-full ${
                                                    isChecked ? "bg-emerald-500" : "bg-zinc-300"
                                                }`}
                                            />
                                        </TableCell>
                                    )}
                                    <TableCell className="text-[13px] text-zinc-700 whitespace-normal break-words">
                                        {rule.rule}
                                    </TableCell>
                                    <TableCell className={`text-right pr-3 text-[13px] font-medium ${priorityTone[rule.priority]}`}>
                                        {priorityLabel[rule.priority]}
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            ) : (
                <p className="rounded-md border border-dashed border-zinc-200 px-3 py-5 text-center text-xs text-zinc-500">
                    No rules defined
                </p>
            )}
        </section>
    );
}

export default function StrategyRules({
    strategy,
    checkedOpenRules,
    checkedCloseRules,
}: StrategyRulesProps) {
    return (
        <div className="grid w-full min-w-0 gap-x-6 lg:grid-cols-2">
            <RuleTable
                title="Entry rules"
                rules={strategy.openPositionRules}
                checkedRules={checkedOpenRules}
            />
            <RuleTable
                title="Exit rules"
                rules={strategy.closePositionRules}
                checkedRules={checkedCloseRules}
            />
        </div>
    );
}
