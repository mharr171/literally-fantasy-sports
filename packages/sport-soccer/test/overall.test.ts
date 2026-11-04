import { describe, expect, it } from "vitest";
import { assertValidAttributes } from "../src/attributes";
import {
  assertValidWeights,
  DEFAULT_OVERALL_WEIGHTS,
  type OverallWeights,
  overallAt,
} from "../src/overall";
import { playerOverall } from "../src/player";
import { POSITIONS } from "../src/positions";
import { attrs, player } from "./fixtures";

describe("attributes (D78)", () => {
  it("accepts whole numbers from 1 to 99", () => {
    expect(() =>
      assertValidAttributes(attrs({ pace: 1, shooting: 99 })),
    ).not.toThrow();
  });

  it("rejects values out of range or fractional", () => {
    expect(() => assertValidAttributes(attrs({ pace: 0 }))).toThrow(/pace/);
    expect(() => assertValidAttributes(attrs({ stamina: 100 }))).toThrow(
      /stamina/,
    );
    expect(() => assertValidAttributes(attrs({ passing: 50.5 }))).toThrow(
      /passing/,
    );
  });
});

describe("overall rating", () => {
  it("default weights cover every position and sum to 1", () => {
    expect(Object.keys(DEFAULT_OVERALL_WEIGHTS).sort()).toEqual(
      [...POSITIONS].sort(),
    );
    expect(() => assertValidWeights(DEFAULT_OVERALL_WEIGHTS)).not.toThrow();
  });

  it("rejects weights that don't sum to 1 or are negative", () => {
    const bad: OverallWeights = {
      ...DEFAULT_OVERALL_WEIGHTS,
      ST: { shooting: 0.5 },
    };
    expect(() => assertValidWeights(bad)).toThrow(/ST weights sum/);
    const negative: OverallWeights = {
      ...DEFAULT_OVERALL_WEIGHTS,
      ST: { shooting: 1.5, pace: -0.5 },
    };
    expect(() => assertValidWeights(negative)).toThrow(/Invalid weight/);
    const missing = { ...DEFAULT_OVERALL_WEIGHTS } as Partial<OverallWeights>;
    delete missing.GK;
    expect(() => assertValidWeights(missing as OverallWeights)).toThrow(
      /GK weights sum to 0/,
    );
  });

  it("is the plain average when every attribute is equal", () => {
    const flat = attrs({ goalkeeping: 50 });
    for (const p of POSITIONS) expect(overallAt(flat, p)).toBe(50);
  });

  it("rewards the attributes that matter for each position", () => {
    const striker = attrs({ shooting: 90, pace: 80, defending: 30 });
    const defender = attrs({ defending: 90, physical: 85, shooting: 30 });
    expect(overallAt(striker, "ST")).toBeGreaterThan(overallAt(striker, "CB"));
    expect(overallAt(defender, "CB")).toBeGreaterThan(
      overallAt(defender, "ST"),
    );
    // Outfield players are poor in goal; keepers rely on goalkeeping.
    expect(overallAt(striker, "GK")).toBeLessThan(30);
    expect(overallAt(attrs({ goalkeeping: 85 }), "GK")).toBe(76);
  });

  it("gives wingers more pace weight than wide midfielders, who defend a little", () => {
    const quick = attrs({ pace: 95, defending: 20 });
    expect(overallAt(quick, "LW")).toBeGreaterThan(overallAt(quick, "LM"));
    expect(overallAt(quick, "RW")).toBe(overallAt(quick, "LW"));
  });

  it("calculates exact values for a known player", () => {
    // ST: 0.45×88 + 0.25×80 + 0.15×70 + 0.15×65 = 79.85 → 80
    expect(
      overallAt(
        attrs({ shooting: 88, pace: 80, physical: 70, passing: 65 }),
        "ST",
      ),
    ).toBe(80);
  });

  it("uses the primary position for the headline overall", () => {
    const p = player({
      attributes: attrs({ shooting: 90 }),
      primaryPosition: "ST",
    });
    expect(playerOverall(p)).toBe(overallAt(p.attributes, "ST"));
  });
});
