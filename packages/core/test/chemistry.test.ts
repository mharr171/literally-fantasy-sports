import { describe, expect, it } from "vitest";
import {
  type ChemistryBoosts,
  chemistryBoostsByColor,
  chemistryBoostsByPlayer,
  chemistryColorCount,
  colorEdge,
  DEFAULT_CHEMISTRY_BOOSTS,
  rankedColors,
  rollChemistryColor,
} from "../src/chemistry";
import { createRng } from "../src/rng";

/** Builds a field from group sizes: [5, 3] → five players of colour 0, three of colour 1. */
function field(...groupSizes: number[]): number[] {
  return groupSizes.flatMap((size, color) =>
    new Array<number>(size).fill(color),
  );
}

describe("chemistryColorCount (D51)", () => {
  it("matches the roadmap table", () => {
    expect(chemistryColorCount(11)).toBe(5); // soccer, football
    expect(chemistryColorCount(9)).toBe(4); // baseball
    expect(chemistryColorCount(6)).toBe(3); // hockey
    expect(chemistryColorCount(5)).toBe(3); // basketball, paintball
  });

  it("never goes below 3 and rejects nonsense", () => {
    expect(chemistryColorCount(1)).toBe(3);
    expect(() => chemistryColorCount(0)).toThrow(RangeError);
    expect(() => chemistryColorCount(4.5)).toThrow(RangeError);
  });
});

describe("rollChemistryColor", () => {
  it("rolls every colour and nothing outside the range", () => {
    const rng = createRng("colours");
    const seen = new Set<number>();
    for (let i = 0; i < 500; i++) seen.add(rollChemistryColor(rng, 5));
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4]);
  });
});

describe("chemistryBoostsByColor (D43, D52)", () => {
  it("5/3/2/1: largest +25%, second +10%", () => {
    expect(chemistryBoostsByColor(field(5, 3, 2, 1), 5)).toEqual([
      0.25, 0.1, 0, 0, 0,
    ]);
  });

  it("4/4/2/1: both 4s +15%, no second-place boost", () => {
    expect(chemistryBoostsByColor(field(4, 4, 2, 1), 5)).toEqual([
      0.15, 0.15, 0, 0, 0,
    ]);
  });

  it("5/2/2/2: largest +25%, each 2 shares the second-place boost at +5%", () => {
    expect(chemistryBoostsByColor(field(5, 2, 2, 2), 5)).toEqual([
      0.25, 0.05, 0.05, 0.05, 0,
    ]);
  });

  it("gives no second-place boost in sports with fewer than 4 colours", () => {
    // Basketball: 5 players, 3 colours, 3/2.
    expect(chemistryBoostsByColor(field(3, 2), 3)).toEqual([0.25, 0, 0]);
    // A tie for first still gets the tied boost.
    expect(chemistryBoostsByColor(field(2, 2, 1), 3)).toEqual([0.15, 0.15, 0]);
  });

  it("handles one colour, an empty field, and colours in any order", () => {
    expect(chemistryBoostsByColor(field(11), 5)).toEqual([0.25, 0, 0, 0, 0]);
    expect(chemistryBoostsByColor([], 5)).toEqual([0, 0, 0, 0, 0]);
    expect(chemistryBoostsByColor([3, 1, 3, 3, 1, 4], 5)).toEqual([
      0, 0.1, 0, 0.25, 0,
    ]);
  });

  it("ignores groups smaller than two players (D79)", () => {
    // 10/1: the lone player gets no second-place boost.
    expect(chemistryBoostsByColor(field(10, 1), 5)).toEqual([0.25, 0, 0, 0, 0]);
    // 7/1/1/1/1: only the 7 ranks.
    expect(chemistryBoostsByColor(field(7, 1, 1, 1, 1), 5)).toEqual([
      0.25, 0, 0, 0, 0,
    ]);
    // 5/2/1/1/1 (two 1s can't tie for second): +25% and +10%.
    expect(chemistryBoostsByColor(field(5, 2, 1, 1, 1), 5)).toEqual([
      0.25, 0.1, 0, 0, 0,
    ]);
    // Five players in five colours: nobody qualifies.
    expect(chemistryBoostsByColor([0, 1, 2, 3, 4], 5)).toEqual([0, 0, 0, 0, 0]);
    // Basketball 2/2/1: the two pairs tie for first.
    expect(chemistryBoostsByColor(field(2, 2, 1), 3)).toEqual([0.15, 0.15, 0]);
  });

  it("can allow single-player groups when a sport sets the minimum to 1", () => {
    const loose = { ...DEFAULT_CHEMISTRY_BOOSTS, minGroupSize: 1 };
    expect(chemistryBoostsByColor(field(10, 1), 5, loose)).toEqual([
      0.25, 0.1, 0, 0, 0,
    ]);
    expect(chemistryBoostsByColor([0, 1, 2], 3, loose)).toEqual([
      0.15, 0.15, 0.15,
    ]);
    // A minimum below 1 behaves like 1.
    expect(
      chemistryBoostsByColor([0, 1, 2], 3, { ...loose, minGroupSize: 0 }),
    ).toEqual([0.15, 0.15, 0.15]);
  });

  it("uses the sport's own boost settings", () => {
    const custom: ChemistryBoosts = {
      largestAlone: 0.3,
      largestTied: 0.2,
      secondAlone: 0.12,
      secondTied: 0.06,
      minGroupSize: 2,
    };
    expect(chemistryBoostsByColor(field(5, 3, 2, 1), 5, custom)).toEqual([
      0.3, 0.12, 0, 0, 0,
    ]);
    expect(chemistryBoostsByColor(field(4, 4), 5, custom)).toEqual([
      0.2, 0.2, 0, 0, 0,
    ]);
    expect(chemistryBoostsByColor(field(5, 2, 2), 5, custom)).toEqual([
      0.3, 0.06, 0.06, 0, 0,
    ]);
  });

  it("rejects colours outside the sport's range", () => {
    expect(() => chemistryBoostsByColor([5], 5)).toThrow(RangeError);
    expect(() => chemistryBoostsByColor([-1], 5)).toThrow(RangeError);
    expect(() => chemistryBoostsByColor([1.5], 5)).toThrow(RangeError);
    expect(() => chemistryBoostsByColor([0], 0)).toThrow(RangeError);
  });

  it("keeps the documented defaults", () => {
    expect(DEFAULT_CHEMISTRY_BOOSTS).toEqual({
      largestAlone: 0.25,
      largestTied: 0.15,
      secondAlone: 0.1,
      secondTied: 0.05,
      minGroupSize: 2,
    });
  });
});

