import { DEFAULT_PAYOUTS } from "@lfs/core";
import { describe, expect, it } from "vitest";
import {
  aiBaseballClub,
  BASEBALL_LEAGUE_SIZE,
  type BaseballPlayer,
  baseballBracket,
  baseballSchedule,
  baseballStandings,
  defaultBaseballConfig,
  nextPostseasonGames,
  type PostseasonFixture,
  playBaseballWeek,
  postseasonBonus,
  postseasonDone,
  postseasonFinish,
  SERIES_LENGTH,
  seriesHome,
  type WeekClub,
} from "../src/index";

const SLOTS = Array.from({ length: BASEBALL_LEAGUE_SIZE }, (_, i) => i);

describe("home field by seed (ADR 0009 §2)", () => {
  it("gives the better seed games 1, 2, 5 of a best of 5 and 1, 2, 6, 7 of a best of 7", () => {
    const host = (games: number) =>
      Array.from(
        { length: games },
        (_, g) => seriesHome(1, 9, games, g + 1).homeSlot,
      );
    expect(host(1)).toEqual([1]);
    expect(host(3)).toEqual([1, 1, 1]);
    expect(host(5)).toEqual([1, 1, 9, 9, 1]);
    expect(host(7)).toEqual([1, 1, 9, 9, 9, 1, 1]);
  });
});

describe("a whole season with its postseason", () => {
  const config = defaultBaseballConfig();
  const clubs = new Map<number, WeekClub>(
    SLOTS.map((slot) => {
      const c = aiBaseballClub("post", slot, 1400 + slot * 15);
      return [
        slot,
        {
          players: new Map(c.players.map((p) => [p.id, p as BaseballPlayer])),
          squad: c.squad,
          rest: {},
          injured: {},
          lastStarter: null,
        },
      ];
    }),
  );
  let n = 0;
  const fixtures: (PostseasonFixture & { id: string })[] = baseballSchedule(
    "post",
    SLOTS,
  ).map((g) => ({
    ...g,
    id: `g${n++}`,
    homeScore: null,
    awayScore: null,
    winner: null,
  }));
  let elo: Record<number, number> = Object.fromEntries(
    SLOTS.map((s) => [s, 1500]),
  );
  const play = (week: number) => {
    const games = fixtures.filter((f) => f.week === week);
    const result = playBaseballWeek({
      seed: "post",
      games: games.map((g) => ({
        id: g.id,
        gameNo: g.gameNo ?? 1,
        homeSlot: g.homeSlot,
        awaySlot: g.awaySlot,
        ...(g.stage === "league"
          ? {}
          : {
              knockout: true,
              series: {
                key: `${g.stage}:${Math.min(g.homeSlot, g.awaySlot)}`,
                games: SERIES_LENGTH[g.stage as keyof typeof SERIES_LENGTH],
              },
            }),
      })),
      clubs,
      elo,
      config,
    });
    elo = result.elo;
    for (const p of result.played) {
      const f = fixtures.find((x) => x.id === p.id);
      if (f)
        Object.assign(f, {
          homeScore: p.homeScore,
          awayScore: p.awayScore,
          winner: p.winner,
        });
    }
    for (const id of result.skipped) {
      const f = fixtures.find((x) => x.id === id);
      if (f) f.skipped = true;
    }
    return result;
  };
  for (let w = 0; w <= 14; w++) play(w);
  const table = baseballStandings(
    SLOTS,
    fixtures.map((f) => ({
      homeSlot: f.homeSlot,
      awaySlot: f.awaySlot,
      homeScore: f.homeScore as number,
      awayScore: f.awayScore as number,
    })),
  );
  const places = table.map((r) => r.slot);

  it("draws nothing until the regular season is over, then the wildcard game at 8th's park", () => {
    expect(nextPostseasonGames(places, fixtures, false)).toEqual([]);
    const wc = nextPostseasonGames(places, fixtures, true);
    expect(wc).toEqual([
      {
        week: 15,
        stage: "wildcard",
        gameNo: 1,
        homeSlot: places[7],
        awaySlot: places[8],
      },
    ]);
  });

  it("plays every round to a champion, skipping games a series didn't need", () => {
    const skippedBy: Record<string, number> = {};
    for (let round = 0; round < 4; round++) {
      const next = nextPostseasonGames(places, fixtures, true);
      expect(next.length).toBeGreaterThan(0);
      for (const g of next)
        fixtures.push({
          ...g,
          id: `g${n++}`,
          homeScore: null,
          awayScore: null,
          winner: null,
        });
      const week = next[0]?.week as number;
      const result = play(week);
      skippedBy[next[0]?.stage as string] = result.skipped.length;
      // Nobody wins a series twice over: every game after the clincher is skipped.
      expect(
        nextPostseasonGames(places, fixtures, true).every(
          (g) => g.week === week + 1,
        ),
      ).toBe(true);
    }
    expect(nextPostseasonGames(places, fixtures, true)).toEqual([]);
    const bracket = baseballBracket(places, fixtures, true);
    expect(postseasonDone(bracket)).toBe(true);
    // The quarterfinals: 4 series of 3 games; a series that ends 2–0 skips game 3.
    const qf = fixtures.filter((f) => f.stage === "quarter");
    expect(qf).toHaveLength(12);
    expect(qf.filter((f) => f.skipped).length).toBe(skippedBy.quarter);
    expect(
      qf.every((f) =>
        f.skipped ? f.homeScore === null : f.homeScore !== null,
      ),
    ).toBe(true);
    // The top seed hosts every quarterfinal game.
    expect(
      qf
        .filter((f) => f.homeSlot === places[0] || f.awaySlot === places[0])
        .every((f) => f.homeSlot === places[0]),
    ).toBe(true);
    expect(fixtures.filter((f) => f.stage === "semi")).toHaveLength(10);
    expect(fixtures.filter((f) => f.stage === "final")).toHaveLength(7);
    // Each club's finish: one champion, one finalist, two semifinalists, four quarterfinalists, one wildcard loser.
    const finishes = SLOTS.map((s) => postseasonFinish(s, bracket));
    const count = (f: string) => finishes.filter((x) => x === f).length;
    expect([
      count("champion"),
      count("final"),
      count("semi"),
      count("quarter"),
      count("wildcard"),
      count("none"),
    ]).toEqual([1, 1, 2, 4, 1, 6]);
    expect(postseasonFinish(places[14] as number, bracket)).toBe("none");
  });

  it("pays the bonus for each round reached", () => {
    expect(postseasonBonus("quarter", DEFAULT_PAYOUTS)).toBe(
      DEFAULT_PAYOUTS.quarter,
    );
    expect(postseasonBonus("semi", DEFAULT_PAYOUTS)).toBe(
      DEFAULT_PAYOUTS.playoffs,
    );
    expect(postseasonBonus("final", DEFAULT_PAYOUTS)).toBe(
      DEFAULT_PAYOUTS.final,
    );
    expect(postseasonBonus("champion", DEFAULT_PAYOUTS)).toBe(
      DEFAULT_PAYOUTS.champion,
    );
    expect(postseasonBonus("wildcard", DEFAULT_PAYOUTS)).toBe(0);
    expect(postseasonBonus("none", DEFAULT_PAYOUTS)).toBe(0);
  });
});
