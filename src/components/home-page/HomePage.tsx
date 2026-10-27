"use client";

import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { StatsGridPageTwo } from "@/components/StatsGridPageTwo";
import { ReactNode, useRef, useState } from "react";
import { StatsGridPageOne } from "@/components/StatsGridPageOne";
import HomePageStart from "./HomePageStart";
import HomePageReviews from "./HomePageReviews";
import HomePageCalendar from "./HomePageCalendar";
import HomePageFooter from "./HomePageFooter";
import { fakeDataChartTwo, otherData, tradingData } from "@/data/data";
import Link from "next/link";
import HomePageAi from "./HomePageAI";
import HomePageMobileAiPage from "./HomePageMobileAI";
import HomePageJournal from "./HomePageJournal";
import { VaultQuantLogo } from "@/components/icons";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export default function HomePage() {
    const sectionRef = useRef<HTMLDivElement | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);
    const buttonRef = useRef<HTMLButtonElement | null>(null);

    const [isSwitchChartsActive, setIsSwitchChartsActive] = useState(false);

    useGSAP(() => {
        if (!sectionRef.current || !contentRef.current) return;
        const section = sectionRef.current;
        const content = contentRef.current;

        const mm = gsap.matchMedia();

        mm.add("(min-width: 1280px) and (prefers-reduced-motion: no-preference)", () => {
            const travel = Math.max(0, content.scrollHeight - section.offsetHeight);

            gsap.to(content, {
                y: -travel,
                ease: "none",
                scrollTrigger: {
                    trigger: section,
                    start: "top bottom",
                    end: "bottom top",
                    scrub: true,
                    invalidateOnRefresh: true,
                },
            });

            content.querySelectorAll<HTMLElement>(".parallax-item").forEach((item) => {
                const speed = parseFloat(item.dataset.speed || "1") || 1;

                gsap.to(item, {
                    y: -(travel * (1 - speed)),
                    ease: "none",
                    scrollTrigger: {
                        trigger: section,
                        start: "top bottom",
                        end: "bottom top",
                        scrub: true,
                        invalidateOnRefresh: true,
                    },
                });
            });

            return () => gsap.set([content, ...content.querySelectorAll(".parallax-item")], {
                clearProps: "transform",
            });
        });

        return () => mm.revert();
    }, { scope: sectionRef });

    const handleSwitch = () => {
        if (buttonRef.current && !isSwitchChartsActive) {
            buttonRef.current.style.boxShadow =
                "0 0 0 1px #70451a3d, 0 1px 2px #70451a0d, 2px 3px 5px #70451a29, 4px 6px 5px #70451a14, 8px 12px 8px #70451a14,8px 0 0.5px #70451a33 inset, 20px 20px 25px 25px #70451a33 inset";
        } else if (buttonRef.current && isSwitchChartsActive) {
            buttonRef.current.style.boxShadow =
                "0 0 0 1px #70451a3d, 0 1px 2px #70451a0d, 2px 3px 5px #70451a29, 4px 6px 5px #70451a14, 8px 12px 8px #70451a14,8px 0 0.5px #70451a33 inset, 10px 0 4px -6px #70451a33 inset";
        }
        setIsSwitchChartsActive((prev) => !prev);
    };

    return (
        <div className="background-class">
            <header className="flex-center py-2 w-full sticky top-0 md:top-2 px-3 lg:px-48 z-[999]">
                <nav
                    id="navbar"
                    className="flex items-center justify-between text-sm p-3 w-full rounded-2xl bg-white max-md:shadow-md">
                    <Link
                        href="/landing"
                        aria-label="VaultQuant landing page"
                        className="flex gap-3 items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500">
                        <VaultQuantLogo size={40} badge />
                        <p id="logo-text" className="text-[1rem] font-bold tracking-tight">
                            VaultQuant
                        </p>
                    </Link>
                    <div className="hidden md:flex justify-center md:mr-[35px]">
                        <div id="nav-buttons" className="flex gap-2 lg:gap-4">
                            <Link href="/private/calendar">
                                <div className="nav-link">Calendar</div>
                            </Link>
                            <Link href="/private/statistics">
                                <div className="nav-link">Statistics</div>
                            </Link>
                            <Link href="/private/tradeAI">
                                <div className="nav-link">Reports</div>
                            </Link>
                        </div>
                    </div>
                    <Link
                        href="/"
                        className="inline-flex h-9 shrink-0 items-center justify-center rounded-md border border-zinc-200 bg-white px-3 text-sm font-medium transition-colors hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500">
                        Open workspace
                    </Link>
                </nav>
            </header>
            <HomePageStart />
            <div
                ref={sectionRef}
                className="hidden xl:block h-screen gradient relative overflow-hidden">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary flex flex-col items-center justify-center gap-4">
                    <span className="border border-zinc-700 py-1 px-2 rounded-md text-[.9rem] shadow-md shadow-zinc-900">
                        Sample chart preview
                    </span>
                    <h2 className="text-[1rem] sm:text-[2rem] 2xl:text-[3rem] text-center font-semibold">
                        Review the process behind the trade.
                    </h2>
                    <p className="text-[1rem] text-zinc-300 max-w-xl text-center">
                        Preview broker CSV sanitization, campaign VWAPs, and opt-in AI review with illustrative data.
                    </p>
                </div>
                <div
                    ref={contentRef}
                    className="flex flex-col items-center justify-center gap-4 absolute w-full h-[1700px]">
                    {/* top | right */}

                    <ParallaxScrollCard position="top-[150px] right-[8%]">
                        <Image
                            src="/scroll-parallax-1.png"
                            width={340}
                            height={375}
                            alt="Sample VaultQuant chart preview"
                            className="shadow-md"
                        />
                    </ParallaxScrollCard>
                    {/* Background | top | right */}

                    <BackgroundParallaxScrollCard position="top-[350px] right-[4%]">
                        <Image
                            src="/scroll-parallax-4.png"
                            width={340}
                            height={375}
                            alt=""
                        />
                    </BackgroundParallaxScrollCard>
                    {/* top | left */}

                    <ParallaxScrollCard position="top-[200px] left-[8%]">
                        <Image
                            src="/scroll-parallax-2.png"
                            width={340}
                            height={375}
                            alt="Sample VaultQuant calendar preview"
                            className="shadow-md"
                        />
                    </ParallaxScrollCard>
                    {/* Background | top | left */}

                    <BackgroundParallaxScrollCard position="top-[450px] left-[8%]">
                        <Image
                            src="/scroll-parallax-1.png"
                            width={340}
                            height={375}
                            alt=""
                        />
                    </BackgroundParallaxScrollCard>
                    {/* center | right */}

                    <ParallaxScrollCard position="top-[650px] left-[70%]">
                        <Image
                            src="/scroll-parallax-3.png"
                            width={340}
                            height={375}
                            alt="Sample VaultQuant report preview"
                            className="shadow-md"
                        />
                    </ParallaxScrollCard>
                    {/* Backgound | bottom | right */}
                    <BackgroundParallaxScrollCard position="top-[900px] right-[6%]">
                        <Image
                            src="/scroll-parallax-2.png"
                            width={340}
                            height={375}
                            alt=""
                        />
                    </BackgroundParallaxScrollCard>
                    {/* center | left */}
                    <ParallaxScrollCard position="top-[700px] left-[13%]">
                        <Image
                            src="/scroll-parallax-4.png"
                            width={340}
                            height={375}
                            alt="Sample VaultQuant strategy preview"
                            className="shadow-md"
                        />
                    </ParallaxScrollCard>
                    {/* Backgound | bottom | left */}
                    <BackgroundParallaxScrollCard position="top-[900px] left-[5%]">
                        <Image
                            src="/scroll-parallax-5.png"
                            width={340}
                            height={375}
                            alt=""
                        />
                    </BackgroundParallaxScrollCard>
                    {/* bottom | right */}
                    <ParallaxScrollCard position="top-[1150px] right-[7%]">
                        <Image
                            src="/scroll-parallax-5.png"
                            width={340}
                            height={375}
                            alt="Sample VaultQuant statistics preview"
                            className="shadow-md"
                        />
                    </ParallaxScrollCard>
                    {/* bottom | left */}
                    <ParallaxScrollCard position="top-[1200px] left-[10%]">
                        <Image
                            src="/scroll-parallax-6.png"
                            width={340}
                            height={375}
                            alt="Sample VaultQuant journal preview"
                            className="shadow-md"
                        />
                    </ParallaxScrollCard>
                    {/* Margin bottom */}
                    <div className="absolute top-[1600px] h-[100px] w-1"></div>
                </div>
            </div>

            <div className="flex-center py-8 px-3 md:px-12 2xl:px-48">
                <div className="py-10 md:bg-primary rounded-xl w-full flex flex-col items-center justify-center background-class">
                    <div className="flex flex-col items-center justify-center gap-4 pb-4">
                        <span className="border border-zinc-200 py-1 px-2 rounded-md text-[.7rem] md:text-[.9rem] shadow-md">
                            Sample account summary
                        </span>
                        <h2 className="text-[2rem] md:text-[3rem] text-center font-semibold">
                            Your trading record, <br /> organized for review.
                        </h2>
                        <p className="max-w-2xl px-2 text-center text-[.9rem] md:text-[1rem]">
                            Explore how account details and trade summaries are organized.
                            Values in this preview are illustrative, not your account.
                        </p>
                        <div className="flex-center gap-4">
                            <p>Details</p>

                            <button
                                type="button"
                                ref={buttonRef}
                                onClick={handleSwitch}
                                aria-label={isSwitchChartsActive ? "Show details view" : "Show summary view"}
                                aria-pressed={isSwitchChartsActive}
                                className={`${
                                    isSwitchChartsActive
                                        ? "switch-button active"
                                        : "switch-button"
                                } border-0 p-0`}
                            />
                            <p>Summary</p>
                        </div>

                    </div>
                    <p className="mb-3 text-center text-xs font-medium text-zinc-500">
                        Sample data · Not your account
                    </p>
                    <div className="max-md:hidden w-full" aria-live="polite">
                        {isSwitchChartsActive ? (
                            <StatsGridPageTwo
                                start={"20000"}
                                end={"27680"}
                                oterData={fakeDataChartTwo}
                            />
                        ) : (
                            <StatsGridPageOne
                                tradingData={tradingData}
                                otherData={otherData}
                            />
                        )}
                    </div>
                    <div className="md:hidden w-full mt-4 flex justify-center">
                        {isSwitchChartsActive ? (
                            <Image
                                src="/statistics-page-one-mobile.png"
                                width={400}
                                height={300}
                                alt="Sample VaultQuant summary chart"
                            />
                        ) : (
                            <Image
                                src="/statistics-page-two-mobile.png"
                                width={400}
                                height={300}
                                alt="Sample VaultQuant details chart"
                            />
                        )}
                    </div>
                </div>
            </div>
            <HomePageAi />
            <HomePageMobileAiPage />
            <HomePageCalendar />
            <HomePageJournal />
            <HomePageReviews />
            <HomePageFooter />
        </div>
    );
}

const ParallaxScrollCard = ({
    position,
    children,
}: {
    position: string;

    children: ReactNode;
}) => {
    return (
        <div
            className={`w-[340px] h-[390px] bg-secondary p-3 absolute ${position} z-20 rounded-lg overflow-hidden flex-center`}>
            {children}
        </div>
    );
};

const BackgroundParallaxScrollCard = ({
    position,
    dataSpeed = "1.5",
    children,
}: {
    position: string;
    dataSpeed?: string;
    children: ReactNode;
}) => {
    return (
        <div
            data-speed={dataSpeed}
            className={`parallax-item w-[290px] h-[340px] bg-secondary p-3 absolute ${position} rounded-lg overflow-hidden flex-center opacity-40`}>
            {children}
        </div>
    );
};