describe("chemistryBoostsByPlayer", () => {
  it("returns each player's boost in field order", () => {
    // Recalculated after a sub: swapping one colour-1 player for a colour-0 player.
    expect(chemistryBoostsByPlayer([0, 1, 0, 2, 1], 5)).toEqual([
      0.15, 0.15, 0.15, 0, 0.15,
    ]);
    // 3/1/1: the single players don't qualify for second place (D79).
    expect(chemistryBoostsByPlayer([0, 0, 0, 2, 1], 5)).toEqual([
      0.25, 0.25, 0.25, 0, 0,
    ]);
    expect(chemistryBoostsByPlayer([0, 0, 0, 1, 1, 2], 5)).toEqual([
      0.25, 0.25, 0.25, 0.1, 0.1, 0,
    ]);
  });
});

describe("color matchups (D119, D138)", () => {
  // Soccer's ring: Red 0 → Yellow 3 → Green 2 → Blue 1 → Purple 4.
  const ring = [0, 3, 2, 1, 4];

  it("has every color beat the next two and lose to the two before", () => {
    expect(colorEdge(0, 3, ring)).toBe(1); // Red beats Yellow
    expect(colorEdge(0, 2, ring)).toBe(1); // Red beats Green
    expect(colorEdge(0, 1, ring)).toBe(-1); // Red loses to Blue
    expect(colorEdge(0, 4, ring)).toBe(-1); // Red loses to Purple
    expect(colorEdge(4, 0, ring)).toBe(1); // Purple beats Red
    expect(colorEdge(2, 2, ring)).toBe(0);
    for (const a of ring) {
      const edges = ring.map((b) => colorEdge(a, b, ring));
      expect(edges.filter((e) => e === 1)).toHaveLength(2);
      expect(edges.filter((e) => e === -1)).toHaveLength(2);
      for (const b of ring)
        expect(colorEdge(b, a, ring) + colorEdge(a, b, ring)).toBe(0);
    }
  });

  it("calls an unknown color even", () => {
    expect(colorEdge(0, 9, ring)).toBe(0);
  });

  it("on a ring of 4, beats the next, loses to the one before and is neutral against the opposite (D211)", () => {
    const four = [0, 1, 2, 3];
    expect(four.map((b) => colorEdge(0, b, four))).toEqual([0, 1, 0, -1]);
    for (const a of four) {
      const edges = four.map((b) => colorEdge(a, b, four));
      expect(edges.filter((e) => e === 1)).toHaveLength(1);
      expect(edges.filter((e) => e === -1)).toHaveLength(1);
      for (const b of four)
        expect(colorEdge(b, a, four) + colorEdge(a, b, four)).toBe(0);
    }
  });

  it("gives an odd ring exactly the answers it always has (soccer, D138)", () => {
    // Each color beats the next two and loses to the two before.
    expect(ring.map((b) => colorEdge(ring[0] as number, b, ring))).toEqual([
      0, 1, 1, -1, -1,
    ]);
  });

  it("ranks dominant and second colors the way chemistry does", () => {
    expect(rankedColors([1, 1, 1, 2, 2, 3])).toEqual({ first: 1, second: 2 });
    // A tie for first: no dominant color, and no second.
    expect(rankedColors([1, 1, 2, 2, 3])).toEqual({
      first: null,
      second: null,
    });
    // A tie for second: no second color.
    expect(rankedColors([1, 1, 1, 2, 2, 3, 3])).toEqual({
      first: 1,
      second: null,
    });
    // Lone players don't form a group (D79).
    expect(rankedColors([1, 1, 2, 3])).toEqual({ first: 1, second: null });
    expect(rankedColors([0, 1, 2])).toEqual({ first: null, second: null });
  });
});
