import { getPath } from "@lfs/core";
import { describe, expect, it } from "vitest";
import {
  BASEBALL_SETTING_GROUPS,
  BASEBALL_SETTING_PATHS,
  baseballConfigFromValues,
  baseballConfigToRows,
  baseballSettingsErrors,
  defaultBaseballConfig,
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
