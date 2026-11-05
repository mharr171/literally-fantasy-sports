import { createRng } from "@lfs/core";
import { describe, expect, it } from "vitest";
import { balanceFromValues } from "../src/balance";
import { generateTeam } from "../src/harness";
import {
  defaultSoccerConfig,
  PROPOSED_MATCHUPS,
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
