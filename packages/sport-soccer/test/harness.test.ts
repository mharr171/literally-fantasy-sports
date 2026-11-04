import { describe, expect, it } from "vitest";
import { formatReport, runHarness } from "../src/harness";

describe("tuning harness", () => {
  // A smaller run than the full 10,000-match harness, as a regression guard.
  const report = runHarness({ matches: 3000, seed: "ci" });

  it("stays near the roadmap targets", () => {
    expect(report.goalsPerMatch).toBeGreaterThan(2.4);
    expect(report.goalsPerMatch).toBeLessThan(2.9);
    const even = report.byGap.find((g) => g.gap === 0);
    expect(even?.draw).toBeGreaterThan(0.2);
    expect(even?.draw).toBeLessThan(0.34);
  });

  it("gives bigger strength gaps bigger win rates", () => {
    const wins = report.byGap.map((g) => g.win);
    expect(wins.at(-1)).toBeGreaterThan(wins[0] as number);
    expect(
      report.byGap.every((g) => Math.abs(g.win + g.draw + g.loss - 1) < 1e-9),
    ).toBe(true);
  });

  it("formats a readable report", () => {
    const text = formatReport(report);
    expect(text).toMatch(/Goals per match: {2}\d\.\d\d/);
    expect(text).toMatch(/gap {3}win/);
  });

  it("handles an empty gap bucket", () => {
    const tiny = runHarness({ matches: 1, seed: "tiny", gaps: [0, 10] });
    expect(tiny.byGap[1]).toEqual({ gap: 10, win: 0, draw: 0, loss: 0 });
  });
});
