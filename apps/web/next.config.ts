import { readFileSync } from "node:fs";
import path from "node:path";
import type { NextConfig } from "next";

/** The released game version (release-please keeps it in the root package.json). */
function gameVersion(): string {
  try {
    const root = path.join(process.cwd(), "..", "..", "package.json");
    return (JSON.parse(readFileSync(root, "utf8")) as { version: string })
      .version;
  } catch {
    return "unknown";
  }
}

const nextConfig: NextConfig = {
  env: { GAME_VERSION: gameVersion() },
  cacheComponents: true,
  // The engine packages are TypeScript source in the monorepo.
  transpilePackages: ["@lfs/core", "@lfs/game", "@lfs/sport-soccer"],
  partialPrefetching: true,
  // Soccer's pages moved under /soccer (D191, ADR 0007 §10): every old link
  // and bookmark goes to its new address, query string included.
  redirects() {
    return ["team", "season", "leaderboard", "hall-of-fame", "guide"].map(
      (page) => ({
        source: `/${page}/:path*`,
        destination: `/soccer/${page}/:path*`,
        permanent: true,
      }),
    );
  },
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
