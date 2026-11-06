import { describe, expect, it } from "vitest";
import {
  allowedColors,
  BOUGHT_TIERS,
  boughtTier,
  createRng,
  DEFAULT_PACK_PRICES,
  excludedColorsError,
  LADDER_TIERS,
  PACK_SIZE,
  PACK_TIERS,
  packChoiceError,
  packEloShift,
  packPrice,
  packTier,
  type RosterLimits,
  removalError,
  rewardTier,
  rollPackOverall,
  rosterWarning,
  STARTER_TIER,
  type StarterPackState,
  shiftedTier,
  starterSelectionError,
} from "../src/index";

const LIMITS: RosterLimits = { min: 14, max: 30, benchMax: 5 };

describe("pack tiers and odds (D47, D181)", () => {
  it("sells the ladder cheapest first, then special packs, each with odds adding to 100%", () => {
    expect(LADDER_TIERS.map((t) => t.id)).toEqual(["basic", "silver", "gold"]);
    expect(BOUGHT_TIERS.filter((t) => t.special).map((t) => t.id)).toEqual([
      "prospect",
      "veteran",
      "wildcard",
    ]);
    for (const t of BOUGHT_TIERS)
      expect((t.bands ?? []).reduce((a, b) => a + b.weight, 0)).toBe(100);
    expect(PACK_TIERS.starter).toBe(STARTER_TIER);
    expect(packTier("gold").min).toBe(60);
    expect(() => packTier("nope")).toThrow(/Unknown pack tier/);
    expect(boughtTier("basic").price).toBe(5_000);
    expect(() => boughtTier("starter")).toThrow(/isn't for sale/);
  });

  it("draws overalls from a tier's bands, or around its mean", () => {
    const rng = createRng("odds");
    const basic = Array.from({ length: 2000 }, () =>
      rollPackOverall(rng, packTier("basic")),
    );
    expect(Math.min(...basic)).toBeGreaterThanOrEqual(40);
    expect(Math.max(...basic)).toBeLessThanOrEqual(79);
    const share = basic.filter((o) => o >= 50 && o <= 59).length / 2000;
    expect(share).toBeGreaterThan(0.45);
    expect(share).toBeLessThan(0.55);
    const starter = Array.from({ length: 500 }, () =>
      rollPackOverall(rng, STARTER_TIER),
    );
    expect(Math.min(...starter)).toBeGreaterThanOrEqual(STARTER_TIER.min);
    expect(Math.max(...starter)).toBeLessThanOrEqual(STARTER_TIER.max);
  });

  it("gives a reward pack for the playoff finish", () => {
    expect(rewardTier("champion")).toBe("gold");
    expect(rewardTier("final")).toBe("silver");
    expect(rewardTier("semi")).toBe("basic");
    expect(rewardTier("quarter")).toBeNull();
    expect(rewardTier("wildcard")).toBeNull();
  });
});

describe("prices, Elo shift and colors (D179, D180)", () => {
  it("adds the focus and color surcharges, then the Elo shift, rounded to 50", () => {
    expect(packPrice("basic", "any")).toBe(5_000);
    expect(packPrice("basic", "infield")).toBe(6_000);
    expect(
      packPrice("basic", "any", DEFAULT_PACK_PRICES, { excludedColors: [1] }),
    ).toBe(6_250);
    expect(
      packPrice("basic", "any", DEFAULT_PACK_PRICES, {
        excludedColors: [1, 2],
      }),
    ).toBe(8_000);
    expect(
      packPrice("basic", "any", DEFAULT_PACK_PRICES, {
        excludedColors: [0, 1, 2],
      }),
    ).toBe(11_000);
    expect(
      packPrice("basic", "any", DEFAULT_PACK_PRICES, { eloShift: 5 }),
    ).toBe(5_750);
    // A tier priced in the settings wins over its default price.
    expect(
      packPrice("basic", "any", {
        ...DEFAULT_PACK_PRICES,
        tiers: { basic: 7_000 },
      }),
    ).toBe(7_000);
  });

  it("moves odds with Elo only when switched on, within limits", () => {
    expect(packEloShift(1900)).toBe(0);
    const on = { ...DEFAULT_PACK_PRICES, eloPerOverall: 40 };
    expect(packEloShift(1700, on)).toBe(5);
    expect(packEloShift(3000, on)).toBe(15);
    expect(packEloShift(0, on)).toBe(-10);
    expect(packEloShift(Number.NaN, on)).toBe(0);
    const gold = packTier("gold");
    expect(shiftedTier(gold, 0)).toBe(gold);
    const up = shiftedTier(gold, 15);
    expect(up.bands?.at(-1)).toMatchObject({ min: 99, max: 99 });
    expect(shiftedTier(STARTER_TIER, -20)).toMatchObject({ min: 30, mean: 35 });
  });

  it("leaves out up to 3 of a sport's colors", () => {
    expect(excludedColorsError([0, 1, 2], 4)).toBeNull();
    expect(excludedColorsError([0, 1, 2, 3], 4)).toMatch(/at most 3/);
    expect(excludedColorsError([1, 1], 4)).toMatch(/twice/);
    expect(excludedColorsError([4], 4)).toMatch(/isn't a chemistry color/);
    expect(excludedColorsError([4], 5)).toBeNull();
    expect(allowedColors([], 4)).toBeUndefined();
    expect(allowedColors([1, 3], 4)).toEqual([0, 2]);
  });
});

describe("keeping, releasing and selling (D83, D182)", () => {
  const packs = (n: number, over: Partial<StarterPackState> = {}) =>
    Array.from({ length: n }, (_, i) => ({
      id: `p${i}`,
      opened: true,
      resolved: false,
      ...over,
    }));
  const pick = (n: number, per: number) =>
    Object.fromEntries(
      Array.from({ length: n }, (_, i) => [
        `p${i}`,
        Array.from({ length: per }, (_, j) => j),
      ]),
    );

  it("checks a starter selection against the sport's limits", () => {
    expect(starterSelectionError(packs(16), pick(16, 1), LIMITS)).toBeNull();
    expect(starterSelectionError([], {}, LIMITS)).toMatch(/no starter packs/);
    expect(starterSelectionError(packs(16), pick(13, 1), LIMITS)).toMatch(
      /at least 14/,
    );
    expect(starterSelectionError(packs(16), pick(16, 2), LIMITS)).toMatch(
      /at most 30/,
    );
    expect(
      starterSelectionError(packs(2, { resolved: true }), {}, LIMITS),
    ).toMatch(/already picked/);
    expect(
      starterSelectionError(packs(2, { opened: false }), {}, LIMITS),
    ).toMatch(/2 still sealed/);
    expect(starterSelectionError(packs(1), { x: [0] }, LIMITS)).toMatch(
      /isn't one of/,
    );
    expect(starterSelectionError(packs(1), { p0: [0, 0] }, LIMITS)).toMatch(
      /twice/,
    );
    expect(
      starterSelectionError(packs(1), { p0: [PACK_SIZE] }, LIMITS),
    ).toMatch(/isn't in the pack/);
  });

  it("checks a bought pack's keeps", () => {
    expect(packChoiceError([0, 4])).toBeNull();
    expect(packChoiceError([1, 1])).toMatch(/twice/);
    expect(packChoiceError([5])).toMatch(/isn't in the pack/);
  });

  it("keeps the sport's minimum, never sells free starters, and warns when the roster can't play", () => {
    expect(
      removalError(15, { fromStarterPack: true }, "release", LIMITS),
    ).toBeNull();
    expect(
      removalError(14, { fromStarterPack: false }, "sell", LIMITS),
    ).toMatch(/at least 14/);
    expect(removalError(15, { fromStarterPack: true }, "sell", LIMITS)).toMatch(
      /released but not sold/,
    );
    expect(rosterWarning(20, LIMITS)).toBeNull();
    expect(rosterWarning(13, LIMITS)).toMatch(/at least 14/);
    expect(rosterWarning(31, LIMITS)).toMatch(/down to 30/);
  });
});
