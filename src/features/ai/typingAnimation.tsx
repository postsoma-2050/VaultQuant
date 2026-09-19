import React, { useEffect, useState } from "react";

const TypingTextAnimation = ({
    items,
    typingSpeed = 25,
    delay = 500,
}: {
    items: string[];
    typingSpeed?: number;
    delay?: number;
}) => {
    const [displayedItems, setDisplayedItems] = useState<string[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [typedText, setTypedText] = useState("");
    const [charIndex, setCharIndex] = useState(0);

    useEffect(() => {
        if (currentIndex < items.length) {
            const currentItem = items[currentIndex];

            if (charIndex < currentItem.length) {
                const typingTimeout = setTimeout(() => {
                    setTypedText(
                        (prev) => prev + currentItem.charAt(charIndex)
                    );
                    setCharIndex((prev) => prev + 1);
                }, typingSpeed);

                return () => clearTimeout(typingTimeout);
            } else {
                const displayTimeout = setTimeout(() => {
                    setDisplayedItems((prev) => [...prev, currentItem]);
                    setTypedText("");
                    setCharIndex(0);
                    setCurrentIndex((prev) => prev + 1);
                }, delay);

                return () => clearTimeout(displayTimeout);
            }
        }
    }, [charIndex, currentIndex, items, delay, typingSpeed]);

    return (
        <div className="flex flex-col gap-2">
            <ul className="py-2">
                {displayedItems.map((item, i) => (
                    <li
                        key={i}
                        className="p-2 hover:bg-zinc-500/15 rounded-md cursor-pointer">
                        <h1 className="text-zinc-600">&bull; {item}</h1>
                    </li>
                ))}
                {currentIndex < items.length && (
                    <li className="py-2 bg-zinc-500/15 rounded-md flex justify-between">
                        <h1 className="text-zinc-400">{typedText}</h1>
                    </li>
                )}
            </ul>
        </div>
    );
};

export default TypingTextAnimation;
