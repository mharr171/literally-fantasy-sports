import { describe, expect, it } from "vitest";
import { type StatDef, statValue } from "../src/sport";

describe("statValue (ADR 0007 §2)", () => {
  const goals: StatDef = {
    key: "goals",
    label: "Goals",
    short: "G",
    kind: "total",
  };
  const era: StatDef = {
    key: "era",
    label: "ERA",
    short: "ERA",
    kind: "rate",
    numerator: "earnedRuns",
    denominator: "innings",
    scale: 9,
    decimals: 2,
  };
  const avg: StatDef = {
    key: "avg",
    label: "Batting average",
    short: "AVG",
    kind: "rate",
    numerator: "hits",
    denominator: "atBats",
  };

  it("reads totals, with 0 for a stat not yet kept", () => {
    expect(statValue(goals, { goals: 7 })).toBe(7);
    expect(statValue(goals, {})).toBe(0);
  });

  it("works rates out from two totals, scaled", () => {
    expect(statValue(era, { earnedRuns: 10, innings: 30 })).toBe(3);
    expect(statValue(avg, { hits: 30, atBats: 100 })).toBeCloseTo(0.3);
    expect(statValue(avg, { hits: 3 })).toBeNull();
  });
});
