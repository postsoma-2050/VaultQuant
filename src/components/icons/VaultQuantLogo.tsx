import React from "react";

export interface VaultQuantLogoProps extends React.SVGProps<SVGSVGElement> {
    /**
     * Sizing helper. Sets both width and height if width/height are not provided.
     * Defaults to 24 if neither size, width, nor height are provided.
     */
    size?: number | string;
    /**
     * Vector stroke weight for the outer shield. Defaults to 1.75 on the 24x24 viewBox.
     */
    strokeWidth?: number | string;
    /**
     * Candlestick body style.
     * - "solid" (default): Filled monochrome bodies for maximum clarity at small sizes.
     * - "outline": Outlined hollow candlestick bodies.
     */
    variant?: "solid" | "outline";
    /**
     * Optional badge styling (renders dark rounded background with white foreground).
     */
    badge?: boolean;
}

/**
 * VaultQuant "Candlestick Shield" (K线之盾) Brand Icon
 * 
 * Metaphor: Trading defense, risk management, and disciplined quantitative review.
 * Clean vector geometry: modern geometric shield enclosing 3 ascending candlesticks.
 */
export function VaultQuantLogo({
    size = 24,
    width,
    height,
    strokeWidth = 1.75,
    variant = "solid",
    badge = false,
    className = "",
    color = "currentColor",
    ...props
}: VaultQuantLogoProps) {
    const finalWidth = width ?? size;
    const finalHeight = height ?? size;
    const numStroke = typeof strokeWidth === "number" ? strokeWidth : parseFloat(String(strokeWidth)) || 1.75;
    const wickStrokeWidth = +(numStroke * 0.714).toFixed(2); // 1.25 when shield stroke is 1.75

    if (badge) {
        return (
            <svg
                width={finalWidth}
                height={finalHeight}
                viewBox="0 0 32 32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
                className={className}
                role="img"
                aria-label="VaultQuant Logo"
                {...props}
            >
                <rect width="32" height="32" rx="7" fill="#09090B" />
                <rect width="30" height="30" x="1" y="1" rx="6" stroke="#27272A" strokeWidth="1" />
                <g transform="translate(4, 4)">
                    {/* Outer Geometric Shield */}
                    <path
                        d="M12 2.5 L20 4.75 V11.25 C20 16.5 16.5 20.2 12 21.5 C7.5 20.2 4 16.5 4 11.25 V4.75 Z"
                        stroke="#FFFFFF"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Left Setup Candlestick */}
                    <path d="M8 11.5v5.5" stroke="#FFFFFF" strokeWidth={wickStrokeWidth} strokeLinecap="round" />
                    <rect
                        x="6.6"
                        y="12.5"
                        width="2.8"
                        height="3.5"
                        rx="0.5"
                        fill="#FFFFFF"
                        stroke={variant === "outline" ? "#FFFFFF" : "none"}
                        strokeWidth={variant === "outline" ? 1.1 : 0}
                    />

                    {/* Middle Breakout Candlestick */}
                    <path d="M12 8v8.5" stroke="#FFFFFF" strokeWidth={wickStrokeWidth} strokeLinecap="round" />
                    <rect
                        x="10.6"
                        y="9.5"
                        width="2.8"
                        height="5"
                        rx="0.5"
                        fill="#FFFFFF"
                        stroke={variant === "outline" ? "#FFFFFF" : "none"}
                        strokeWidth={variant === "outline" ? 1.1 : 0}
                    />

                    {/* Right Expansion Candlestick */}
                    <path d="M16 5.5v8.5" stroke="#FFFFFF" strokeWidth={wickStrokeWidth} strokeLinecap="round" />
                    <rect
                        x="14.6"
                        y="7"
                        width="2.8"
                        height="5"
                        rx="0.5"
                        fill="#FFFFFF"
                        stroke={variant === "outline" ? "#FFFFFF" : "none"}
                        strokeWidth={variant === "outline" ? 1.1 : 0}
                    />
                </g>
            </svg>
        );
    }

    return (
        <svg
            width={finalWidth}
            height={finalHeight}
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className={className}
            role="img"
            aria-label="VaultQuant Logo"
            {...props}
        >
            {/* Outer Geometric Shield */}
            <path
                d="M12 2.5 L20 4.75 V11.25 C20 16.5 16.5 20.2 12 21.5 C7.5 20.2 4 16.5 4 11.25 V4.75 Z"
                stroke={color}
                strokeWidth={strokeWidth}
                strokeLinecap="round"
                strokeLinejoin="round"
            />

            {/* Left Setup Candlestick */}
            <path d="M8 11.5v5.5" stroke={color} strokeWidth={wickStrokeWidth} strokeLinecap="round" />
            <rect
                x="6.6"
                y="12.5"
                width="2.8"
                height="3.5"
                rx="0.5"
                fill={variant === "solid" ? color : "none"}
                stroke={variant === "outline" ? color : "none"}
                strokeWidth={variant === "outline" ? 1.1 : 0}
            />

            {/* Middle Breakout Candlestick */}
            <path d="M12 8v8.5" stroke={color} strokeWidth={wickStrokeWidth} strokeLinecap="round" />
            <rect
                x="10.6"
                y="9.5"
                width="2.8"
                height="5"
                rx="0.5"
                fill={variant === "solid" ? color : "none"}
                stroke={variant === "outline" ? color : "none"}
                strokeWidth={variant === "outline" ? 1.1 : 0}
            />

            {/* Right Expansion Candlestick */}
            <path d="M16 5.5v8.5" stroke={color} strokeWidth={wickStrokeWidth} strokeLinecap="round" />
            <rect
                x="14.6"
                y="7"
                width="2.8"
                height="5"
                rx="0.5"
                fill={variant === "solid" ? color : "none"}
                stroke={variant === "outline" ? color : "none"}
                strokeWidth={variant === "outline" ? 1.1 : 0}
            />
        </svg>
    );
}

export default VaultQuantLogo;
