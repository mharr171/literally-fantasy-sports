import { createRng } from "@lfs/core";
import { describe, expect, it } from "vitest";
import {
  ATTRIBUTES,
  type Attributes,
  assertValidAttributes,
  assertValidWeights,
  BASEBALL_NATIONALITY_WEIGHTS,
  battingRating,
  COLOR_COUNT,
  DEFAULT_OVERALL_WEIGHTS,
  FIELD_POSITIONS,
  fieldingRating,
  generatePlayer,
  isPosition,
  overallAt,
  POSITION_NAMES,
  POSITIONS,
  playerOverall,
  ratingSlot,
  SECONDARY_OPTIONS,
} from "../src/index";

const flat = (v: number): Attributes =>
  Object.fromEntries(ATTRIBUTES.map((k) => [k, v])) as Attributes;

describe("baseball positions (D195)", () => {
  it("has the pitcher, eight fielders and the DH, each named", () => {
    expect(POSITIONS).toHaveLength(10);
    expect(FIELD_POSITIONS).toHaveLength(8);
    for (const p of POSITIONS) expect(POSITION_NAMES[p]).toBeTruthy();
    expect(isPosition("SS")).toBe(true);
    expect(isPosition("GK")).toBe(false);
  });

  it("rates a pitcher by role and a batter by position", () => {
    expect(ratingSlot("P")).toBe("SP");
    expect(ratingSlot("P", "reliever")).toBe("RP");
    expect(ratingSlot("CF", "reliever")).toBe("CF");
  });

  it("gives pitchers no secondary position, and batters only batter ones", () => {
    expect(SECONDARY_OPTIONS.P).toEqual([]);
    for (const p of POSITIONS)
      for (const s of SECONDARY_OPTIONS[p]) {
        expect(s).not.toBe("P");
        expect(s).not.toBe(p);
      }
  });
});

describe("baseball ratings (D198, D212)", () => {
  it("has valid default weights, and refuses bad ones", () => {
    expect(() => assertValidWeights(DEFAULT_OVERALL_WEIGHTS)).not.toThrow();
    expect(() =>
      assertValidWeights({
        ...DEFAULT_OVERALL_WEIGHTS,
        batting: { contact: 0.5 },
      }),
    ).toThrow(/sum to 0.5/);
    expect(() =>
      assertValidWeights({
        ...DEFAULT_OVERALL_WEIGHTS,
        pitching: {
          ...DEFAULT_OVERALL_WEIGHTS.pitching,
          RP: { velocity: -1, control: 2 },
        },
      }),
    ).toThrow(/Invalid weight/);
    expect(() =>
      assertValidWeights({
        ...DEFAULT_OVERALL_WEIGHTS,
        battingShare: { ...DEFAULT_OVERALL_WEIGHTS.battingShare, SS: 1.5 },
      }),
    ).toThrow(/batting share/);
  });

  it("refuses attributes outside 1–99", () => {
    expect(() => assertValidAttributes({ ...flat(50), power: 0 })).toThrow(
      /power/,
    );
    expect(() => overallAt({ ...flat(50), arm: 50.5 }, "SS")).toThrow();
  });

  it("mixes Bat and Field by position, and pitching by role", () => {
    const a = { ...flat(50), contact: 80, power: 80, eye: 80, speed: 80 };
    expect(battingRating(a)).toBe(80);
    expect(fieldingRating(a, "SS")).toBe(50);
    expect(fieldingRating(a, "DH")).toBeNull();
    // The DH is all bat; a shortstop is 45% bat.
    expect(overallAt(a, "DH")).toBe(80);
    expect(overallAt(a, "SS")).toBe(Math.round(80 * 0.45 + 50 * 0.55));
    expect(overallAt(a, "1B")).toBeGreaterThan(overallAt(a, "C"));
    // Stamina counts more for a starter than a reliever.
    const tireless = { ...flat(50), stamina: 90 };
    expect(overallAt(tireless, "SP")).toBeGreaterThan(
      overallAt(tireless, "RP"),
    );
  });

  it("puts a player's headline overall at their position and role", () => {
    const a = { ...flat(50), stamina: 90 };
    const base = { attributes: a, primaryPosition: "P" as const };
    expect(playerOverall({ ...base, pitcherRole: "starter" })).toBe(
      overallAt(a, "SP"),
    );
    expect(playerOverall({ ...base, pitcherRole: "reliever" })).toBe(
      overallAt(a, "RP"),
    );
    expect(playerOverall({ ...base, pitcherRole: null })).toBe(
      overallAt(a, "SP"),
    );
    expect(
      playerOverall({
        attributes: a,
        primaryPosition: "LF",
        pitcherRole: null,
      }),
    ).toBe(overallAt(a, "LF"));
  });
});

