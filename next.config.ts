import type { NextConfig } from "next";

const nextConfig: NextConfig = {
    output: "standalone",
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
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
