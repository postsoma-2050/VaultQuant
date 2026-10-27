import { ButtonHTMLAttributes, DetailedHTMLProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

type CustomButtonType = {
    isBlack: boolean;
    children: ReactNode;
} & DetailedHTMLProps<
    ButtonHTMLAttributes<HTMLButtonElement>,
    HTMLButtonElement
>;

export function CustomButton({
    isBlack,
    children,
    className,
    ...props
}: CustomButtonType) {
    return (
        <button
            {...props}
            aria-disabled={props.disabled}
            className={cn(`inline-flex items-center justify-center gap-2 shrink-0 px-3 py-2 rounded-md h-9 text-sm font-medium ${
                isBlack
                    ? "bg-zinc-900 text-white hover:bg-zinc-800"
                    : "bg-white border border-zinc-200 md:hover:text-zinc-900 md:hover:bg-zinc-100"
            } ${
                props.disabled ? "opacity-50 cursor-not-allowed" : ""
            }`, className)}>
            {children}
        </button>
    );
}
