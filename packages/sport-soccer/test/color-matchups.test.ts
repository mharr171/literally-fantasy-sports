import { createRng } from "@lfs/core";
import { describe, expect, it } from "vitest";
import {
  balanceErrors,
  balanceFromValues,
  balanceToRows,
  DEFAULT_BALANCE,
} from "../src/balance";
import { colorMatchups, dominantMatchup } from "../src/color-matchup";
import { generateTeam } from "../src/harness";
import {
  colorCycleError,
  defaultSoccerConfig,
  PROPOSED_MATCHUPS,
  SOCCER_COLOR_CYCLE,
  type SoccerTeam,
  simulateMatch,
} from "../src/match";

const base = defaultSoccerConfig();
const on = { ...base, tuning: { ...base.tuning, ...PROPOSED_MATCHUPS } };

/** A team with every player recoloured: `colors` gives each starter's color. */
const paint = (team: SoccerTeam, colors: number[]): SoccerTeam => ({
  ...team,
  lineup: team.lineup.map((s, i) => ({
    ...s,
    player: {
      ...s.player,
      chemistryColor: colors[i % colors.length] as number,
    },
  })),
  bench: (team.bench ?? []).map((p) => ({
    ...p,
    chemistryColor: colors[0] as number,
  })),
});

describe("color matchups in matches (D119, ADR 0003)", () => {
  it("are off by default and in settings without them", () => {
    expect(base.tuning.teamMatchup).toBe(0);
    expect(base.tuning.teamMatchupSecond).toBe(0);
    expect(base.tuning.playerMatchup).toBe(0);
    // A version saved before ADR 0003 has no matchup values: they're off.
    const old = balanceFromValues({ tuning: { phases: 30, chanceRate: 0.34 } });
    expect(old.tuning.teamMatchup).toBe(0);
    expect(old.tuning.playerMatchup).toBe(0);
    const saved = balanceFromValues({ tuning: { ...PROPOSED_MATCHUPS } });
    expect(saved.tuning.teamMatchup).toBe(PROPOSED_MATCHUPS.teamMatchup);
  });

  it("raise the influence of the side whose colors win, and lower the other's", () => {
    const home = generateTeam(createRng("cm-h"), "h", 60);
    const away = generateTeam(createRng("cm-a"), "a", 60);
    // All Red (0) against all Green (2): Red beats Green.
    const red = paint(home, [0]);
    const green = paint(away, [2]);
    const total = (
      m: ReturnType<typeof simulateMatch>,
      side: "home" | "away",
    ) => [...m.influence[side].values].reduce((a, b) => a + b, 0);
    const offMatch = simulateMatch(
      { home: red, away: green, mode: "league", config: base },
      "cm",
    );
    const onMatch = simulateMatch(
      { home: red, away: green, mode: "league", config: on },
      "cm",
    );
    expect(total(onMatch, "home")).toBeGreaterThan(total(offMatch, "home"));
    expect(total(onMatch, "away")).toBeLessThan(total(offMatch, "away"));
  });

  it("make no difference between teams of the same color", () => {
    const home = paint(generateTeam(createRng("cm-h"), "h", 60), [1]);
    const away = paint(generateTeam(createRng("cm-a"), "a", 60), [1]);
    const play = (config: typeof base) =>
      simulateMatch({ home, away, mode: "league", config }, "same");
    expect(play(on).result).toEqual(play(base).result);
  });

  it("win more often over many matches for the side whose colors win", () => {
    let won = 0;
    let lost = 0;
    for (let i = 0; i < 400; i++) {
      const home = paint(generateTeam(createRng(`w${i}h`), "h", 60), [0]);
      const away = paint(generateTeam(createRng(`w${i}a`), "a", 60), [2]);
      const { winner } = simulateMatch(
        { home, away, mode: "league", config: on },
        `w${i}`,
      ).result;
      if (winner === "home") won++;
      if (winner === "away") lost++;
    }
    expect(won).toBeGreaterThan(lost);
  });
});

describe("color cycle editor (D149)", () => {
  it("accepts any order of the five colors, and nothing else", () => {
    expect(colorCycleError([4, 3, 2, 1, 0])).toBeNull();
    expect(colorCycleError(SOCCER_COLOR_CYCLE)).toBeNull();
    for (const bad of [
      [0, 1, 2, 3],
      [0, 0, 1, 2, 3],
      [0, 1, 2, 3, 5],
      "x",
      [0, 1, 2, 3, 4.5],
    ])
      expect(colorCycleError(bad)).toMatch(/each of the five colors once/);
  });

  it("matchups follow the cycle passed in", () => {
    // The rainbow backwards: Purple → Blue → Green → Yellow → Red.
    const ring = [4, 1, 2, 3, 0];
    expect(colorMatchups(4, ring)).toEqual({ beats: [1, 2], losesTo: [3, 0] });
    const reds = Array.from({ length: 6 }, () => ({ chemistryColor: 0 }));
    const yellows = Array.from({ length: 6 }, () => ({ chemistryColor: 3 }));
    // Red beats Yellow on the rainbow; reversed, Red loses to it.
    expect(dominantMatchup(reds, yellows).edge).toBe(1);
    expect(dominantMatchup(reds, yellows, ring).edge).toBe(-1);
  });

  it("keeps a valid stored cycle, drops a broken one, and refuses a bad one", () => {
    const kept = balanceFromValues({ tuning: { colorCycle: [4, 3, 2, 1, 0] } });
    expect(kept.tuning.colorCycle).toEqual([4, 3, 2, 1, 0]);
    expect(
      balanceFromValues({ tuning: { colorCycle: [0, 0, 0, 0, 0] } }).tuning
        .colorCycle,
    ).toBeUndefined();
    expect(balanceFromValues({}).tuning.colorCycle).toBeUndefined();
    expect(
      balanceErrors({
        ...DEFAULT_BALANCE,
        tuning: { ...DEFAULT_BALANCE.tuning, colorCycle: [0, 1, 2] },
      }),
    ).toContain("The color cycle must hold each of the five colors once.");
    const rows = balanceToRows(kept);
    expect(rows.find((r) => r.key === "tuning")?.value).toMatchObject({
      colorCycle: [4, 3, 2, 1, 0],
    });
  });

  it("a reversed cycle flips which side's influence rises in a match", () => {
    const red = paint(generateTeam(createRng("cc-h"), "h", 60), [0]);
    const green = paint(generateTeam(createRng("cc-a"), "a", 60), [2]);
    const reversed = {
      ...on,
      tuning: { ...on.tuning, colorCycle: [4, 1, 2, 3, 0] },
    };
    const total = (config: typeof base, side: "home" | "away") =>
      [
        ...simulateMatch(
          { home: red, away: green, mode: "league", config },
          "cc",
        ).influence[side].values,
      ].reduce((a, b) => a + b, 0);
    // Rainbow: Red beats Green. Reversed: Green beats Red.
    expect(total(on, "home")).toBeGreaterThan(total(base, "home"));
    expect(total(reversed, "home")).toBeLessThan(total(base, "home"));
    expect(total(reversed, "away")).toBeGreaterThan(total(base, "away"));
  });
});
