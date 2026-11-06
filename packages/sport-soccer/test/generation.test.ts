import {
  createRng,
  NAME_POOLS,
  NATIONALITY_CODES,
  pickNationality,
} from "@lfs/core";
import { describe, expect, it } from "vitest";
import { ATTRIBUTES } from "../src/attributes";
import {
  DEFAULT_GENERATION_SETTINGS,
  DEFAULT_TEMPLATE_VARIANT,
  generatePack,
  generatePlayer,
  PACK_SIZE,
  positionsFor,
  SECONDARY_OPTIONS,
  SOCCER_NATIONALITY_WEIGHTS,
  STARTER_PACKS,
  STARTER_TIER,
} from "../src/generation";
import { overallAt } from "../src/overall";
import { POSITION_LINE, POSITIONS } from "../src/positions";

describe("generatePlayer", () => {
  it("hits the requested overall at the requested position", () => {
    const rng = createRng("targets");
    for (const position of POSITIONS) {
      for (const target of [35, 55, 75, 92]) {
        const p = generatePlayer(rng.fork(`${position}-${target}`), {
          position,
          overall: target,
        });
        expect(
          Math.abs(p.overall - target),
          `${position} ${target}`,
        ).toBeLessThanOrEqual(1);
        expect(p.overall).toBe(overallAt(p.attributes, position));
        expect(p.primaryPosition).toBe(position);
      }
    }
  });

  it("keeps every attribute a whole number from 1 to 99, with extremes clamped", () => {
    const rng = createRng("ranges");
    for (const overall of [-5, 1, 50, 99, 150]) {
      const p = generatePlayer(rng.fork(String(overall)), {
        position: "CM",
        overall,
      });
      for (const key of ATTRIBUTES) {
        expect(Number.isInteger(p.attributes[key])).toBe(true);
        expect(p.attributes[key]).toBeGreaterThanOrEqual(1);
        expect(p.attributes[key]).toBeLessThanOrEqual(99);
      }
    }
  });

  it("makes outfielders poor keepers and keepers good ones", () => {
    const rng = createRng("keepers");
    const gk = generatePlayer(rng.fork("gk"), { position: "GK", overall: 70 });
    const st = generatePlayer(rng.fork("st"), { position: "ST", overall: 70 });
    expect(gk.attributes.goalkeeping).toBeGreaterThan(60);
    expect(st.attributes.goalkeeping).toBeLessThan(35);
  });

  it("gives ages in range, potential at least the overall, and a range that contains it", () => {
    const rng = createRng("bio");
    const s = DEFAULT_GENERATION_SETTINGS;
    let youngGrowth = 0;
    let oldGrowth = 0;
    for (let i = 0; i < 400; i++) {
      const p = generatePlayer(rng.fork(String(i)), {
        position: "CB",
        overall: 60,
      });
      expect(p.age).toBeGreaterThanOrEqual(s.minAge);
      expect(p.age).toBeLessThanOrEqual(s.maxAge);
      expect(p.potential).toBeGreaterThanOrEqual(p.overall);
      expect(p.potential).toBeLessThanOrEqual(99);
      const [lo, hi] = p.potentialRange;
      expect(lo).toBeLessThanOrEqual(p.potential);
      expect(hi).toBeGreaterThanOrEqual(p.potential);
      expect(lo).toBeGreaterThanOrEqual(p.overall);
      if (p.age <= 21)
        youngGrowth = Math.max(youngGrowth, p.potential - p.overall);
      if (p.age >= s.peakAge)
        oldGrowth = Math.max(oldGrowth, p.potential - p.overall);
    }
    expect(youngGrowth).toBeGreaterThan(5);
    expect(oldGrowth).toBe(0);
  });

  it("keeps the potential range within 99 for top players", () => {
    const p = generatePlayer(createRng("star"), {
      position: "ST",
      overall: 97,
    });
    expect(p.potentialRange[1]).toBeLessThanOrEqual(99);
    expect(p.potentialRange[0]).toBeLessThanOrEqual(p.potential);
  });

  it("picks sensible secondary positions, and none for keepers", () => {
    const rng = createRng("secondary");
    let withSecondary = 0;
    for (let i = 0; i < 200; i++) {
      const p = generatePlayer(rng.fork(String(i)), {
        position: "LB",
        overall: 60,
      });
      if (p.secondaryPosition) {
        withSecondary++;
        expect(SECONDARY_OPTIONS.LB).toContain(p.secondaryPosition);
      }
    }
    expect(withSecondary / 200).toBeGreaterThan(0.45);
    expect(withSecondary / 200).toBeLessThan(0.75);
    expect(
      generatePlayer(rng, { position: "GK", overall: 60 }).secondaryPosition,
    ).toBeNull();
  });

  it("styles the name by nationality and gives a chemistry colour 0–4", () => {
    const p = generatePlayer(createRng("name"), {
      position: "AM",
      overall: 60,
    });
    expect(NAME_POOLS[p.nationality].lastNames).toContain(p.lastName);
    expect(p.chemistryColor).toBeGreaterThanOrEqual(0);
    expect(p.chemistryColor).toBeLessThanOrEqual(4);
  });

  it("assigns one of the position's available template variants, else the default (D84)", () => {
    expect(
      generatePlayer(createRng("v"), { position: "LB", overall: 60 })
        .templateVariant,
    ).toBe(DEFAULT_TEMPLATE_VARIANT);
    const settings = {
      ...DEFAULT_GENERATION_SETTINGS,
      templateVariants: { LB: ["attacking", "defensive"], ST: [] },
    };
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      seen.add(
        generatePlayer(createRng(i), { position: "LB", overall: 60, settings })
          .templateVariant,
      );
    }
    expect(seen).toEqual(new Set(["attacking", "defensive"]));
    expect(
      generatePlayer(createRng(1), { position: "ST", overall: 60, settings })
        .templateVariant,
    ).toBe(DEFAULT_TEMPLATE_VARIANT);
  });

  it("is reproducible from the seed", () => {
    const a = generatePlayer(createRng("same"), {
      position: "RW",
      overall: 66,
    });
    const b = generatePlayer(createRng("same"), {
      position: "RW",
      overall: 66,
    });
    expect(b).toEqual(a);
  });
});

