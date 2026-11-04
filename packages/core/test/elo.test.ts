import { describe, expect, it } from "vitest";
import { DEFAULT_K_FACTOR, expectedScore, updateElo } from "../src/elo";

describe("expectedScore", () => {
  it("is 0.5 for equal ratings and symmetric", () => {
    expect(expectedScore(1500, 1500)).toBe(0.5);
    expect(expectedScore(1600, 1400) + expectedScore(1400, 1600)).toBeCloseTo(
      1,
      12,
    );
  });

  it("gives about 10:1 odds for a 400-point gap", () => {
    expect(expectedScore(1900, 1500)).toBeCloseTo(10 / 11, 10);
  });
});

describe("updateElo", () => {
  it("moves equal teams by half the K-factor", () => {
    expect(updateElo(1500, 1500, 1)).toEqual({
      rating: 1516,
      opponent: 1484,
      change: 16,
    });
    expect(updateElo(1500, 1500, 0)).toEqual({
      rating: 1484,
      opponent: 1516,
      change: -16,
    });
    expect(updateElo(1500, 1500, 0.5)).toEqual({
      rating: 1500,
      opponent: 1500,
      change: 0,
    });
  });

  it("rewards upsets more than expected wins", () => {
    const upset = updateElo(1300, 1700, 1);
    const expected = updateElo(1700, 1300, 1);
    expect(upset.change).toBeGreaterThan(expected.change);
    expect(upset.change).toBe(29);
    expect(expected.change).toBe(3);
  });

  it("lets the stronger team lose points on a draw", () => {
    expect(updateElo(1700, 1300, 0.5).change).toBe(-13);
  });

  it("is zero-sum and returns whole numbers", () => {
    for (const [a, b, s] of [
      [1234, 1567, 1],
      [1801, 1799, 0.5],
      [1000, 2000, 0],
    ] as const) {
      const u = updateElo(a, b, s, 24);
      expect(u.rating + u.opponent).toBe(a + b);
      expect(Number.isInteger(u.change)).toBe(true);
      expect(Object.is(u.change, -0)).toBe(false);
    }
  });

  it("uses the K-factor given, defaulting to 32", () => {
    expect(DEFAULT_K_FACTOR).toBe(32);
    expect(updateElo(1500, 1500, 1, 10).change).toBe(5);
    expect(() => updateElo(1500, 1500, 1, 0)).toThrow(RangeError);
    expect(() => updateElo(1500, 1500, 1, Number.NaN)).toThrow(RangeError);
  });
});
