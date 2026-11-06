import { describe, expect, it } from "vitest";
import {
  createRng,
  DEFAULT_AGING,
  playingTimeFactor,
  REGULAR_SHARE,
  retirementChance,
  yearlyChange,
} from "../src/index";

describe("aging (D35, D154)", () => {
  it("grows young players toward their potential, never past it", () => {
    const rng = createRng("grow");
    for (let i = 0; i < 200; i++) {
      const c = yearlyChange(rng, { age: 20, overall: 50, potential: 70 });
      expect(c).toBeGreaterThanOrEqual(1);
      expect(c).toBeLessThanOrEqual(20);
    }
    expect(yearlyChange(rng, { age: 20, overall: 70, potential: 70 })).toBe(0);
  });

  it("holds steady at peak, then declines more with age", () => {
    const rng = createRng("age");
    const at = (age: number) =>
      Array.from({ length: 200 }, () =>
        yearlyChange(rng, { age, overall: 70, potential: 70 }),
      );
    expect(at(28).every((c) => c >= -1 && c <= 1)).toBe(true);
    expect(at(31).every((c) => c <= -1 && c >= -3)).toBe(true);
    expect(at(36).every((c) => c <= -3 && c >= -6)).toBe(true);
  });

  it("grows a player who rarely played less, when playing time counts", () => {
    const growth = { weight: 1, clubMinutes: 1000 };
    expect(playingTimeFactor(1000 * REGULAR_SHARE, growth)).toBe(1);
    expect(playingTimeFactor(0, growth)).toBe(0);
    expect(playingTimeFactor(350, growth)).toBeCloseTo(0.5);
    expect(playingTimeFactor(0, undefined)).toBe(1);
    expect(playingTimeFactor(0, { weight: 0, clubMinutes: 1000 })).toBe(1);
    const rng = createRng("bench");
    const p = { age: 20, overall: 50, potential: 70, seasonMinutes: 0 };
    expect(yearlyChange(rng, p, DEFAULT_AGING, growth)).toBe(0);
    expect(
      yearlyChange(rng, { ...p, seasonMinutes: 350 }, DEFAULT_AGING, growth),
    ).toBeGreaterThanOrEqual(0);
  });

  it("retires more players the older they get", () => {
    expect(retirementChance(32)).toBe(0);
    expect(retirementChance(33)).toBe(0.1);
    expect(retirementChance(36)).toBe(0.6);
    expect(retirementChance(40)).toBe(0.85);
  });
});
