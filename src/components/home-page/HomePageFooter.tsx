import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { VaultQuantLogo } from "@/components/icons";

const productLinks = [
    { label: "Calendar", href: "/private/calendar" },
    { label: "History", href: "/private/history" },
    { label: "Strategies", href: "/private/strategies" },
    { label: "Statistics", href: "/private/statistics" },
    { label: "Daily Journal", href: "/private/journal" },
    { label: "Reports", href: "/private/tradeAI" },
];

const HomePageFooter = () => {
    return (
        <footer className="w-full py-12 px-4 md:px-8 lg:px-16 bg-white">
            <div className="max-w-7xl mx-auto space-y-16">
                {/* CTA Section */}
                <div className="w-full rounded-[2.5rem] bg-[#1a1a1a] text-white p-8 md:p-16 overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-zinc-800/50 via-transparent to-transparent" />
                    
                    <div className="relative z-10 flex flex-col items-center text-center space-y-8">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-zinc-700 bg-zinc-800/50 text-xs md:text-sm text-zinc-300 backdrop-blur-sm">
                            <span className="relative flex h-2 w-2">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                            </span>
                            Start with your own records
                        </div>

                        <h2 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight max-w-4xl">
                            Review the process behind <span className="text-zinc-400">every trade.</span>
                        </h2>
                        
                        <p className="text-zinc-400 text-lg md:text-xl max-w-2xl leading-relaxed">
                            Broker CSV previews, campaign VWAP clustering, and opt-in AI review.
                            Your records stay in the local workspace unless you run an AI report.
                        </p>

                        <div className="pt-4">
                            <Link
                                href="/"
                                className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-zinc-200 bg-white px-4 text-lg font-medium text-zinc-900 transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300">
                                Open workspace <ArrowRight className="w-4 h-4" />
                            </Link>
                        </div>
                    </div>
                </div>

                {/* Main Footer Content */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-24 pt-8">
                    {/* Brand Column */}
                    <div className="lg:col-span-5 space-y-8">
                        <Link
                            href="/landing"
                            className="flex w-fit items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500">
                            <VaultQuantLogo size={32} badge />
                            <span className="font-bold text-xl tracking-tight">VaultQuant</span>
                        </Link>
                        
                        <p className="text-zinc-500 leading-relaxed text-lg">
                            A local-first trading journal for reviewing broker imports,
                            campaign VWAPs, strategy discipline, and opt-in AI analysis.
                        </p>

                        <nav aria-label="Product" className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm text-zinc-600">
                            {productLinks.map((link) => (
                                <Link
                                    key={link.href}
                                    href={link.href}
                                    className="w-fit underline-offset-4 hover:text-zinc-900 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500">
                                    {link.label}
                                </Link>
                            ))}
                        </nav>

                        <div className="text-sm text-zinc-400 pt-2">
                            <p>© {new Date().getFullYear()} VaultQuant. All rights reserved.</p>
                        </div>
                    </div>

                    {/* FAQ Column */}
                    <div className="lg:col-span-7 space-y-6">
                        <h3 className="text-2xl font-semibold tracking-tight mb-6">Frequently Asked Questions</h3>
                        <Accordion type="single" collapsible className="w-full space-y-4">
                            <AccordionItem value="item-1" className="border border-zinc-200 rounded-xl px-6 data-[state=open]:bg-zinc-50 transition-colors border-b-0">
                                <AccordionTrigger className="hover:no-underline py-6 text-lg font-medium">
                                    What is VaultQuant?
                                </AccordionTrigger>
                                <AccordionContent className="text-zinc-500 text-base leading-relaxed pb-6">
                                    VaultQuant is a local-first trading journal. It previews and
                                    sanitizes broker CSV transactions, clusters scale-in orders into
                                    trade campaigns, calculates campaign VWAPs, and can generate
                                    AI-assisted reviews from trading context.
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="item-2" className="border border-zinc-200 rounded-xl px-6 data-[state=open]:bg-zinc-50 transition-colors border-b-0">
                                <AccordionTrigger className="hover:no-underline py-6 text-lg font-medium">
                                    What broker CSV formats are supported?
                                </AccordionTrigger>
                                <AccordionContent className="text-zinc-500 text-base leading-relaxed pb-6">
                                    The importer accepts CSV rows that expose a symbol, side or action,
                                    quantity, price, and timestamp. Because broker exports vary, use the
                                    preview to verify the sanitized campaigns before committing an import.
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="item-3" className="border border-zinc-200 rounded-xl px-6 data-[state=open]:bg-zinc-50 transition-colors border-b-0">
                                <AccordionTrigger className="hover:no-underline py-6 text-lg font-medium">
                                    How does Campaign VWAP Clustering work?
                                </AccordionTrigger>
                                <AccordionContent className="text-zinc-500 text-base leading-relaxed pb-6">
                                    Instead of treating every fill as a separate journal entry,
                                    VaultQuant groups scale-in transactions into a campaign and
                                    calculates the campaign VWAP from the imported fills. Sell events
                                    are matched to the campaign so realized results can be reviewed.
                                </AccordionContent>
                            </AccordionItem>

                            <AccordionItem value="item-4" className="border border-zinc-200 rounded-xl px-6 data-[state=open]:bg-zinc-50 transition-colors border-b-0">
                                <AccordionTrigger className="hover:no-underline py-6 text-lg font-medium">
                                    What happens to my data when I use AI?
                                </AccordionTrigger>
                                <AccordionContent className="text-zinc-500 text-base leading-relaxed pb-6">
                                    Your local SQLite records remain the source of truth. When you
                                    generate or follow up on an AI report, the trading context
                                    is sent to the AI endpoint configured in your environment. If that
                                    endpoint is remote, the provider receives that context. Normal
                                    journaling and local analytics do not make an AI request.
                                </AccordionContent>
                            </AccordionItem>
                        </Accordion>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default HomePageFooter;
