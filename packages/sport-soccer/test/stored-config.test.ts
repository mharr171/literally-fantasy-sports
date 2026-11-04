import { createRng } from "@lfs/core";
import { describe, expect, it } from "vitest";
import { generateTeam } from "../src/harness";
import { DEFAULT_MATCH_TUNING, simulateMatch } from "../src/match";
import { POSITIONS } from "../src/positions";
import {
  assertValidTemplate,
  defaultStoredTemplates,
  MIRROR_PAIRS,
  mirrorTemplate,
  normalizeTemplate,
  soccerConfigFromValues,
  templateKey,
  templatesFromValues,
  templatesToRows,
} from "../src/stored-config";

const blank = () =>
  Array.from({ length: 25 }, () => new Array<number>(17).fill(0));

describe("templates as stored", () => {
  it("round-trips the built-in templates through game_config rows", () => {
    const rows = templatesToRows(defaultStoredTemplates());
    expect(rows.map((r) => r.key)).toEqual(
      POSITIONS.map((p) => `templates.${p.toLowerCase()}`),
    );
    const values = Object.fromEntries(rows.map((r) => [r.key, r.value]));
    const back = templatesFromValues(values);
    expect(Object.keys(back)).toHaveLength(12);
    expect(back.ST?.[21]?.[8]).toBeCloseTo(
      defaultStoredTemplates().ST[21]?.[8] as number,
      12,
    );
  });

  it("scales every template to a total of 1", () => {
    const g = blank();
    (g[3] as number[])[4] = 2;
    (g[10] as number[])[8] = 6;
    const n = normalizeTemplate(g);
    expect(n[3]?.[4]).toBeCloseTo(0.25);
    expect(n[10]?.[8]).toBeCloseTo(0.75);
  });

  it("rejects wrong sizes, bad values and empty templates", () => {
    expect(() => assertValidTemplate(blank().slice(1))).toThrow(/24 rows/);
    const short = blank();
    short[0] = [1];
    expect(() => assertValidTemplate(short)).toThrow(/row 0 has 1 cells/);
    const negative = blank();
    (negative[0] as number[])[0] = -1;
    expect(() => assertValidTemplate(negative)).toThrow(/invalid value/);
    expect(() => assertValidTemplate(blank(), "ST")).toThrow(/ST is empty/);
    expect(() => templatesFromValues({ "templates.st": blank() })).toThrow(
      /ST is empty/,
    );
  });

  it("mirrors left to right and pairs the wide positions", () => {
    const g = blank();
    (g[5] as number[])[0] = 1;
    expect(mirrorTemplate(g)[5]?.[16]).toBe(1);
    expect(MIRROR_PAIRS.LB).toBe("RB");
    expect(MIRROR_PAIRS.RW).toBe("LW");
    expect(MIRROR_PAIRS.ST).toBeUndefined();
    expect(templateKey("LW")).toBe("templates.lw");
  });
});

describe("soccerConfigFromValues", () => {
  it("falls back to the defaults when a version holds nothing", () => {
    const config = soccerConfigFromValues("soccer:1", {});
    expect(config.version).toBe("soccer:1");
    expect(config.tuning).toEqual(DEFAULT_MATCH_TUNING);
  });

  it("uses stored tuning values and templates over the defaults", () => {
    const st = blank();
    (st[24] as number[])[8] = 1; // a striker who only stands on the goal line
    const config = soccerConfigFromValues("soccer:2", {
      tuning: { chanceRate: 0.5 },
      [templateKey("ST")]: st,
    });
    expect(config.tuning.chanceRate).toBe(0.5);
    expect(config.tuning.shotRate).toBe(DEFAULT_MATCH_TUNING.shotRate);
    expect(config.templates.ST.values[24 * 17 + 8]).toBe(1);
    // It plays.
    const home = generateTeam(createRng("h"), "h", 60);
    const away = generateTeam(createRng("a"), "a", 60);
    const out = simulateMatch({ home, away, mode: "league", config }, 1);
    expect(
      out.result.winner === null || typeof out.result.winner === "string",
    ).toBe(true);
  });
});
