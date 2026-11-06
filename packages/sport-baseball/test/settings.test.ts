import { createRng, DEFAULT_PAYOUTS, getPath } from "@lfs/core";
import { describe, expect, it } from "vitest";
import {
  BASEBALL_SETTING_GROUPS,
  BASEBALL_SETTING_PATHS,
  baseballConfigFromValues,
  baseballConfigToRows,
  baseballSettingsErrors,
  DEFAULT_GENERATION_SETTINGS,
  DEFAULT_REST,
  defaultBaseballBalance,
  defaultBaseballConfig,
  generatePlayer,
  generationSettings,
  relieverRestDays,
  starterRestDays,
} from "../src";

describe("baseball's balance settings (ADR 0008 §9)", () => {
  const defaults = defaultBaseballConfig();
  const values = Object.fromEntries(
    baseballConfigToRows(defaults).map((r) => [r.key, r.value]),
  );

  it("lists every path once, each a number in the config within its limits", () => {
    expect(new Set(BASEBALL_SETTING_PATHS).size).toBe(
      BASEBALL_SETTING_PATHS.length,
    );
    for (const g of BASEBALL_SETTING_GROUPS)
      for (const f of g.fields) {
        const v = getPath(defaults, f.path);
        expect(typeof v, f.path).toBe("number");
        expect(v as number, f.path).toBeGreaterThanOrEqual(f.limit.min);
        expect(v as number, f.path).toBeLessThanOrEqual(f.limit.max);
      }
    expect(baseballSettingsErrors(values)).toEqual([]);
  });

  it("round-trips through stored rows", () => {
    expect(baseballConfigFromValues(values)).toEqual(defaults);
    const changed = baseballConfigFromValues({
      ...values,
      "skill.homeBoost": 0.05,
      "pitch.stealTry": 0.1,
    });
    expect(changed.skill.homeBoost).toBe(0.05);
    expect(changed.pitch.stealTry).toBe(0.1);
    // Other parts of the config stay as they were.
    expect(changed.fielding).toEqual(defaults.fielding);
  });

  it("keeps the default for an unknown, out-of-range or non-number value", () => {
    const c = baseballConfigFromValues({
      "skill.homeBoost": 5,
      "pitch.stealTry": "lots",
      "fatigue.tiredMargin": 2.5,
      "nonsense.path": 1,
    });
    expect(c).toEqual(defaults);
    expect(
      baseballSettingsErrors({
        ...values,
        "skill.homeBoost": 5,
        "pitch.stealTry": "x",
        "fatigue.tiredMargin": 2.5,
      }),
    ).toEqual([
      expect.stringContaining("must be a number"),
      expect.stringContaining("whole number"),
      expect.stringContaining("Home advantage must be 0–0.2"),
    ]);
  });
});

describe("baseball's balance settings (ADR 0009 §6, §7)", () => {
  it("stores payouts, pack prices, rest, form and generation with the rest", () => {
    const groups = BASEBALL_SETTING_PATHS.filter((p) =>
      p.startsWith("balance."),
    );
    expect(groups).toContain("balance.payouts.perMatch");
    expect(groups).toContain("balance.packs.tiers.gold");
    expect(groups).toContain("balance.condition.rest.starterAfter100");
    expect(groups).toContain("balance.form.formEffect");
    expect(groups).toContain("balance.generation.leftyPitcherShare");
    const c = baseballConfigFromValues({
      "balance.payouts.win": 250,
      "balance.packs.tiers.basic": 6_000,
      "balance.condition.rest.starterAfter100": 6,
    });
    expect(c.balance.payouts.win).toBe(250);
    expect(c.balance.packs.tiers.basic).toBe(6_000);
    expect(c.balance.packs.tiers.gold).toBe(30_000);
    expect(c.balance.condition.rest.starterAfter100).toBe(6);
    const rows = Object.fromEntries(
      baseballConfigToRows(c).map((r) => [r.key, r.value]),
    );
    expect(rows["balance.payouts.win"]).toBe(250);
  });

  it("proposes 120 a game, 180 a win and Elo K 8, postseason bonuses as soccer's", () => {
    const { payouts } = defaultBaseballBalance();
    expect(payouts).toMatchObject({
      perMatch: 120,
      win: 180,
      draw: 0,
      eloK: 8,
    });
    expect(payouts.champion).toBe(DEFAULT_PAYOUTS.champion);
    // A .500 season of 42 games earns about 9,000.
    expect(42 * payouts.perMatch + 21 * payouts.win).toBe(8_820);
  });

  it("feeds rest rules and generation numbers to the engine", () => {
    const rest = { ...DEFAULT_REST, starterAfter100: 6, relieverPitches: 15 };
    expect(starterRestDays(105, rest)).toBe(6);
    expect(starterRestDays(105)).toBe(5);
    expect(relieverRestDays(20, false, rest)).toBe(1);
    expect(relieverRestDays(20, false)).toBe(0);
    const g = generationSettings({
      generation: {
        ...defaultBaseballBalance().generation,
        leftyPitcherShare: 1,
      },
    });
    expect(g.leftyPitcherShare).toBe(1);
    expect(g.minAge).toBe(DEFAULT_GENERATION_SETTINGS.minAge);
    const lefty = generatePlayer(createRng("all-left"), {
      position: "P",
      overall: 60,
      settings: g,
    });
    expect(lefty.throws).toBe("L");
  });

  it("refuses balance values outside their limits", () => {
    const values = Object.fromEntries(
      baseballConfigToRows(defaultBaseballConfig()).map((r) => [
        r.key,
        r.value,
      ]),
    );
    expect(
      baseballSettingsErrors({ ...values, "balance.packs.tiers.basic": 100 }),
    ).toEqual(["Basic pack must be 500–500000."]);
    expect(
      baseballSettingsErrors({ ...values, "balance.payouts.eloK": 2.5 }),
    ).toEqual(["Elo K per game must be a whole number."]);
  });
});
