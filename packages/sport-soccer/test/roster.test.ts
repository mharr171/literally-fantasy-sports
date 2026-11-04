import { describe, expect, it } from "vitest";
import { PACK_SIZE, STARTER_TIER } from "../src/generation";
import { POSITION_LINE } from "../src/positions";
import {
  BOUGHT_TIERS,
  boughtTier,
  isPackFocus,
  PACK_FOCUSES,
  packChoiceError,
  packContents,
  packPrice,
  packTier,
  ROSTER_MAX,
  ROSTER_MIN,
  removalError,
  rosterWarning,
  type StarterPackState,
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

  it("accepts 22 to 30 players from opened packs", () => {
    expect(starterSelectionError(packs(), keep(ROSTER_MIN))).toBeNull();
    expect(starterSelectionError(packs(), keep(ROSTER_MAX))).toBeNull();
  });

  it("rejects too few or too many players", () => {
    expect(starterSelectionError(packs(), keep(21))).toMatch(/at least 22/);
    expect(starterSelectionError(packs(), keep(31))).toMatch(/at most 30/);
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
  it("keeps at least 22 and never sells free starter players", () => {
    const bought = { fromStarterPack: false };
    const starter = { fromStarterPack: true };
    expect(removalError(22, bought, "release")).toMatch(/at least 22/);
    expect(removalError(23, starter, "release")).toBeNull();
    expect(removalError(23, starter, "sell")).toMatch(/can't|not sold/);
    expect(removalError(23, bought, "sell")).toBeNull();
  });

  it("warns when the roster can't play", () => {
    expect(rosterWarning(21)).toMatch(/at least 22/);
    expect(rosterWarning(30)).toBeNull();
    expect(rosterWarning(33)).toMatch(/down to 30/);
  });
});
