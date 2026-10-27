import Image from "next/image";
import Link from "next/link";
import { StatsGridPageTwo } from "../StatsGridPageTwo";
import { fakeDataChartTwo } from "@/data/data";

const HomePageStart = () => {
    return (
        <>
            <div
                id="nav-trigger-section"
                className="flex flex-col items-center px-3 lg:px-48">
                <div className="mt-10 md:mt-20 flex max-w-3xl flex-wrap items-center justify-center gap-x-2.5 gap-y-1 rounded-full border border-zinc-200/90 bg-white/80 px-4 py-1.5 text-center text-xs font-mono text-zinc-600 shadow-xs backdrop-blur-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="font-semibold text-zinc-800">Local SQLite by default</span>
                    <span className="text-zinc-300">|</span>
                    <span>AI sends trading context to your configured endpoint only when you run a report</span>
                </div>
                <h1 className="main-text text-[3rem] md:text-[6rem] max-md:my-1">
                    VaultQuant
                </h1>
                <div className="mb-6 md:mb-10 flex flex-col items-center">
                    <h2 className="main-text text-[2rem] md:text-[3rem] flex items-center justify-center gap-2">
                        <span className="text-center text-[var(--customOrange)]">
                            Review the process behind the trade.
                        </span>
                    </h2>
                    <h2 className="main-text text-[1.5rem] md:text-[2rem] text-center max-w-2xl text-zinc-600 dark:text-zinc-400 font-normal">
                        A local-first trading journal and campaign review workspace.
                    </h2>
                </div>
                <Link
                    href="/"
                    className="inline-flex h-9 items-center justify-center rounded-md bg-zinc-900 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500">
                    Open workspace
                </Link>
            </div>
            <div className="flex-center py-12 px-12 2xl:px-48 max-md:hidden">
                <div className="w-full">
                    <p className="mb-3 text-center text-xs font-medium text-zinc-500">
                        Sample data · Illustrative account summary, not your account
                    </p>
                    <StatsGridPageTwo
                        start={"20000"}
                        end={"27560"}
                        oterData={fakeDataChartTwo}
                    />
                </div>
            </div>
            <div className="md:hidden py-10">
                <Image
                    src="/start-page-mobile-view.png"
                    width={400}
                    height={300}
                    alt="Sample VaultQuant account summary"
                    className="w-full"
                />
                <p className="mt-2 text-center text-xs text-zinc-500">
                    Sample data · Not your account
                </p>
            </div>
        </>
    );
};

export default HomePageStart;
