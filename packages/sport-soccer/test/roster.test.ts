import { describe, expect, it } from "vitest";
import { PACK_SIZE, STARTER_TIER } from "../src/generation";
import { POSITION_LINE } from "../src/positions";
import {
  allowedColors,
  BOUGHT_TIERS,
  boughtTier,
  DEFAULT_PACK_PRICES,
  DEFAULT_ROSTER_LIMITS,
  excludedColorsError,
  isPackFocus,
  PACK_FOCUSES,
  packChoiceError,
  packContents,
  packEloShift,
  packPrice,
  packTier,
  ROSTER_MAX,
  ROSTER_MIN,
  removalError,
  rosterLimitsError,
  rosterWarning,
  type StarterPackState,
  shiftedTier,
  starterPackPlan,
  starterSelectionError,
} from "../src/roster";

describe("starter packs", () => {
  it("plans 22 starter packs in the D83 mix", () => {
    const plan = starterPackPlan();
    expect(plan).toHaveLength(22);
    const count = (focus: string) =>
      plan.filter((p) => p.focus === focus).length;
    expect(PACK_FOCUSES.map(count)).toEqual([2, 4, 4, 1, 11]);
    expect(plan.every((p) => p.tier === STARTER_TIER.id)).toBe(true);
  });

  it("always opens the same players from the same seed", () => {
    const a = packContents("seed-1", "goal", "starter");
    expect(a).toHaveLength(PACK_SIZE);
    expect(packContents("seed-1", "goal", "starter")).toEqual(a);
    expect(packContents("seed-2", "goal", "starter")).not.toEqual(a);
    expect(a.every((p) => POSITION_LINE[p.primaryPosition] === "goal")).toBe(
      true,
    );
  });

  it("knows its tiers and focuses", () => {
    expect(packTier("starter")).toBe(STARTER_TIER);
    expect(() => packTier("platinum")).toThrow(/Unknown pack tier/);
    expect(isPackFocus("defence")).toBe(true);
    expect(isPackFocus("defense")).toBe(false);
  });
});

describe("starterSelectionError", () => {
  const packs = (opened = true, resolved = false): StarterPackState[] =>
    Array.from({ length: 22 }, (_, i) => ({ id: `p${i}`, opened, resolved }));
  /** Keeps `n` players, filling packs in order. */
  const keep = (n: number) => {
    const selection: Record<string, number[]> = {};
    for (let i = 0; i < n; i++) {
      const id = `p${Math.floor(i / PACK_SIZE)}`;
      selection[id] = [...(selection[id] ?? []), i % PACK_SIZE];
    }
    return selection;
  };

  it("accepts 11 to 33 players from opened packs (D182)", () => {
    expect(starterSelectionError(packs(), keep(ROSTER_MIN))).toBeNull();
    expect(starterSelectionError(packs(), keep(ROSTER_MAX))).toBeNull();
  });

  it("rejects too few or too many players, by the sport's limits", () => {
    expect(starterSelectionError(packs(), keep(10))).toMatch(/at least 11/);
    expect(starterSelectionError(packs(), keep(34))).toMatch(/at most 33/);
    const old = { min: 22, max: 30, benchMax: 11 };
    expect(starterSelectionError(packs(), keep(21), old)).toMatch(
      /at least 22/,
    );
    expect(starterSelectionError(packs(), keep(31), old)).toMatch(/at most 30/);
  });

  it("needs every pack opened and none already resolved", () => {
    const some = packs();
    some[3] = { id: "p3", opened: false, resolved: false };
    expect(starterSelectionError(some, keep(22))).toMatch(/1 still sealed/);
    expect(starterSelectionError(packs(true, true), keep(22))).toMatch(
      /already picked/,
    );
    expect(starterSelectionError([], {})).toMatch(/no starter packs/);
  });

  it("rejects unknown packs, duplicates and missing players", () => {
    expect(starterSelectionError(packs(), { ...keep(22), x: [0] })).toMatch(
      /isn't one of your/,
    );
    expect(
      starterSelectionError(packs(), { ...keep(22), p21: [1, 1] }),
    ).toMatch(/picked twice/);
    expect(starterSelectionError(packs(), { ...keep(22), p21: [5] })).toMatch(
      /isn't in the pack/,
    );
    expect(starterSelectionError(packs(), { ...keep(22), p21: [1.5] })).toMatch(
      /isn't in the pack/,
    );
  });
});

