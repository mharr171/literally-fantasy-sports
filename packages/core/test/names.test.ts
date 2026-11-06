import { describe, expect, it } from "vitest";
import {
  EQUAL_NATIONALITY_WEIGHTS,
  generateName,
  NAME_POOLS,
  NATIONALITY_CODES,
  pickNationality,
} from "../src/names";
import { createRng } from "../src/rng";

describe("name pools (D10, D38)", () => {
  it("covers 29 nationalities across Europe, Africa, Asia and the Americas", () => {
    expect(NATIONALITY_CODES).toHaveLength(29);
    for (const code of [
      "ENG",
      "BRA",
      "NGA",
      "JPN",
      "USA",
      "EGY",
      "IND",
      "KSA",
    ]) {
      expect(NATIONALITY_CODES).toContain(code);
    }
  });

  it("has 40 distinct first names and 40 distinct surnames per nationality", () => {
    for (const code of NATIONALITY_CODES) {
      const pool = NAME_POOLS[code];
      expect(pool.name.length, code).toBeGreaterThan(0);
      expect(new Set(pool.firstNames).size, `${code} first names`).toBe(40);
      expect(new Set(pool.lastNames).size, `${code} surnames`).toBe(40);
      for (const n of [...pool.firstNames, ...pool.lastNames]) {
        expect(n, code).toBe(n.trim());
        expect(n, code).toMatch(/^\p{L}[\p{L}' -]*\p{L}$/u);
      }
    }
  });
});

describe("generateName", () => {
  it("draws both names from the nationality's pool", () => {
    const rng = createRng("names");
    for (const code of NATIONALITY_CODES) {
      const name = generateName(rng, code);
      const pool = NAME_POOLS[code];
      expect(pool.firstNames).toContain(name.firstName);
      expect(pool.lastNames).toContain(name.lastName);
    }
  });

  it("puts the family name first where that's the custom", () => {
    const rng = createRng("order");
    const jp = generateName(rng, "JPN");
    expect(jp.displayName).toBe(`${jp.lastName} ${jp.firstName}`);
    const br = generateName(rng, "BRA");
    expect(br.displayName).toBe(`${br.firstName} ${br.lastName}`);
  });

  it("is reproducible from the seed", () => {
    const a = Array.from({ length: 10 }, (_, i) =>
      generateName(createRng(i), "ESP"),
    );
    const b = Array.from({ length: 10 }, (_, i) =>
      generateName(createRng(i), "ESP"),
    );
    expect(b).toEqual(a);
  });

  it("produces plenty of different names", () => {
    const rng = createRng("variety");
    const names = new Set(
      Array.from({ length: 500 }, () => generateName(rng, "ITA").displayName),
    );
    expect(names.size).toBeGreaterThan(400);
  });
});

describe("pickNationality", () => {
  it("spreads evenly by default", () => {
    const rng = createRng("spread");
    const counts = new Map<string, number>();
    for (let i = 0; i < 29_000; i++) {
      const code = pickNationality(rng);
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    expect(counts.size).toBe(29);
    for (const c of counts.values())
      expect(Math.abs(c - 1000)).toBeLessThan(150);
    expect(Object.keys(EQUAL_NATIONALITY_WEIGHTS)).toHaveLength(29);
  });

  it("follows per-sport weights and skips unlisted nationalities", () => {
    const rng = createRng("weighted");
    const picks = Array.from({ length: 2000 }, () =>
      pickNationality(rng, { USA: 3, MEX: 1 }),
    );
    expect(new Set(picks)).toEqual(new Set(["USA", "MEX"]));
    const usa = picks.filter((p) => p === "USA").length;
    expect(usa / 2000).toBeCloseTo(0.75, 1);
  });
});
