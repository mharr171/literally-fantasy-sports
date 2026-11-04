import { describe, expect, it } from "vitest";
import {
  ageFactor,
  DEFAULT_WORTH_SETTINGS,
  playerWorth,
  resalePrice,
} from "../src/worth";

const flat = (overall: number): [number, number] => [overall, overall];

describe("playerWorth (D85)", () => {
  it("matches the approved examples", () => {
    expect(
      playerWorth({ overall: 55, age: 26, potentialRange: flat(55) }),
    ).toBe(1450);
    expect(
      playerWorth({ overall: 55, age: 19, potentialRange: [60, 70] }),
    ).toBe(2450);
    expect(
      playerWorth({ overall: 70, age: 27, potentialRange: flat(70) }),
    ).toBe(4650);
    expect(
      playerWorth({ overall: 80, age: 30, potentialRange: flat(80) }),
    ).toBe(8050);
    expect(
      playerWorth({ overall: 90, age: 25, potentialRange: flat(90) }),
    ).toBe(21700);
  });

  it("is 1,000 for a 50-overall player in their prime, doubling about every 9 points", () => {
    expect(
      playerWorth({ overall: 50, age: 25, potentialRange: flat(50) }),
    ).toBe(1000);
    expect(
      playerWorth({ overall: 59, age: 25, potentialRange: flat(59) }),
    ).toBe(2000);
  });

  it("rises with overall and shown potential, falls with age", () => {
    const base = { overall: 60, age: 25, potentialRange: flat(60) };
    expect(
      playerWorth({ ...base, overall: 61, potentialRange: flat(61) }),
    ).toBeGreaterThan(playerWorth(base));
    expect(playerWorth({ ...base, potentialRange: [64, 74] })).toBeGreaterThan(
      playerWorth(base),
    );
    expect(playerWorth({ ...base, age: 33 })).toBeLessThan(
      playerWorth({ ...base, age: 30 }),
    );
    expect(playerWorth({ ...base, age: 30 })).toBeLessThan(playerWorth(base));
  });

  it("never goes below the rounding step, even for the weakest players", () => {
    expect(playerWorth({ overall: 1, age: 40, potentialRange: flat(1) })).toBe(
      50,
    );
  });

  it("ignores a shown range below the current overall", () => {
    expect(
      playerWorth({ overall: 60, age: 25, potentialRange: [50, 55] }),
    ).toBe(playerWorth({ overall: 60, age: 25, potentialRange: flat(60) }));
  });
});

describe("ageFactor", () => {
  it("uses the age bands", () => {
    expect([17, 21, 22, 29, 30, 31, 32, 40].map((a) => ageFactor(a))).toEqual([
      1.2, 1.2, 1, 1, 0.8, 0.8, 0.6, 0.6,
    ]);
  });
});

describe("resalePrice", () => {
  it("pays 25% of worth, rounded, and at least the rounding step", () => {
    expect(DEFAULT_WORTH_SETTINGS.resaleRate).toBe(0.25);
    expect(resalePrice(1450)).toBe(350);
    expect(resalePrice(21700)).toBe(5450);
    expect(resalePrice(50)).toBe(50);
  });
});
