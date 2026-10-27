import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "standalone",
    // Keep verification builds separate from the running desktop dev server.
    distDir: process.env.VAULTQUANT_BUILD_DIR || ".next",
    env: {
        NEXT_PUBLIC_AI_MODEL: process.env.AI_MODEL || process.env.NEXT_PUBLIC_AI_MODEL || "",
    },
    experimental: {
        optimizePackageImports: [
            "@mui/material",
            "@mui/x-charts",
            "lucide-react",
        ],
    },
};

export default nextConfig;
