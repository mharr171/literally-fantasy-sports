import { describe, expect, it } from "vitest";
import {
  ATTRIBUTES,
  type Attributes,
  atBatEdges,
  type BaseballPlayer,
  type BatterPosition,
  DEFAULT_SKILL_TUNING,
  type GameSide,
  PROPOSED_MATCHUPS,
  positionFit,
  sideMultipliers,
  teamMatchupBonus,
} from "../src/index";

const attrs = Object.fromEntries(ATTRIBUTES.map((k) => [k, 50])) as Attributes;
const ORDER: BatterPosition[] = [
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "LF",
  "CF",
  "RF",
  "DH",
];

const batter = (
  primary: BatterPosition,
  color: number,
  secondary: BatterPosition | null = null,
): BaseballPlayer => ({
  id: `${primary}-${color}`,
  attributes: attrs,
  primaryPosition: primary,
  secondaryPosition: secondary,
  pitcherRole: null,
  chemistryColor: color,
});
const pitcher = (color: number): BaseballPlayer => ({
  id: `P-${color}`,
  attributes: attrs,
  primaryPosition: "P",
  secondaryPosition: null,
  pitcherRole: "starter",
  chemistryColor: color,
});

/** Everyone at their own position, with these colors (9 batters, then the pitcher). */
const side = (colors: number[], home = false): GameSide => ({
  batters: ORDER.map((pos, i) => ({
    player: batter(pos, colors[i] as number),
    slot: pos,
  })),
  pitcher: pitcher(colors[9] as number),
  home,
});
// A 3/3/2/2 split of the 10: colors 0 and 1 tie for largest, +15% each,
// and the tie uses up second place (D52).
const MIXED = [0, 0, 0, 1, 1, 1, 2, 2, 3, 3];

describe("position fit (D195)", () => {
  it("rates primary, secondary and anywhere else", () => {
    const ss = batter("SS", 0, "2B");
    expect(positionFit(ss, "SS")).toBe("primary");
    expect(positionFit(ss, "2B")).toBe("secondary");
    expect(positionFit(ss, "C")).toBe("other");
  });

  it("lets any batter DH at the secondary bonus", () => {
    expect(positionFit(batter("C", 0), "DH")).toBe("secondary");
    expect(positionFit(batter("DH", 0), "DH")).toBe("primary");
  });

  it("refuses pitchers in the field and batters on the mound", () => {
    expect(() => positionFit(pitcher(0), "1B")).toThrow(/only pitch/);
    expect(() => positionFit(batter("CF", 0), "P")).toThrow(/Only a pitcher/);
    expect(positionFit(pitcher(0), "P")).toBe("primary");
  });
});

describe("game-day multipliers (ADR 0008 §3)", () => {
  it("adds fit, chemistry among the 10 and home advantage", () => {
    const home = sideMultipliers(side(MIXED, true), side(MIXED));
    const away = sideMultipliers(side(MIXED), side(MIXED, true));
    // Color 0 and 1 tie for largest (3 each): +15%; 2 and 3 get nothing
    // (the tie used up second place).
    expect(away.batters[0]).toBeCloseTo(1 + 0.25 + 0.15);
    expect(away.batters[6]).toBeCloseTo(1 + 0.25);
    expect(away.pitcher).toBeCloseTo(1 + 0.25);
    expect(home.batters[0]).toBeCloseTo(1 + 0.25 + 0.15 + 0.03);
  });

  it("takes the out-of-position penalty, and never goes below zero", () => {
    const s = side(MIXED);
    const moved: GameSide = {
      ...s,
      batters: s.batters.map((b, i) =>
        i === 0 ? { ...b, slot: "CF" as const } : b,
      ),
    };
    const m = sideMultipliers(moved, side(MIXED));
    expect(m.batters[0]).toBeCloseTo(1 - 0.5 + 0.15);
    const harsh = sideMultipliers(moved, side(MIXED), {
      ...DEFAULT_SKILL_TUNING,
      positionFit: { primary: 0, secondary: 0, other: -3 },
    });
    expect(harsh.batters[0]).toBe(0);
  });

  it("counts the pitcher in chemistry: a pitching change can move it", () => {
    // 9 batters: 3/3/2/1 of colors 0–3. A color-2 pitcher makes it 3/3/3/1.
    const colors = [0, 0, 0, 1, 1, 1, 2, 2, 3];
    const withTwo = sideMultipliers(side([...colors, 2]), side(MIXED));
    const withZero = sideMultipliers(side([...colors, 0]), side(MIXED));
    // A color-0 pitcher gives color 0 the largest group alone: +25%.
    expect(withZero.batters[0]).toBeCloseTo(1 + 0.25 + 0.25);
    expect(withTwo.batters[0]).toBeCloseTo(1 + 0.25 + 0.15);
  });
});

describe("color matchups (D200, D211)", () => {
  const on = { ...DEFAULT_SKILL_TUNING, ...PROPOSED_MATCHUPS };
  // Color 0 dominant (5), then 1 (3), against color 1 dominant, then 2.
  const zeroes = side([0, 0, 0, 0, 0, 1, 1, 1, 2, 3]);
  const ones = side([1, 1, 1, 1, 1, 2, 2, 2, 3, 0]);

  it("are off until a settings version turns them on", () => {
    expect(teamMatchupBonus(zeroes, ones)).toBe(0);
    expect(atBatEdges(0, 1)).toEqual({ batter: 0, pitcher: 0 });
  });

  it("boosts the side whose dominant and second colors win", () => {
    // 0 beats 1 and 1 beats 2: both win.
    expect(teamMatchupBonus(zeroes, ones, on)).toBeCloseTo(0.07 + 0.035);
    expect(teamMatchupBonus(ones, zeroes, on)).toBe(0);
    expect(sideMultipliers(zeroes, ones, on).batters[0]).toBeCloseTo(
      1 + 0.25 + 0.25 + 0.07 + 0.035,
    );
  });

  it("gives no team bonus when a side has no dominant color", () => {
    expect(teamMatchupBonus(side(MIXED), ones, on)).toBe(0);
  });

  it("pits the batter's color against the pitcher's on each at-bat", () => {
    // On the ring of 4: 0 beats 1, loses to 3, neutral against 2.
    expect(atBatEdges(0, 1, on)).toEqual({ batter: 0.09, pitcher: -0.09 });
    expect(atBatEdges(0, 3, on)).toEqual({ batter: -0.09, pitcher: 0.09 });
    expect(atBatEdges(0, 2, on)).toEqual({ batter: 0, pitcher: 0 });
    expect(atBatEdges(1, 1, on)).toEqual({ batter: 0, pitcher: 0 });
  });
});
