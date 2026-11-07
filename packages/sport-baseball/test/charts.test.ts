import { createRng } from "@lfs/core";
import { describe, expect, it } from "vitest";
import {
  aiBaseballClub,
  type BaseballEvent,
  type BaseballPlayer,
  baseballGameSeed,
  batterSpray,
  batterZoneGrid,
  chartSide,
  defaultBaseballConfig,
  generatePlayer,
  pitcherLocationGrid,
  playBaseballWeek,
  playerChartEvents,
  replayGame,
  SPRAY_PRESETS,
  ZONE_PRESETS,
} from "../src/index";

describe("a player's charts (ADR 0009 §9, D201)", () => {
  it("mirrors a left-handed batter's zones and spray, as the engine plays them", () => {
    expect(chartSide({ bats: "L" })).toBe("L");
    expect(chartSide({ bats: "S" })).toBe("L");
    expect(chartSide({})).toBe("R");
    const right = batterZoneGrid({ bats: "R", zoneProfile: "middle-in" });
    const left = batterZoneGrid({ bats: "L", zoneProfile: "middle-in" });
    expect(right).toEqual(ZONE_PRESETS["middle-in"].map((r) => [...r]));
    expect(left.map((r) => [...r].reverse())).toEqual(right);
    expect(batterSpray({ bats: "R", sprayProfile: "pull" })).toEqual([
      ...SPRAY_PRESETS.pull,
    ]);
    const lefty = batterSpray({ bats: "L", sprayProfile: "pull" });
    expect(lefty[11]).toBeGreaterThan(lefty[0] as number);
    const lp = pitcherLocationGrid({
      throws: "L",
      locationProfile: "paints-corners",
    });
    const rp = pitcherLocationGrid({
      throws: "R",
      locationProfile: "paints-corners",
    });
    expect(lp.map((r) => [...r].reverse())).toEqual(rp);
    expect(batterZoneGrid({})).toHaveLength(5);
  });

  it("collects a player's pitches and batted balls from a replayed game", () => {
    const club = (slot: number) => {
      const c = aiBaseballClub("charts", slot, 1500);
      return {
        players: new Map(c.players.map((p) => [p.id, p as BaseballPlayer])),
        squad: c.squad,
        rest: {},
        injured: {},
        lastStarter: null,
      };
    };
    const config = defaultBaseballConfig();
    const week = playBaseballWeek({
      seed: "charts",
      games: [{ id: "g1", gameNo: 1, homeSlot: 0, awaySlot: 1 }],
      clubs: new Map([
        [0, club(0)],
        [1, club(1)],
      ]),
      elo: { 0: 1500, 1: 1500 },
      config,
    });
    const g = week.played[0];
    if (!g) throw new Error("no game");
    const out = replayGame(g.teams, config, baseballGameSeed("charts", "g1"));
    const batter = g.teams.home.batters[0]?.player.id as string;
    const starter = g.starters.home;
    const asBatter = playerChartEvents(out.events, batter);
    const asPitcher = playerChartEvents(out.events, starter);
    expect(asBatter.faced.length).toBeGreaterThan(5);
    expect(asBatter.thrown).toEqual([]);
    expect(asPitcher.thrown.length).toBeGreaterThan(30);
    expect(asPitcher.faced).toEqual([]);
    const plays = out.events.filter(
      (e): e is Extract<BaseballEvent, { type: "play" }> =>
        e.type === "play" && e.batter === batter && Boolean(e.batted),
    );
    expect(asBatter.batted).toHaveLength(plays.length);
    for (const p of [...asBatter.faced, ...asPitcher.thrown]) {
      expect(p.row).toBeGreaterThanOrEqual(0);
      expect(p.row).toBeLessThan(5);
    }
    expect(
      generatePlayer(createRng("x"), { position: "SS", overall: 60 }),
    ).toBeDefined();
  });
});
