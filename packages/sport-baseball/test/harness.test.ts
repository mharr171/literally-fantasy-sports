import { describe, expect, it } from "vitest";
import {
  buildWinTable,
  formatReport,
  runHarness,
  situationKey,
  situations,
  WIN_TABLE,
  winProbability,
} from "../src/index";

describe("the tuning harness (ADR 0008 §10)", () => {
  const run = () => runHarness(120, "test", undefined, undefined, 30);
  const report = run();

  it("reports every target, with plausible numbers", () => {
    expect(report.games).toBe(120);
    expect(report.runsPerGame).toBeGreaterThan(5);
    expect(report.runsPerGame).toBeLessThan(13);
    expect(report.battingAverage).toBeGreaterThan(0.2);
    expect(report.battingAverage).toBeLessThan(0.3);
    expect(report.byGap.map((g) => g.gap)).toEqual([0, 5, 10, 15]);
    expect(report.byGap[3]?.winRate).toBeGreaterThan(
      report.byGap[0]?.winRate ?? 1,
    );
    expect(Object.keys(report.formByPosition)).toContain("P");
    const text = formatReport(report);
    for (const label of [
      "Runs per game",
      "Home wins",
      "extra innings",
      "Walks",
      "Batting average",
      "gap 10",
      "by position",
      "ms per game",
    ])
      expect(text).toContain(label);
  });

  it("replays exactly from its seed", () => {
    const again = run();
    expect({ ...again, msPerGame: 0 }).toEqual({ ...report, msPerGame: 0 });
  });
});

describe("win probability (ADR 0008 §8)", () => {
  it("reads situations at the start of each plate appearance", () => {
    const table = buildWinTable(30, "wp-test");
    expect(Object.keys(table).length).toBeGreaterThan(0);
    for (const v of Object.values(table)) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1000);
    }
  });

  it("calls an even start about even, and big late leads nearly won", () => {
    const start = {
      inning: 1,
      batting: "away" as const,
      outs: 0,
      bases: [null, null, null] as const,
      diff: 0,
    };
    expect(winProbability(WIN_TABLE, start)).toBeGreaterThan(0.45);
    expect(winProbability(WIN_TABLE, start)).toBeLessThan(0.6);
    const late = {
      inning: 9,
      batting: "away" as const,
      outs: 2,
      bases: [null, null, null] as const,
      diff: 4,
    };
    expect(winProbability(WIN_TABLE, late)).toBeGreaterThan(0.95);
    expect(winProbability(WIN_TABLE, { ...late, diff: -4 })).toBeLessThan(0.05);
    // Runners on base help the batting side.
    const tied = {
      inning: 9,
      batting: "home" as const,
      outs: 1,
      bases: [null, null, null] as const,
      diff: 0,
    };
    expect(
      winProbability(WIN_TABLE, { ...tied, bases: [null, null, "r"] }),
    ).toBeGreaterThan(winProbability(WIN_TABLE, tied));
  });

  it("falls back for situations it never saw", () => {
    const s = {
      inning: 3,
      batting: "home" as const,
      outs: 1,
      bases: ["a", "b", "c"] as const,
      diff: 2,
    };
    expect(situationKey(s)).toBe("3b17:2");
    expect(winProbability({}, s)).toBe(0.99);
    expect(winProbability({}, { ...s, diff: -2 })).toBe(0.01);
    expect(winProbability({}, { ...s, diff: 0 })).toBe(0.5);
    expect(winProbability({ "3b1x:2": 700 }, s)).toBe(0.7);
    expect(winProbability({ "d:2": 650 }, s)).toBe(0.65);
    expect(situations([])).toEqual([]);
  });
});
