import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import ReduxProvider from "@/components/ReduxProvider";

const mainFont = localFont({
    src: "./fonts/main.woff2",
    variable: "--main",
    weight: "100 900",
});

export const metadata: Metadata = {
    title: "VaultQuant | AI Trading Journal & Quantitative Terminal",
    description: "Open-Source, Local-First AI Trading Journal & Quantitative Analytics Terminal",
    icons: {
        icon: [
            { url: "/icon.svg", type: "image/svg+xml" },
        ],
        apple: "/apple-icon",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={`${mainFont.className} antialiased`}>
                <ReduxProvider>
                    {children}
                </ReduxProvider>
            </body>
        </html>
    );
}
