import type { NextConfig } from "next";

const isGithubActions = process.env.GITHUB_ACTIONS === "true";

const isProduction = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  ...(isProduction ? { output: "export" as const } : {}),
  basePath: isGithubActions ? "/nktt-expert-eval" : "",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
};

export default nextConfig;
