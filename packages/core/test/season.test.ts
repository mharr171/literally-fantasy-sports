import { describe, expect, it } from "vitest";
import {
  aiOpponentRatings,
  DEFAULT_PAYOUTS,
  leagueTable,
  matchPayout,
  playoffBonus,
  playoffSemis,
  roundRobin,
} from "../src/season";

const eight = ["a", "b", "c", "d", "e", "f", "g", "h"];

describe("roundRobin (D16)", () => {
  const fixtures = roundRobin(eight);

  it("gives 8 teams 14 weeks of 4 matches", () => {
    expect(fixtures).toHaveLength(56);
    for (let w = 1; w <= 14; w++) {
      const week = fixtures.filter((f) => f.week === w);
      expect(week, `week ${w}`).toHaveLength(4);
      const teams = week.flatMap((f) => [f.home, f.away]);
      expect(new Set(teams).size, `week ${w}`).toBe(8);
    }
    expect(fixtures.map((f) => f.week)).toEqual(
      [...fixtures.map((f) => f.week)].sort((a, b) => a - b),
    );
  });

  it("has every pair meet once at each ground", () => {
    for (const x of eight)
      for (const y of eight) {
        if (x === y) continue;
        const games = fixtures.filter((f) => f.home === x && f.away === y);
        expect(games, `${x} v ${y}`).toHaveLength(1);
      }
  });

  it("mixes home and away within each half of the season", () => {
    for (const t of eight) {
      const firstHalfHome = fixtures.filter(
        (f) => f.week <= 7 && f.home === t,
      ).length;
      expect(firstHalfHome, t).toBeGreaterThanOrEqual(3);
      expect(firstHalfHome, t).toBeLessThanOrEqual(4);
      // Never three home or three away games in a row.
      const run = fixtures
        .filter((f) => f.home === t || f.away === t)
        .map((f) => (f.home === t ? "H" : "A"))
        .join("");
      expect(run, t).not.toMatch(/HHH|AAA/);
    }
  });

  it("rests one team a week when the number is odd", () => {
    const five = roundRobin(["a", "b", "c", "d", "e"], 1);
    expect(five).toHaveLength(10);
    expect(new Set(five.map((f) => f.week)).size).toBe(5);
    for (const f of five) expect(f.home).not.toMatch(/bye/);
  });

  it("handles tiny or invalid leagues", () => {
    expect(roundRobin(["a"])).toEqual([]);
    expect(roundRobin(["a", "b"], 1)).toEqual([
      { week: 1, home: "a", away: "b" },
    ]);
    expect(() => roundRobin(["a", "a"])).toThrow(/once/);
  });
});

describe("leagueTable", () => {
  it("ranks by points, goal difference, goals scored, then wins", () => {
    const table = leagueTable(
      ["a", "b", "c", "d"],
      [
        { home: "a", away: "b", homeScore: 2, awayScore: 0 },
        { home: "c", away: "d", homeScore: 1, awayScore: 1 },
        { home: "b", away: "c", homeScore: 3, awayScore: 3 },
        { home: "d", away: "a", homeScore: 0, awayScore: 1 },
      ],
    );
    expect(table.map((r) => r.team)).toEqual(["a", "c", "d", "b"]);
    expect(table[0]).toEqual({
      team: "a",
      played: 2,
      won: 2,
      drawn: 0,
      lost: 0,
      scored: 3,
      conceded: 0,
      difference: 3,
      points: 6,
    });
    expect(table.map((r) => r.points)).toEqual([6, 2, 1, 1]);
  });

  it("keeps the given order when everything is level", () => {
    expect(leagueTable(["x", "y"], []).map((r) => r.team)).toEqual(["x", "y"]);
    expect(
      leagueTable(
        ["x", "y", "z"],
        [
          { home: "y", away: "z", homeScore: 2, awayScore: 1 },
          { home: "x", away: "z", homeScore: 1, awayScore: 0 },
        ],
      ).map((r) => r.team),
    ).toEqual(["y", "x", "z"]);
  });

  it("refuses matches for teams outside the league", () => {
    expect(() =>
      leagueTable(
        ["a"],
        [{ home: "a", away: "q", homeScore: 0, awayScore: 0 }],
      ),
    ).toThrow(/isn't in this league/);
  });
});

describe("playoffs (D30)", () => {
  it("pairs 1st v 4th and 2nd v 3rd", () => {
    const table = leagueTable(eight, []);
    expect(playoffSemis(table)).toEqual([
      { week: 1, home: "a", away: "d" },
      { week: 1, home: "b", away: "c" },
    ]);
    expect(() => playoffSemis(table.slice(0, 3))).toThrow(/at least 4/);
  });
});

describe("payouts (D39)", () => {
  it("pays per match plus win or draw money", () => {
    expect(matchPayout("win")).toBe(1_500);
    expect(matchPayout("draw")).toBe(1_200);
    expect(matchPayout("loss")).toBe(1_000);
  });

  it("adds playoff bonuses by how far the team got", () => {
    expect(playoffBonus("none")).toBe(0);
    expect(playoffBonus("semi")).toBe(2_000);
    expect(playoffBonus("final")).toBe(5_000);
    expect(playoffBonus("champion")).toBe(10_000);
    expect(playoffBonus("champion", { ...DEFAULT_PAYOUTS, champion: 0 })).toBe(
      5_000,
    );
  });
});

describe("aiOpponentRatings (D32)", () => {
  it("spreads 7 opponents evenly around the manager", () => {
    expect(aiOpponentRatings(1500, 7)).toEqual([
      1200, 1300, 1400, 1500, 1600, 1700, 1800,
    ]);
    expect(aiOpponentRatings(1500, 3, 100)).toEqual([1400, 1500, 1600]);
    expect(aiOpponentRatings(1523, 1)).toEqual([1523]);
    expect(aiOpponentRatings(1500, 0)).toEqual([]);
  });
});
