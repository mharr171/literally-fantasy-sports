import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // Some tests simulate hundreds of matches: about 1.5 s each with coverage
    // locally, several times that on CI's small runner with every package
    // testing at once, so the 5 s default is too tight.
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      include: ["src/**/*.ts"],
      reporter: ["text", "text-summary"],
      // Engine packages target ~90% coverage (roadmap, Step 7).
      thresholds: { lines: 90, branches: 90, functions: 90, statements: 90 },
    },
  },
});