describe("packs (D47, D83)", () => {
  it("has the 22 starter packs Gary specified", () => {
    const counts = Object.fromEntries(
      STARTER_PACKS.map((p) => [p.focus, p.count]),
    );
    expect(counts).toEqual({
      attack: 2,
      midfield: 4,
      defence: 4,
      goal: 1,
      any: 11,
    });
    expect(STARTER_PACKS.reduce((a, p) => a + p.count, 0)).toBe(22);
  });

  it("maps each focus to its line's positions", () => {
    expect(positionsFor("goal")).toEqual(["GK"]);
    expect(positionsFor("defence")).toEqual(["CB", "LB", "RB"]);
    expect(positionsFor("attack")).toEqual(["LW", "RW", "ST"]);
    expect(positionsFor("midfield")).toHaveLength(5);
    expect(positionsFor("any")).toHaveLength(12);
  });

  it("opens 5 players of the pack's positions, within the tier's range", () => {
    const rng = createRng("packs");
    for (const { focus } of STARTER_PACKS) {
      const pack = generatePack(rng.fork(focus), focus, STARTER_TIER);
      expect(pack).toHaveLength(PACK_SIZE);
      for (const p of pack) {
        expect(positionsFor(focus)).toContain(p.primaryPosition);
        expect(p.overall).toBeGreaterThanOrEqual(STARTER_TIER.min - 1);
        expect(p.overall).toBeLessThanOrEqual(STARTER_TIER.max + 1);
      }
    }
  });

  it("gives a full set of starter packs a playable spread of positions and levels", () => {
    const rng = createRng("starter-set");
    const players = STARTER_PACKS.flatMap(({ focus, count }) =>
      Array.from({ length: count }, (_, i) =>
        generatePack(rng.fork(`${focus}-${i}`), focus, STARTER_TIER),
      ).flat(),
    );
    expect(players).toHaveLength(110);
    const keepers = players.filter((p) => p.primaryPosition === "GK").length;
    expect(keepers).toBeGreaterThanOrEqual(PACK_SIZE);
    for (const line of ["defence", "midfield", "attack"] as const) {
      expect(
        players.filter((p) => POSITION_LINE[p.primaryPosition] === line).length,
      ).toBeGreaterThan(11);
    }
    const mean = players.reduce((a, p) => a + p.overall, 0) / players.length;
    expect(mean).toBeGreaterThan(52);
    expect(mean).toBeLessThan(58);
  });

  it("is reproducible from the pack seed", () => {
    expect(generatePack(createRng("p1"), "any", STARTER_TIER)).toEqual(
      generatePack(createRng("p1"), "any", STARTER_TIER),
    );
  });
});

describe("soccer's nationalities (D10, D203)", () => {
  // The 25 pools soccer has always used, in their order in NATIONALITY_CODES.
  const ORIGINAL = Object.keys(SOCCER_NATIONALITY_WEIGHTS);

  it("stay the original 25 when pools are added for other sports", () => {
    expect(ORIGINAL).toHaveLength(25);
    expect(NATIONALITY_CODES.slice(0, 25)).toEqual(ORIGINAL);
  });

  it("pick exactly as before, so a pack's seed makes the same players", () => {
    for (let i = 0; i < 500; i++) {
      const before =
        ORIGINAL[createRng(`n${i}`).weightedIndex(ORIGINAL.map(() => 1))];
      expect(
        pickNationality(createRng(`n${i}`), SOCCER_NATIONALITY_WEIGHTS),
      ).toBe(before);
    }
  });
});
