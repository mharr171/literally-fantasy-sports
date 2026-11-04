import { describe, expect, it } from "vitest";
import { parseChangelog, playerLine } from "./changelog";

const SAMPLE = `# Changelog

## [0.6.1](https://github.com/o/r/compare/v0.6.0...v0.6.1) (2026-11-05)


### Bug Fixes

* changes to the privacy policy now redeploy the site ([#49](https://github.com/o/r/issues/49)) ([a5c07cb](https://github.com/o/r/commit/a5c07cb))

### Documentation

* skip Sentry for now ([#49](https://github.com/o/r/issues/49)) ([a5c07cb](https://github.com/o/r/commit/a5c07cb))

## [0.6.0](https://github.com/o/r/compare/v0.5.0...v0.6.0) (2026-11-04)


### Features

* **admin:** change match tuning without a deploy ([#46](https://github.com/o/r/issues/46)) ([49b2b3a](https://github.com/o/r/commit/49b2b3a))
* match pages with a pitch heatmap ([#45](https://github.com/o/r/issues/45)) ([5b494ab](https://github.com/o/r/commit/5b494ab))
* **season:** playoffs go to penalties ([#9](https://github.com/o/r/issues/9)) ([1234567](https://github.com/o/r/commit/1234567))


### Build and CI

* skip Vercel deploys ([#44](https://github.com/o/r/issues/44)) ([dbdf8c6](https://github.com/o/r/commit/dbdf8c6))

## 0.1.0 (2026-11-01)


### Features

* sign in with Google
`;

describe("What's new (M6)", () => {
  it("keeps features and fixes per release, newest first", () => {
    expect(parseChangelog(SAMPLE)).toEqual([
      {
        version: "0.6.1",
        date: "2026-11-05",
        features: [],
        fixes: ["Changes to the privacy policy now redeploy the site"],
      },
      {
        version: "0.6.0",
        date: "2026-11-04",
        features: [
          "Match pages with a pitch heatmap",
          "Playoffs go to penalties",
        ],
        fixes: [],
      },
      {
        version: "0.1.0",
        date: "2026-11-01",
        features: ["Sign in with Google"],
        fixes: [],
      },
    ]);
  });

  it("hides admin and database items and strips links", () => {
    expect(
      playerLine("* **admin:** testing tools ([#38](x)) ([71a626a](y))"),
    ).toBeNull();
    expect(
      playerLine("* **db:** add teams ([#20](x)) ([abc1234](y))"),
    ).toBeNull();
    expect(playerLine("* form and morale ([#39](x)) ([d403b33](y))")).toBe(
      "Form and morale",
    );
    expect(playerLine("* a link to [the rules](z) stays")).toBe(
      "A link to [the rules](z) stays",
    );
  });

  it("reads the real changelog", async () => {
    const { readFileSync } = await import("node:fs");
    const releases = parseChangelog(
      readFileSync(
        new URL("../../../../CHANGELOG.md", import.meta.url),
        "utf-8",
      ),
    );
    expect(releases.length).toBeGreaterThanOrEqual(6);
    expect(releases.at(-1)?.version).toBe("0.1.0");
    for (const r of releases)
      for (const line of [...r.features, ...r.fixes])
        expect(line).not.toMatch(/\]\(https?:/);
  });
});
