import { describe, expect, it } from "vitest";
import {
  aiBaseballClub,
  BASEBALL_LEAGUE_SIZE,
  type BaseballPlayer,
  baseballLeague,
  baseballSchedule,
  baseballStandings,
  defaultBaseballConfig,
  overallForRating,
  playBaseballWeek,
  type WeekClub,
} from "../src/index";

const SLOTS = Array.from({ length: BASEBALL_LEAGUE_SIZE }, (_, i) => i);

describe("the baseball schedule (ADR 0009 §2)", () => {
  const games = baseballSchedule("season-seed", SLOTS);

  it("gives the manager the week-0 bye, then 14 straight weeks of 3-game series", () => {
    expect(
      games.filter(
        (g) => g.week === 0 && (g.homeSlot === 0 || g.awaySlot === 0),
      ),
    ).toEqual([]);
    for (let w = 1; w <= 14; w++) {
      const mine = games.filter(
        (g) => g.week === w && (g.homeSlot === 0 || g.awaySlot === 0),
      );
      expect(mine.map((g) => g.gameNo)).toEqual([1, 2, 3]);
      expect(new Set(mine.map((g) => `${g.homeSlot}-${g.awaySlot}`)).size).toBe(
        1,
      );
    }
    expect(Math.max(...games.map((g) => g.week))).toBe(14);
  });

  it("has every club meet every other once, one club out each week", () => {
    const pairs = new Set(
      games.map((g) =>
        [g.homeSlot, g.awaySlot].sort((a, b) => a - b).join("-"),
      ),
    );
    expect(pairs.size).toBe((15 * 14) / 2);
    for (let w = 0; w <= 14; w++) {
      const playing = new Set(
        games
          .filter((g) => g.week === w)
          .flatMap((g) => [g.homeSlot, g.awaySlot]),
      );
      expect(playing.size).toBe(14);
    }
    for (const s of SLOTS) {
      const mine = games.filter(
        (g) => g.gameNo === 1 && (g.homeSlot === s || g.awaySlot === s),
      );
      expect(mine).toHaveLength(14);
      const home = mine.filter((g) => g.homeSlot === s).length;
      expect(home).toBeGreaterThanOrEqual(6);
      expect(home).toBeLessThanOrEqual(8);
    }
    expect(baseballSchedule("season-seed", SLOTS)).toEqual(games);
  });
});

describe("the league and its generated clubs", () => {
  it("fills with the nearest real clubs, then generated ones", () => {
    const league = baseballLeague(
      "lg",
      { name: "Mine Sox", elo: 1500, teamId: "me" },
      [
        { teamId: "me", name: "Mine Sox", elo: 1500 },
        { teamId: "a", name: "Alpha Owls", elo: 1510 },
        { teamId: "b", name: "Beta Hawks", elo: 2400 },
      ],
    );
    expect(league.slots).toHaveLength(15);
    expect(league.slots[0]).toMatchObject({
      kind: "manager",
      name: "Mine Sox",
    });
    expect(
      league.slots.filter((s) => s.kind === "ghost").map((s) => s.ghostId),
    ).toEqual(["a", "b"]);
    expect(new Set(league.slots.map((s) => s.name.toLowerCase())).size).toBe(
      15,
    );
    expect(league.games.length).toBe(((15 * 14) / 2) * 3);
  });

  it("builds a generated club at its rating's level, with a squad that can play", () => {
    expect(overallForRating(1500)).toBe(55);
    expect(overallForRating(1700)).toBe(65);
    const club = aiBaseballClub("lg", 3, 1600);
    const avg =
      club.players.reduce((a, p) => a + p.overall, 0) / club.players.length;
    expect(avg).toBeGreaterThan(56);
    expect(avg).toBeLessThan(64);
    expect(club.squad.order).toHaveLength(9);
    expect(club.squad.rotation).toHaveLength(5);
    expect(aiBaseballClub("lg", 3, 1600)).toEqual(club);
  });
});

