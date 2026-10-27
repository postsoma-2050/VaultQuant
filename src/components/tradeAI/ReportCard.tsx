import TypingAnimation from "@/features/ai/typingAnimation";
import { dialogWindowType } from "@/types/tradeAI.types";
import { ReactNode } from "react";
import CustomLoading from "../CustomLoading";

export const ReportCard = ({
    items,
    loading,
}: {
    items: dialogWindowType[];
    loading: boolean;
}) => {
    return (
        <div className="relative mx-auto w-full max-w-3xl">
            <AutoScrollDiv>
                {items.map((item, index) => {
                    if (item.type === "user") {
                        return (
                            <div key={index} className="mb-6 flex justify-end">
                                <div className="flex max-w-full flex-col md:max-w-[75%]">
                                    <div className="flex items-end gap-2 rounded-xl bg-zinc-100 px-4 py-2.5">
                                        {item.content.map((text, i) => (
                                            <p
                                                key={i}
                                                className="text-sm text-zinc-700">
                                                {text}
                                            </p>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        );
                    }
                    return (
                        <div key={index} className="mb-6">
                            <TypingAnimation items={item.content} />
                        </div>
                    );
                })}
                {loading && <CustomLoading />}
            </AutoScrollDiv>
        </div>
    );
};

interface AutoScrollDivProps {
    children: ReactNode;
}

const AutoScrollDiv: React.FC<AutoScrollDivProps> = ({
    children,
}) => {
    return <div className="pb-6">{children}</div>;
};
