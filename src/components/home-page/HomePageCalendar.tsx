import Image from "next/image";

const HomePageCalendar = () => {
    return (
        <section aria-labelledby="landing-calendar-title" className="flex-center md:py-10 px-3 md:px-12 2xl:px-48">
            <div className="md:py-10 md:bg-primary rounded-xl w-full flex flex-col items-center justify-center background-class">
                <div className="flex flex-col items-center justify-center gap-4 pb-10">
                    <span className="border border-zinc-200 py-1 px-2 rounded-md text-[.7rem] md:text-[.9rem] shadow-md">
                        Sample calendar preview
                    </span>

                    <h2 id="landing-calendar-title" className="text-[2rem] md:text-[3rem] text-center font-semibold">
                        A calendar view of your trading record.
                    </h2>
                    <p className="max-w-2xl px-2 text-center text-[.9rem] md:text-[1rem]">
                        Browse trades by day and open the records behind each entry.
                        The screenshot uses illustrative data.
                    </p>
                </div>
                <div className="rounded-lg max-md:hidden">
                    <Image
                        src="/calendar.png"
                        alt="Sample VaultQuant calendar with illustrative trades"
                        width={1200}
                        height={900}
                    />
                </div>
                <div className="md:hidden">
                    <Image
                        src="/mobile-calendar.png"
                        width={400}
                        height={600}
                        alt="Sample VaultQuant calendar with illustrative trades"
                    />
                </div>
            </div>
        </section>
    );
};

export default HomePageCalendar;