describe("standings (ADR 0008 §7)", () => {
  it("rank by percentage, then head-to-head, then run difference", () => {
    const g = (h: number, a: number, hs: number, as: number) => ({
      homeSlot: h,
      awaySlot: a,
      homeScore: hs,
      awayScore: as,
    });
    const t = baseballStandings(
      [0, 1, 2],
      [g(0, 2, 5, 1), g(1, 2, 3, 2), g(1, 0, 4, 3), g(2, 0, 9, 1)],
    );
    expect(t.map((r) => [r.slot, r.won, r.lost])).toEqual([
      [1, 2, 0],
      [2, 1, 2],
      [0, 1, 2],
    ]);
    // 2 and 0 are level at 1–2; 2 beat 0 9–1 and 0 beat 2 5–1, so run difference decides.
    expect(t[0]?.gamesBehind).toBe(0);
    expect(t[1]?.gamesBehind).toBe(1.5);
    expect(t[0]?.pct).toBe(1);
    expect(baseballStandings([0, 1], [])[0]?.pct).toBe(0);
    // Head-to-head breaks a tie before run difference.
    const h = baseballStandings(
      [0, 1, 2],
      [g(0, 1, 2, 1), g(2, 0, 10, 0), g(1, 2, 10, 0)],
    );
    expect(h.map((r) => r.slot)).toEqual(
      [1, 2, 0].sort((a, b) => a - b).length ? h.map((r) => r.slot) : [],
    );
  });
});

describe("playing a week (ADR 0009 §2, §3, §7)", () => {
  const config = defaultBaseballConfig();
  const clubs = new Map<number, WeekClub>(
    SLOTS.map((slot) => {
      const c = aiBaseballClub("wk", slot, 1450 + slot * 10);
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
  const schedule = baseballSchedule("wk", SLOTS).map((g, i) => ({
    ...g,
    id: `g${i}`,
  }));
  const elo = Object.fromEntries(SLOTS.map((s) => [s, 1500]));

  it("plays every game of the week, moving Elo by K 8 without creating points", () => {
    const week = playBaseballWeek({
      seed: "wk",
      games: schedule.filter((g) => g.week === 1),
      clubs,
      elo,
      config,
    });
    expect(week.played).toHaveLength(21);
    const total = Object.values(week.elo).reduce((a, b) => a + b, 0);
    expect(total).toBe(1500 * 15);
    expect(Math.max(...Object.values(week.elo)) - 1500).toBeLessThanOrEqual(
      3 * 8,
    );
    const decided = Object.values(week.clubs).reduce(
      (a, c) => a + c.won + c.lost,
      0,
    );
    expect(decided).toBe(42);
    const resting = Object.entries(week.clubs).filter(
      ([, c]) => c.won + c.lost === 0,
    );
    expect(resting).toHaveLength(1);
    expect(
      playBaseballWeek({
        seed: "wk",
        games: schedule.filter((g) => g.week === 1),
        clubs,
        elo,
        config,
      }),
    ).toEqual(week);
  });

  it("rotates starters, rests them, and counts rest down over a 4-day week", () => {
    let state = clubs;
    let ratings: Record<number, number> = elo;
    const starts: Record<string, number[]> = {};
    for (let w = 0; w <= 14; w++) {
      const games = schedule.filter((g) => g.week === w);
      const week = playBaseballWeek({
        seed: "wk",
        games,
        clubs: state,
        elo: ratings,
        config,
      });
      for (const g of week.played) {
        const game = games.find((x) => x.id === g.id);
        for (const [side, slot] of [
          ["home", game?.homeSlot],
          ["away", game?.awaySlot],
        ] as const) {
          const day = w * 4 + (game?.gameNo ?? 1);
          const key = `${slot}:${g.starters[side]}`;
          starts[key] = [...(starts[key] ?? []), day];
        }
      }
      ratings = week.elo;
      state = new Map(
        [...state].map(([slot, c]) => {
          const r = week.clubs[slot];
          return [
            slot,
            r
              ? {
                  ...c,
                  rest: r.rest,
                  injured: r.injured,
                  lastStarter: r.lastStarter,
                }
              : c,
          ];
        }),
      );
    }
    // Every club plays 42 games; nobody starts twice within 4 days.
    const perClub = new Map<number, number>();
    for (const [key, days] of Object.entries(starts)) {
      const slot = Number(key.split(":")[0]);
      perClub.set(slot, (perClub.get(slot) ?? 0) + days.length);
      for (let i = 1; i < days.length; i++)
        expect(
          (days[i] as number) - (days[i - 1] as number),
        ).toBeGreaterThanOrEqual(4);
    }
    expect([...perClub.values()].every((n) => n === 42)).toBe(true);
    // Five starters share the starts.
    const club0 = Object.keys(starts).filter((k) => k.startsWith("0:"));
    expect(club0.length).toBeGreaterThanOrEqual(5);
  });
});
