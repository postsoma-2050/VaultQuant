import { Database, FileSearch, ShieldCheck } from "lucide-react";

const workflow = [
    {
        icon: Database,
        title: "Local records",
        description: "Trades, strategies, journals, and saved reports live in the local SQLite workspace.",
    },
    {
        icon: FileSearch,
        title: "Preview imports",
        description: "Inspect sanitized campaigns before committing broker CSV rows to your database.",
    },
    {
        icon: ShieldCheck,
        title: "Explicit AI boundary",
        description: "An AI report sends trading context to your configured endpoint only when you run it.",
    },
];

export default function HomePageReviews() {
    return (
        <section aria-labelledby="landing-workflow-title" className="flex-center max-md:pb-10 md:py-10 px-3 lg:px-48">
            <div className="py-10 rounded-xl w-full flex flex-col items-center justify-center">
                <div className="flex flex-col items-center justify-center gap-4 pb-10">
                    <span className="border border-zinc-200 py-1 px-2 rounded-md text-[.7rem] md:text-[.9rem] shadow-md">
                        Local-first workflow
                    </span>

                    <h2 id="landing-workflow-title" className="text-[2rem] md:text-[3rem] text-center font-semibold">
                        Built for inspection, not hype.
                    </h2>
                    <p className="max-w-2xl px-2 text-center text-[.9rem] md:text-[1rem] text-zinc-600">
                        Understand where your records live, what an import changes,
                        and when trade context leaves your machine.
                    </p>
                </div>
                <div className="grid w-full max-w-6xl grid-cols-1 gap-4 md:grid-cols-3">
                    {workflow.map(({ icon: Icon, title, description }) => (
                        <div key={title} className="rounded-xl border border-zinc-200 bg-white p-6 shadow-xs">
                            <Icon className="mb-5 h-5 w-5 text-amber-600" aria-hidden="true" />
                            <h3 className="mb-2 text-lg font-semibold text-zinc-900">{title}</h3>
                            <p className="text-sm leading-relaxed text-zinc-600">{description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
