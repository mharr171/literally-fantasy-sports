import { describe, expect, it } from "vitest";
import { applyStroke, MIRROR, POSITION_LABELS, POSITION_ORDER } from "./paint";

const blank = () =>
  Array.from({ length: 25 }, () => new Array<number>(17).fill(0));
const total = (g: number[][]) => g.flat().reduce((a, b) => a + b, 0);

describe("applyStroke", () => {
  it("paints most at the centre, fading out, without touching the original", () => {
    const g = blank();
    const out = applyStroke(g, 10, 8, "paint", 3, 1);
    expect(total(g)).toBe(0);
    expect(out[10]?.[8]).toBe(1);
    expect(out[10]?.[9]).toBeCloseTo(2 / 3);
    expect(out[10]?.[12]).toBe(0);
  });

  it("paints a single cell with brush size 1", () => {
    const out = applyStroke(blank(), 0, 0, "paint", 1, 0.5);
    expect(total(out)).toBeCloseTo(0.5);
    expect(out[0]?.[0]).toBe(0.5);
  });

  it("clips the brush at the pitch edges", () => {
    const out = applyStroke(blank(), 24, 16, "paint", 5, 1);
    expect(out[24]?.[16]).toBe(1);
    expect(out).toHaveLength(25);
    expect(out[24]).toHaveLength(17);
  });

  it("erases without going below zero", () => {
    const painted = applyStroke(blank(), 5, 5, "paint", 1, 0.3);
    const erased = applyStroke(painted, 5, 5, "erase", 1, 1);
    expect(erased[5]?.[5]).toBe(0);
  });

  it("smooths a spike towards its neighbours, keeping it non-negative", () => {
    const spike = applyStroke(blank(), 12, 8, "paint", 1, 9);
    const smoothed = applyStroke(spike, 12, 8, "smooth", 2, 1);
    expect(smoothed[12]?.[8]).toBeLessThan(9);
    expect(smoothed[12]?.[9]).toBeGreaterThan(0);
    expect(smoothed.flat().every((v) => v >= 0)).toBe(true);
  });
});

describe("position lists", () => {
  it("covers all 12 positions with names, and mirrors the wide pairs both ways", () => {
    expect(new Set(POSITION_ORDER).size).toBe(12);
    for (const p of POSITION_ORDER) expect(POSITION_LABELS[p]).toBeTruthy();
    for (const [a, b] of Object.entries(MIRROR))
      expect(MIRROR[b as keyof typeof MIRROR]).toBe(a);
  });
});
