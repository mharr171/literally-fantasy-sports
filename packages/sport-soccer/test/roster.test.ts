import { describe, expect, it } from "vitest";
import { PACK_SIZE, STARTER_TIER } from "../src/generation";
import { POSITION_LINE } from "../src/positions";
import {
  isPackFocus,
  PACK_FOCUSES,
  packContents,
  packTier,
  ROSTER_MAX,
  ROSTER_MIN,
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
    expect(() => packTier("gold")).toThrow(/Unknown pack tier/);
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