describe("generating baseball players (ADR 0008 §2)", () => {
  const many = (position: (typeof POSITIONS)[number], n = 400) =>
    Array.from({ length: n }, (_, i) =>
      generatePlayer(createRng(`${position}-${i}`), {
        position,
        overall: 40 + (i % 50),
      }),
    );

  it("replays exactly from the seed", () => {
    const a = generatePlayer(createRng("same"), {
      position: "SS",
      overall: 62,
    });
    const b = generatePlayer(createRng("same"), {
      position: "SS",
      overall: 62,
    });
    expect(a).toEqual(b);
  });

  it("hits the asked overall at every position", () => {
    for (const position of POSITIONS)
      for (const [i, p] of many(position, 100).entries()) {
        expect(Math.abs(p.overall - (40 + (i % 50)))).toBeLessThanOrEqual(1);
        expect(p.potential).toBeGreaterThanOrEqual(p.overall);
        expect(p.potentialRange[0]).toBeLessThanOrEqual(p.potential);
        expect(p.potentialRange[1]).toBeGreaterThanOrEqual(p.potential);
        expect(p.age).toBeGreaterThanOrEqual(18);
        expect(p.age).toBeLessThanOrEqual(37);
        expect(() => assertValidAttributes(p.attributes)).not.toThrow();
      }
  });

  it("makes pitchers pitch and batters bat (no two-way players)", () => {
    for (const p of many("P")) {
      expect(p.pitcherRole).not.toBeNull();
      expect(p.secondaryPosition).toBeNull();
      expect(battingRating(p.attributes)).toBeLessThan(35);
    }
    for (const p of many("CF")) {
      expect(p.pitcherRole).toBeNull();
      expect(p.attributes.velocity).toBeLessThan(35);
    }
  });

  it("keeps a pitcher's asked role, and splits rolled roles about evenly", () => {
    expect(
      generatePlayer(createRng("r"), {
        position: "P",
        overall: 60,
        role: "reliever",
      }).pitcherRole,
    ).toBe("reliever");
    const starters = many("P").filter((p) => p.pitcherRole === "starter");
    expect(starters.length).toBeGreaterThan(150);
    expect(starters.length).toBeLessThan(250);
  });

  it("leans some fielders to Bat and some to Field, overall unchanged (D212)", () => {
    const gaps = Array.from({ length: 400 }, (_, i) => {
      const p = generatePlayer(createRng(`ss${i}`), {
        position: "SS",
        overall: 60,
      });
      expect(Math.abs(p.overall - 60)).toBeLessThanOrEqual(1);
      return (
        battingRating(p.attributes) - (fieldingRating(p.attributes, "SS") ?? 0)
      );
    });
    expect(gaps.filter((g) => g >= 8).length).toBeGreaterThan(40);
    expect(gaps.filter((g) => g <= -8).length).toBeGreaterThan(40);
  });

  it("draws baseball's nationalities, led by the USA (D203)", () => {
    const counts = new Map<string, number>();
    for (const p of many("2B", 2000))
      counts.set(p.nationality, (counts.get(p.nationality) ?? 0) + 1);
    for (const code of counts.keys())
      expect(BASEBALL_NATIONALITY_WEIGHTS).toHaveProperty(code);
    const top = [...counts].sort((a, b) => b[1] - a[1]).map(([k]) => k);
    expect(top.slice(0, 3)).toEqual(["USA", "DOM", "VEN"]);
  });

  it("rolls one of 4 colors, or one of the colors a pack allows (D200)", () => {
    expect(COLOR_COUNT).toBe(4);
    const colors = new Set(many("C").map((p) => p.chemistryColor));
    expect(colors).toEqual(new Set([0, 1, 2, 3]));
    for (let i = 0; i < 50; i++)
      expect(
        generatePlayer(createRng(`c${i}`), {
          position: "C",
          overall: 50,
          colors: [1, 3],
        }).chemistryColor,
      ).toSatisfy((c: number) => c === 1 || c === 3);
  });

  it("clamps an asked overall to 1–99", () => {
    expect(
      generatePlayer(createRng("hi"), { position: "DH", overall: 140 }).overall,
    ).toBeGreaterThanOrEqual(97);
    expect(
      generatePlayer(createRng("lo"), { position: "DH", overall: -5 }).overall,
    ).toBeLessThanOrEqual(3);
  });
});

describe("player presets (D211)", () => {
  it("gives batters a zone and spray preset, and pitchers a location one", () => {
    const batter = generatePlayer(createRng("zp"), {
      position: "LF",
      overall: 60,
    });
    expect(batter.zoneProfile).not.toBeNull();
    expect(batter.sprayProfile).not.toBeNull();
    expect(batter.locationProfile).toBeNull();
    const pitcher = generatePlayer(createRng("zp"), {
      position: "P",
      overall: 60,
    });
    expect(pitcher.locationProfile).not.toBeNull();
    expect(pitcher.zoneProfile).toBeNull();
    expect(pitcher.sprayProfile).toBeNull();
  });

  it("rolls presets on their own stream: attributes and names don't move", () => {
    // The same seed gives the same player whatever the presets: generation
    // forks "profiles" separately, so earlier parts are unchanged.
    const a = generatePlayer(createRng("same-bio"), {
      position: "SS",
      overall: 60,
    });
    expect(a.attributes).toEqual(
      generatePlayer(createRng("same-bio"), { position: "SS", overall: 60 })
        .attributes,
    );
  });
});
