import { describe, expect, it } from "vitest";
import {
  currentEnergy,
  DEFAULT_ENERGY_SETTINGS,
  spendEnergy,
} from "../src/energy";

const t0 = new Date("2026-11-04T12:00:00Z");
const at = (minutes: number) => new Date(t0.getTime() + minutes * 60_000);
/** A maximum of 3, so the refill and spend cases stay short. */
const three = { enabled: true, refillMinutes: 15, max: 3 };

describe("energy (D93)", () => {
  it("defaults to 1 point every 15 minutes, up to 6 (D118)", () => {
    expect(DEFAULT_ENERGY_SETTINGS).toEqual({
      enabled: true,
      refillMinutes: 15,
      max: 6,
    });
  });

  it("refills one point per interval, never past the maximum", () => {
    const stored = { energy: 0, updatedAt: t0 };
    expect(currentEnergy(stored, at(14), three).energy).toBe(0);
    expect(currentEnergy(stored, at(14), three).nextAt).toEqual(at(15));
    expect(currentEnergy(stored, at(15), three).energy).toBe(1);
    expect(currentEnergy(stored, at(31), three)).toEqual({
      energy: 2,
      updatedAt: at(30),
      nextAt: at(45),
    });
    expect(currentEnergy(stored, at(500), three)).toEqual({
      energy: 3,
      updatedAt: at(500),
      nextAt: null,
    });
  });

  it("treats a stored value above the maximum as full, and ignores clock skew", () => {
    expect(
      currentEnergy({ energy: 5, updatedAt: t0 }, at(1), three).energy,
    ).toBe(3);
    expect(currentEnergy({ energy: 1, updatedAt: at(10) }, t0, three)).toEqual({
      energy: 1,
      updatedAt: at(10),
      nextAt: at(25),
    });
  });

  it("spends a point, starting the clock from full or keeping it running", () => {
    expect(spendEnergy({ energy: 3, updatedAt: t0 }, at(100), three)).toEqual({
      energy: 2,
      updatedAt: at(100),
    });
    // 1 stored at t0, 20 minutes later it's 2 (refilled at 15) and the clock runs from 15.
    expect(spendEnergy({ energy: 1, updatedAt: t0 }, at(20), three)).toEqual({
      energy: 1,
      updatedAt: at(15),
    });
    expect(() =>
      spendEnergy({ energy: 0, updatedAt: t0 }, at(5), three),
    ).toThrow(/Out of energy/);
  });

  it("rejects a non-positive refill time", () => {
    expect(() =>
      currentEnergy({ energy: 0, updatedAt: t0 }, t0, {
        enabled: true,
        refillMinutes: 0,
        max: 3,
      }),
    ).toThrow(/positive/);
  });
});