describe("bought packs (D47)", () => {
  it("sells three tiers, cheapest first, with odds adding up to 100%", () => {
    expect(BOUGHT_TIERS.map((t) => [t.id, t.price])).toEqual([
      ["basic", 5_000],
      ["silver", 12_000],
      ["gold", 30_000],
    ]);
    for (const tier of BOUGHT_TIERS) {
      expect(tier.bands?.reduce((a, b) => a + b.weight, 0)).toBe(100);
      expect(packTier(tier.id)).toBe(tier);
    }
    expect(boughtTier("gold").min).toBe(60);
    expect(boughtTier("gold").max).toBe(99);
    expect(() => boughtTier("starter")).toThrow(/isn't for sale/);
  });

  it("charges 20% more for a position focus", () => {
    expect(packPrice("basic", "any")).toBe(5_000);
    expect(packPrice("basic", "goal")).toBe(6_000);
    expect(packPrice("silver", "attack")).toBe(14_400);
  });

  it("draws overalls from the published odds", () => {
    const tier = boughtTier("basic");
    const overalls = Array.from({ length: 400 }, (_, i) =>
      packContents(`odds-${i}`, "any", "basic"),
    )
      .flat()
      .map((p) => p.overall);
    expect(Math.min(...overalls)).toBeGreaterThanOrEqual(tier.min - 1);
    expect(Math.max(...overalls)).toBeLessThanOrEqual(tier.max + 1);
    const share = (lo: number, hi: number) =>
      overalls.filter((o) => o >= lo && o <= hi).length / overalls.length;
    expect(share(50, 59)).toBeGreaterThan(0.44);
    expect(share(50, 59)).toBeLessThan(0.56);
    expect(share(70, 80)).toBeGreaterThan(0.02);
    expect(share(70, 80)).toBeLessThan(0.08);
  });

  it("checks keep choices", () => {
    expect(packChoiceError([])).toBeNull();
    expect(packChoiceError([0, 4])).toBeNull();
    expect(packChoiceError([1, 1])).toMatch(/twice/);
    expect(packChoiceError([5])).toMatch(/isn't in the pack/);
  });
});

describe("leaving the roster", () => {
  it("keeps the sport's minimum and never sells free starter players", () => {
    const bought = { fromStarterPack: false };
    const starter = { fromStarterPack: true };
    expect(removalError(11, bought, "release")).toMatch(/at least 11/);
    expect(removalError(12, bought, "release")).toBeNull();
    expect(
      removalError(22, bought, "release", { min: 22, max: 30, benchMax: 11 }),
    ).toMatch(/at least 22/);
    expect(removalError(23, starter, "release")).toBeNull();
    expect(removalError(23, starter, "sell")).toMatch(/can't|not sold/);
    expect(removalError(23, bought, "sell")).toBeNull();
  });

  it("warns when the roster can't play", () => {
    expect(rosterWarning(10)).toMatch(/at least 11/);
    expect(rosterWarning(11)).toBeNull();
    expect(rosterWarning(33)).toBeNull();
    expect(rosterWarning(34)).toMatch(/down to 33/);
    expect(rosterWarning(31, { min: 22, max: 30, benchMax: 11 })).toMatch(
      /down to 30/,
    );
  });

  it("checks the limits admins set", () => {
    expect(rosterLimitsError(DEFAULT_ROSTER_LIMITS)).toBeNull();
    expect(rosterLimitsError({ min: 10, max: 33, benchMax: 11 })).toMatch(
      /Minimum roster/,
    );
    expect(rosterLimitsError({ min: 25, max: 22, benchMax: 11 })).toMatch(
      /can't be above/,
    );
    expect(rosterLimitsError({ min: 11, max: 33, benchMax: 12 })).toMatch(
      /Bench size/,
    );
  });
});

describe("Elo-scaled packs and color exclusion (D179, D180)", () => {
  const scaled = { ...DEFAULT_PACK_PRICES, eloPerOverall: 40 };

  it("moves a pack's odds with the club's Elo, within limits, only when on", () => {
    expect(packEloShift(1900)).toBe(0);
    expect(packEloShift(1700, scaled)).toBe(5);
    expect(packEloShift(1300, scaled)).toBe(-5);
    expect(packEloShift(3000, scaled)).toBe(15);
    expect(packEloShift(500, scaled)).toBe(-10);
    const gold = boughtTier("gold");
    const up = shiftedTier(gold, 10);
    expect(up.bands?.map((b) => [b.min, b.max])).toEqual([
      [70, 79],
      [80, 89],
      [90, 99],
      [99, 99],
    ]);
    expect(shiftedTier(gold, 0)).toBe(gold);
  });

  it("prices: focus and colors add up, then the Elo shift; old prices unchanged", () => {
    expect(packPrice("gold", "any")).toBe(30_000);
    expect(packPrice("gold", "any", scaled, { eloShift: 10 })).toBe(39_000);
    expect(packPrice("basic", "defence", scaled, { excludedColors: [1] })).toBe(
      7250,
    );
    expect(
      packPrice("silver", "any", scaled, { excludedColors: [0, 1, 2] }),
    ).toBe(26_400);
    expect(packPrice("basic", "any", scaled, { eloShift: -10 })).toBe(3500);
  });

  it("leaves out colors and moves the odds in the pack's players", () => {
    const plain = packContents("p1", "any", "silver");
    // Old packs (no choice) open exactly as before.
    expect(packContents("p1", "any", "silver", undefined, {})).toEqual(plain);
    const choice = { excludedColors: [0, 2, 4] };
    for (let i = 0; i < 40; i++)
      for (const p of packContents(`c${i}`, "any", "silver", undefined, choice))
        expect([1, 3]).toContain(p.chemistryColor);
    const avg = (shift: number) => {
      let total = 0;
      for (let i = 0; i < 60; i++)
        for (const p of packContents(`e${i}`, "any", "basic", undefined, {
          eloShift: shift,
        }))
          total += p.overall;
      return total / 300;
    };
    expect(avg(10)).toBeGreaterThan(avg(0) + 7);
    expect(allowedColors()).toBeUndefined();
    expect(excludedColorsError([0, 1, 2, 3])).toMatch(/at most 3/);
    expect(excludedColorsError([1, 1])).toMatch(/twice/);
    expect(excludedColorsError([5])).toMatch(/isn't/);
    expect(excludedColorsError([0, 4])).toBeNull();
  });
});
