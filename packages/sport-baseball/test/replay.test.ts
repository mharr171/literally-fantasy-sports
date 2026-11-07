import { describe, expect, it } from "vitest";
import {
  aiBaseballClub,
  type BaseballEvent,
  type BaseballPlayer,
  baseballGameSeed,
  defaultBaseballConfig,
  playBaseballWeek,
  playText,
  replayGame,
  type WeekClub,
  winProbabilityLine,
} from "../src/index";

const club = (slot: number): WeekClub => {
  const c = aiBaseballClub("replay", slot, 1500 + slot * 40);
  return {
    players: new Map(c.players.map((p) => [p.id, p as BaseballPlayer])),
    squad: c.squad,
    rest: {},
    injured: {},
    lastStarter: null,
  };
};

describe("replaying a game (ADR 0009 §9, D204)", () => {
  const config = defaultBaseballConfig();
  const week = playBaseballWeek({
    seed: "replay",
    games: [1, 2, 3].map((g) => ({
      id: `game-${g}`,
      gameNo: g,
      homeSlot: 0,
      awaySlot: 1,
    })),
    clubs: new Map([
      [0, club(0)],
      [1, club(1)],
    ]),
    elo: { 0: 1500, 1: 1500 },
    config,
  });

  it("plays the same game again from its stored teams and seed", () => {
    for (const g of week.played) {
      // Stored as JSON in the database, then read back.
      const teams = JSON.parse(JSON.stringify(g.teams));
      const again = replayGame(teams, config, baseballGameSeed("replay", g.id));
      expect(again.result.score).toEqual({
        home: g.homeScore,
        away: g.awayScore,
      });
      expect(again.result.pitches).toEqual(
        replayGame(g.teams, config, baseballGameSeed("replay", g.id)).result
          .pitches,
      );
    }
  });

  it("writes a line for every play and none for pitches", () => {
    const g = week.played[0];
    if (!g) throw new Error("no game");
    const out = replayGame(g.teams, config, baseballGameSeed("replay", g.id));
    const lines = out.events.map((e) => playText(e, (id) => id.slice(-4)));
    out.events.forEach((e, i) => {
      if (e.type === "pitch") expect(lines[i]).toBeNull();
      else expect(lines[i]).toMatch(/\.$/);
    });
    expect(
      lines.some(
        (l) =>
          l && /strikes out|singles|is out|grounds out|flies out|walks/.test(l),
      ),
    ).toBe(true);
  });

  it("describes every kind of event", () => {
    const base = {
      inning: 1,
      batting: "away" as const,
      outs: 0,
      bases: [null, null, null] as [null, null, null],
    };
    const n = (id: string) => id.toUpperCase();
    const ev = (e: Partial<BaseballEvent>) =>
      playText({ ...base, ...e } as BaseballEvent, n);
    expect(
      ev({
        type: "play",
        batter: "a",
        pitcher: "p",
        result: "homeRun",
        runs: 2,
        rbi: 2,
        scored: [
          { runner: "b", pitcher: "p", earned: true },
          { runner: "a", pitcher: "p", earned: true },
        ],
      }),
    ).toBe("A homers. B, A score.");
    expect(
      ev({
        type: "play",
        batter: "a",
        pitcher: "p",
        result: "out",
        batted: { kind: "fly", direction: 5, depth: 6 },
        fielder: "CF",
        runs: 0,
        rbi: 0,
        scored: [],
      }),
    ).toBe("A flies out to CF.");
    expect(
      ev({
        type: "play",
        batter: "a",
        pitcher: "p",
        result: "walk",
        runs: 0,
        rbi: 0,
        scored: [],
      }),
    ).toBe("A walks.");
    expect(
      ev({ type: "steal", batter: "a", runner: "r", to: 2, safe: true }),
    ).toBe("R steals second.");
    expect(
      ev({ type: "steal", batter: "a", runner: "r", to: 3, safe: false }),
    ).toBe("R is caught stealing third.");
    expect(
      ev({
        type: "pitchingChange",
        side: "home",
        out: "x",
        in: "y",
        reason: "tired",
      }),
    ).toBe("Pitching change: Y replaces X (tired).");
    expect(
      ev({
        type: "substitution",
        side: "away",
        out: "x",
        in: "y",
        role: "pinchHitter",
      }),
    ).toBe("Y pinch-hits for X.");
    expect(ev({ type: "injury", side: "away", player: "x", days: 1 })).toBe(
      "X is hurt (1 day).",
    );
  });

  it("draws the home side's chance of winning, ending on the result", () => {
    const g = week.played[0];
    if (!g) throw new Error("no game");
    const out = replayGame(g.teams, config, baseballGameSeed("replay", g.id));
    const line = winProbabilityLine(out.events, out.result.winner === "home");
    expect(line.length).toBeGreaterThan(40);
    expect(line.every((p) => p >= 0 && p <= 1)).toBe(true);
    expect(line[0]).toBeGreaterThan(0.4);
    expect(line[0]).toBeLessThan(0.65);
    expect(line.at(-1)).toBe(out.result.winner === "home" ? 1 : 0);
  });
});
