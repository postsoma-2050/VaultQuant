import { MoveUpRight, Cpu } from "lucide-react";
import Link from "next/link";

const HomePageAi = () => {
    return (
        <section aria-labelledby="landing-ai-title" className="max-md:hidden flex-center h-screen p-3">
            <div className="bg-white relative rounded-xl w-full flex flex-col items-center justify-between overflow-hidden h-full">
                <div className="h-[500px] w-full overflow-hidden">
                    <video
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="metadata"
                        aria-hidden="true"
                        className="h-full w-full object-cover object-bottom">
                        <source src="/ai-video.webm" type="video/webm" />
                        Your browser does not support the video tag.
                    </video>
                </div>

                <div className="absolute top-1/2 -translate-y-1/2 z-10 flex flex-col items-center gap-4">
                    <span className="rounded-full border border-zinc-200 bg-white/90 px-3 py-1 text-xs font-medium text-zinc-600 shadow-xs">
                        Sample product preview
                    </span>
                    <h2 id="landing-ai-title" className="text-[2rem] md:text-[3rem] text-center font-semibold">
                        AI-assisted trade review
                    </h2>
                    <p className="px-2 md:px-0 w-full md:w-1/2 text-[.9rem] md:text-[1rem] text-center text-zinc-600">
                        Generate a report from trading context when you choose to.
                        VaultQuant can help surface patterns in your process; it does not
                        predict outcomes or guarantee performance.
                    </p>
                    <p className="max-w-xl px-2 text-center text-xs leading-relaxed text-zinc-500">
                        AI reports send trading context to the endpoint you configure.
                        Your local SQLite records remain the source of truth.
                    </p>
                    <Link
                        href="/private/tradeAI"
                        className="w-full flex justify-center cursor-pointer mt-4 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500">
                        <div className="relative group inline-block">
                            <div className="flex items-center gap-2 mb-2 text-[#3D3929] font-medium">
                                Open reports <MoveUpRight className="w-[1rem]" />
                            </div>
                            <span className="absolute left-0 bottom-0 block h-[0.3px] w-0 bg-amber-500 transition-all duration-300 group-hover:w-full"></span>
                        </div>
                    </Link>
                    <div className="w-full flex gap-2 items-center justify-center pt-16 md:pt-20">
                        <Cpu className="w-5 h-5 text-amber-600" />
                        <p className="text-base md:text-lg text-zinc-700 font-medium">
                            Bring an OpenAI-compatible or Anthropic endpoint
                        </p>
                    </div>
                </div>
                <div className="h-[500px] w-full overflow-hidden rotate-180">
                    <video
                        autoPlay
                        loop
                        muted
                        playsInline
                        preload="metadata"
                        aria-hidden="true"
                        className="h-full w-full object-cover object-bottom">
                        <source src="/ai-video.webm" type="video/webm" />
                        Your browser does not support the video tag.
                    </video>
                </div>
            </div>
        </section>
    );
};

export default HomePageAi;
