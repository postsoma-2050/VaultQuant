import { Quote } from "lucide-react";
import React from "react";

export default function HomePageMobileAiPage() {
    return (
        <section aria-labelledby="landing-mobile-ai-title" className="md:hidden flex flex-col items-center justify-center py-8">
            <span className="border border-zinc-200 py-1 px-2 rounded-md text-[.7rem] md:text-[.9rem] shadow-md">
                AI review
            </span>
            <h2 id="landing-mobile-ai-title" className="text-[2rem] text-center mt-6 font-semibold">
                AI-assisted trade review
            </h2>
            <p className="px-4 md:px-2 text-[.9rem] mt-4 text-center text-zinc-500">
                Generate a report from trading context when you choose to.
                AI can help surface patterns in your process; it does not predict outcomes.
            </p>
            <p className="px-6 mt-2 text-xs text-center text-zinc-500">
                The trading context is sent to the AI endpoint you configure.
            </p>
            <div className="mt-8 flex gap-6 items-center px-4">
                <Quote size={42} className="shrink-0 text-amber-500" />
                <h3 className="text-xl font-bold text-zinc-800">
                    REVIEW YOUR PROCESS IN 3 STEPS
                </h3>
            </div>
            <ul className="w-full px-8 mt-8 flex flex-col gap-4">
                <li>
                    <h3 className="mb-1 font-semibold text-zinc-900">
                        <span className="text-amber-500 mr-4 font-mono">01.</span>Import Broker CSV or Log Trades.
                    </h3>
                    <p className="text-zinc-500 ml-[2.2rem] text-xs">
                        Preview a broker CSV or log trades directly in the calendar.
                    </p>
                </li>
                <li>
                    <h3 className="mb-1 font-semibold text-zinc-900">
                        <span className="text-amber-500 mr-4 font-mono">02.</span>Select AI Model & Get Report.
                    </h3>
                    <p className="text-zinc-500 ml-[2.2rem] text-xs">
                        Use the OpenAI-compatible or Anthropic endpoint configured in your environment.
                    </p>
                </li>
                <li>
                    <h3 className="mb-1 font-semibold text-zinc-900">
                        <span className="text-amber-500 mr-4 font-mono">03.</span>Follow Up & Audit Execution.
                    </h3>
                    <p className="text-zinc-500 ml-[2.2rem] text-xs">
                        Review strategy discipline and ask follow-up questions in the report.
                    </p>
                </li>
            </ul>
            <p className="mt-6 px-6 text-center text-xs text-zinc-500">
                Illustrative workflow · AI output is not a performance guarantee.
            </p>
        </section>
    );
}
