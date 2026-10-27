import { ImageResponse } from "next/og";

export const runtime = "edge";

export const size = {
    width: 180,
    height: 180,
};
export const contentType = "image/png";

export default function AppleIcon() {
    return new ImageResponse(
        (
            <div
                style={{
                    width: "100%",
                    height: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "#09090b",
                    borderRadius: "40px",
                }}
            >
                <svg
                    width="120"
                    height="120"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#ffffff"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                >
                    {/* Outer Geometric Shield */}
                    <path d="M12 2.5 L20 4.75 V11.25 C20 16.5 16.5 20.2 12 21.5 C7.5 20.2 4 16.5 4 11.25 V4.75 Z" />
                    {/* Left Setup Candlestick */}
                    <path d="M8 11.5v5.5" strokeWidth="1.25" />
                    <rect x="6.6" y="12.5" width="2.8" height="3.5" rx="0.5" fill="#ffffff" stroke="none" />
                    {/* Middle Breakout Candlestick */}
                    <path d="M12 8v8.5" strokeWidth="1.25" />
                    <rect x="10.6" y="9.5" width="2.8" height="5" rx="0.5" fill="#ffffff" stroke="none" />
                    {/* Right Expansion Candlestick */}
                    <path d="M16 5.5v8.5" strokeWidth="1.25" />
                    <rect x="14.6" y="7" width="2.8" height="5" rx="0.5" fill="#ffffff" stroke="none" />
                </svg>
            </div>
        ),
        {
            ...size,
        }
    );
}
