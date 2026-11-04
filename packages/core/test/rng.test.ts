import { describe, expect, it } from "vitest";
import { createRng, hashSeed } from "../src/rng";

describe("createRng", () => {
  it("produces a fixed sequence for a seed (replays depend on this never changing)", () => {
    const rng = createRng(42);
    expect([rng.next(), rng.next(), rng.next()]).toEqual([
      0.6011037519201636, 0.44829055899754167, 0.8524657934904099,
    ]);
    const dice = createRng("match-1");
    expect(Array.from({ length: 5 }, () => dice.int(1, 6))).toEqual([
      5, 3, 4, 5, 3,
    ]);
    expect(createRng(7).shuffle([1, 2, 3, 4, 5, 6, 7, 8])).toEqual([
      5, 7, 2, 3, 4, 6, 8, 1,
    ]);
  });

  it("gives the same numbers for the same seed and different ones for another", () => {
    const a = createRng("seed");
    const b = createRng("seed");
    const c = createRng("other");
    const seqA = Array.from({ length: 20 }, () => a.next());
    expect(Array.from({ length: 20 }, () => b.next())).toEqual(seqA);
    expect(Array.from({ length: 20 }, () => c.next())).not.toEqual(seqA);
  });

  it("treats numeric seeds as unsigned 32-bit integers", () => {
    expect(createRng(1.9).next()).toBe(createRng(1).next());
    expect(createRng(-1).next()).toBe(createRng(0xffffffff).next());
    expect(() => createRng(Number.NaN)).toThrow(RangeError);
    expect(() => createRng(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });

  it("keeps next() in [0, 1)", () => {
    const rng = createRng(1);
    for (let i = 0; i < 10_000; i++) {
      const x = rng.next();
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThan(1);
    }
  });

  it("rolls integers inclusively and roughly uniformly", () => {
    const rng = createRng("dice");
    const counts = [0, 0, 0, 0, 0, 0];
    const rolls = 60_000;
    for (let i = 0; i < rolls; i++) {
      const v = rng.int(1, 6);
      counts[v - 1] = (counts[v - 1] as number) + 1;
    }
    for (const c of counts)
      expect(Math.abs(c - rolls / 6)).toBeLessThan(rolls * 0.01);
    expect(rng.int(3, 3)).toBe(3);
    expect(() => rng.int(2, 1)).toThrow(RangeError);
    expect(() => rng.int(0.5, 2)).toThrow(RangeError);
  });

  it("rolls floats in range", () => {
    const rng = createRng(3);
    for (let i = 0; i < 1000; i++) {
      const x = rng.float(-2, 5);
      expect(x).toBeGreaterThanOrEqual(-2);
      expect(x).toBeLessThan(5);
    }
    expect(rng.float(4, 4)).toBe(4);
    expect(() => rng.float(5, 1)).toThrow(RangeError);
  });

  it("returns true about p of the time for chance(p), clamping p", () => {
    const rng = createRng("coin");
    let hits = 0;
    for (let i = 0; i < 20_000; i++) if (rng.chance(0.25)) hits++;
    expect(hits / 20_000).toBeCloseTo(0.25, 1);
    expect(rng.chance(0)).toBe(false);
    expect(rng.chance(-1)).toBe(false);
    expect(rng.chance(1)).toBe(true);
    expect(rng.chance(2)).toBe(true);
  });

  it("picks every element of an array eventually and rejects empty arrays", () => {
    const rng = createRng(9);
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) seen.add(rng.pick(["a", "b", "c"]));
    expect([...seen].sort()).toEqual(["a", "b", "c"]);
    expect(() => rng.pick([])).toThrow(RangeError);
  });

  it("chooses weighted indexes in proportion and never picks zero weights", () => {
    const rng = createRng("weights");
    const counts = [0, 0, 0];
    for (let i = 0; i < 30_000; i++) {
      const idx = rng.weightedIndex([1, 0, 3]);
      counts[idx] = (counts[idx] as number) + 1;
    }
    expect(counts[1]).toBe(0);
    expect((counts[2] as number) / (counts[0] as number)).toBeCloseTo(3, 0);
    expect(rng.weightedIndex([0, 0, 5])).toBe(2);
    expect(() => rng.weightedIndex([])).toThrow(RangeError);
    expect(() => rng.weightedIndex([0, 0])).toThrow(RangeError);
    expect(() => rng.weightedIndex([1, -1])).toThrow(RangeError);
    expect(() => rng.weightedIndex([1, Number.NaN])).toThrow(RangeError);
    expect(() => rng.weightedIndex([1, Number.POSITIVE_INFINITY])).toThrow(
      RangeError,
    );
  });

  it("shuffles a copy without losing or duplicating elements", () => {
    const rng = createRng(5);
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const out = rng.shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect([...out].sort((x, y) => x - y)).toEqual(input);
    expect(rng.shuffle([])).toEqual([]);
  });

  it("produces normal values with the requested mean and spread", () => {
    const rng = createRng("bell");
    const n = 40_000;
    let sum = 0;
    let sumSq = 0;
    for (let i = 0; i < n; i++) {
      const x = rng.normal(10, 2);
      sum += x;
      sumSq += x * x;
    }
    const mean = sum / n;
    const sd = Math.sqrt(sumSq / n - mean * mean);
    expect(mean).toBeCloseTo(10, 1);
    expect(sd).toBeCloseTo(2, 1);
    expect(Number.isFinite(createRng(0).normal())).toBe(true);
  });

  it("forks independent, reproducible streams without consuming the parent", () => {
    const parent = createRng(42);
    const fork = parent.fork("injuries");
    expect(fork.next()).toBe(0.2106861553620547);
    // The parent is untouched by forking.
    expect(parent.next()).toBe(0.6011037519201636);
    // Same label, same stream; different label, different stream.
    expect(createRng(42).fork("injuries").next()).toBe(0.2106861553620547);
    expect(createRng(42).fork("cards").next()).not.toBe(0.2106861553620547);
  });
});

describe("hashSeed", () => {
  it("hashes strings to fixed unsigned 32-bit integers", () => {
    expect(hashSeed("match-1")).toBe(3479080106);
    expect(hashSeed("")).toBe(451841411);
    expect(hashSeed("a")).not.toBe(hashSeed("b"));
  });
});
