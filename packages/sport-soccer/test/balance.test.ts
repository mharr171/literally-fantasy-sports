import { DEFAULT_PAYOUTS } from "@lfs/core";
import { describe, expect, it } from "vitest";
import {
  type BalanceSettings,
  balanceErrors,
  balanceFromValues,
  balanceToRows,
  DEFAULT_BALANCE,
  TUNING_LIMITS,
} from "../src/balance";
import { DEFAULT_MATCH_TUNING } from "../src/match";
import { DEFAULT_PACK_PRICES, packPrice } from "../src/roster";
import { soccerConfigFromValues } from "../src/stored-config";

const withChange = (change: (s: BalanceSettings) => void): BalanceSettings => {
  const s: BalanceSettings = structuredClone(DEFAULT_BALANCE);
  change(s);
  return s;
};

describe("balance settings (M5)", () => {
  it("accepts the built-in defaults", () => {
    expect(balanceErrors(DEFAULT_BALANCE)).toEqual([]);
    for (const [key, limit] of Object.entries(TUNING_LIMITS)) {
      const v = DEFAULT_MATCH_TUNING[key as keyof typeof DEFAULT_MATCH_TUNING];
      expect(v).toBeGreaterThanOrEqual(limit.min);
      expect(v).toBeLessThanOrEqual(limit.max);
    }
  });

  it("refuses values out of range, fractions where whole numbers are needed, and non-numbers", () => {
    expect(
      balanceErrors(
        withChange((s) => (s.tuning = { ...s.tuning, chanceRate: 2 })),
      ),
    ).toEqual(["Chance rate must be between 0.05 and 0.95."]);
    expect(
      balanceErrors(
        withChange((s) => (s.tuning = { ...s.tuning, phases: 30.5 })),
      ),
    ).toEqual(["Possession phases (90 minutes) must be a whole number."]);
    expect(
      balanceErrors(
        withChange((s) => (s.payouts = { ...s.payouts, win: Number.NaN })),
      ),
    ).toEqual(["Extra for a win must be a number."]);
    expect(
      balanceErrors(
        withChange((s) => (s.packs = { ...s.packs, focusSurcharge: -1 })),
      ),
    ).toEqual(["Position-focus surcharge must be between 0 and 2."]);
  });

  it("needs pricier tiers to cost more, and no more sub windows than subs", () => {
    expect(
      balanceErrors(
        withChange(
          (s) =>
            (s.packs = {
              ...s.packs,
              tiers: { basic: 5000, silver: 5000, gold: 30000 },
            }),
        ),
      ),
    ).toEqual(["Each pack tier must cost more than the one before it."]);
    expect(
      balanceErrors(
        withChange(
          (s) => (s.tuning = { ...s.tuning, maxSubs: 2, maxSubWindows: 3 }),
        ),
      ),
    ).toEqual(["There can't be more sub windows than substitutions."]);
  });

  it("round-trips through stored rows, keeping only known numbers", () => {
    const s = withChange((x) => {
      x.tuning = { ...x.tuning, goalRate: 0.5 };
      x.payouts = { ...x.payouts, champion: 9000 };
      x.packs = {
        tiers: { basic: 6000, silver: 13000, gold: 31000 },
        focusSurcharge: 0.25,
      };
    });
    const values = Object.fromEntries(
      balanceToRows(s).map((r) => [r.key, r.value]),
    );
    expect(balanceFromValues(values)).toEqual(s);
    expect(
      balanceFromValues({
        tuning: { goalRate: 0.5, bogus: 3, shotRate: "x" },
        payouts: null,
        packs: { tiers: { basic: 6000, platinum: 1 } },
      }),
    ).toEqual({
      tuning: { ...DEFAULT_MATCH_TUNING, goalRate: 0.5 },
      payouts: DEFAULT_PAYOUTS,
      packs: {
        tiers: { ...DEFAULT_PACK_PRICES.tiers, basic: 6000 },
        focusSurcharge: DEFAULT_PACK_PRICES.focusSurcharge,
      },
    });
    expect(soccerConfigFromValues("v", values).tuning.goalRate).toBe(0.5);
  });

  it("won't store settings with errors", () => {
    expect(() =>
      balanceToRows(withChange((s) => (s.tuning = { ...s.tuning, phases: 0 }))),
    ).toThrow(/between 10 and 60/);
  });

  it("prices packs from the given prices", () => {
    expect(packPrice("basic", "any")).toBe(5000);
    expect(packPrice("basic", "attack")).toBe(6000);
    const prices = { tiers: { basic: 7000 }, focusSurcharge: 0.5 };
    expect(packPrice("basic", "any", prices)).toBe(7000);
    expect(packPrice("basic", "goal", prices)).toBe(10500);
    // A tier missing from the prices keeps its built-in price.
    expect(packPrice("gold", "any", prices)).toBe(30000);
  });
});
