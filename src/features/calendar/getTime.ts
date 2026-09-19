import dayjs from "dayjs";


export const getMonth = (month = dayjs().month(), year = dayjs().year()) => {
    const firstDayOfTheMonth = dayjs()
        .year(year)
        .month(month)
        .startOf("month")
        .day();

    const daysInMonth = dayjs().year(year).month(month).daysInMonth();

    const totalCells = firstDayOfTheMonth + daysInMonth;
    const totalRows = Math.ceil(totalCells / 7);
    let dayCounter = 1 - firstDayOfTheMonth;

    return Array.from({ length: totalRows }, () =>
        Array.from({ length: 7 }, () => {
            const date = dayjs(new Date(year, month, dayCounter++));
            return date;
        })
    );
};

export const getYear = (year = dayjs().year()) => {
    return Array.from({ length: 12 }, (_, month) => {
        const startOfMonth = dayjs(new Date(year, month, 1));
        const daysInMonth = startOfMonth.daysInMonth();

        const firstDayIndex = startOfMonth.day();
        const weeksToShow = 6;
        const totalCells = weeksToShow * 7;

        const daysArray = Array.from({ length: totalCells }, (_, i) => {
            const dayNumber = i - firstDayIndex + 1;
            return dayNumber > 0 && dayNumber <= daysInMonth
                ? dayjs(new Date(year, month, dayNumber))
                : null;
        });

        const calendar = [];
        for (let w = 0; w < weeksToShow; w++) {
            calendar.push(daysArray.slice(w * 7, w * 7 + 7));
        }
        while (
            calendar.length > 1 &&
            calendar[calendar.length - 1].every((d) => d === null)
        ) {
            calendar.pop();
        }

        return calendar;
    });
};
