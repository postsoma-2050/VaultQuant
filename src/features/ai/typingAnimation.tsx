const TypingTextAnimation = ({ items }: { items: string[] }) => {
    return (
        <div className="space-y-2">
            {items.map((item, index) => (
                <p
                    key={`${index}-${item.slice(0, 24)}`}
                    className="text-sm leading-relaxed text-zinc-700"
                >
                    {item}
                </p>
            ))}
        </div>
    );
};

export default TypingTextAnimation;
