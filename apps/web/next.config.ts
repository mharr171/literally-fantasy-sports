import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  // The engine packages are TypeScript source in the monorepo.
  transpilePackages: ["@lfs/core", "@lfs/sport-soccer"],
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
