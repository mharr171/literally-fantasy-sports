import { describe, expect, it } from "vitest";
import {
  type Great,
  honoursFrom,
  longestUnbeaten,
  rankGreats,
  type SeasonLine,
  seasonScorers,
} from "../src/history";

const goal = (side: "home" | "away", player: string) => ({
  minute: 10,
  type: "goal" as const,
  side,
  player,
});

describe("season scorers (ADR 0005)", () => {
  it("counts only the club's own goals in its own matches", () => {
    const fixture = (
      homeSlot: number,
      awaySlot: number,
      events: ReturnType<typeof goal>[],
    ) => ({
      homeSlot,
      awaySlot,
      summary: { possession: {}, shots: {}, events },
    });
    const scorers = seasonScorers({
      fixtures: [
        // Our club (slot 0) at home: two for Romano, one against us.
        fixture(0, 3, [
          goal("home", "Romano"),
          goal("home", "Romano"),
          goal("away", "Ade"),
        ]),
        // Away: Cisse scores for us.
        fixture(5, 0, [goal("away", "Cisse"), goal("home", "Romano")]),
        // Someone else's match.
        fixture(4, 6, [goal("home", "Cisse")]),
        // Not played yet.
        { homeSlot: 0, awaySlot: 7, summary: null },
      ],
    } as never);
    expect(scorers).toEqual([
      { name: "Romano", goals: 2 },
      { name: "Cisse", goals: 1 },
    ]);
  });
});

describe("club hall of fame (ADR 0005)", () => {
  const great = (name: string, over: Partial<Great> = {}): Great => ({
    id: name,
    name,
    position: "ST",
    seasons: 3,
    retired: false,
    games: 50,
    goals: 0,
    assists: 0,
    tackles: 0,
    saves: 0,
    bestOverall: 60,
    ...over,
  });

  it("ranks each list, most first, fewer games breaking ties, nobody on 0", () => {
    const lists = rankGreats(
      [
        great("Ann", { goals: 30, games: 80 }),
        great("Bo", { goals: 30, games: 60 }),
        great("Cy", { goals: 12, retired: true }),
        great("Di", { saves: 90, position: "GK" }),
      ],
      2,
    );
    expect(lists.goals.map((g) => g.name)).toEqual(["Bo", "Ann"]);
    expect(lists.saves.map((g) => g.name)).toEqual(["Di"]);
    expect(lists.assists).toEqual([]);
    expect(lists.games.map((g) => g.name)).toEqual(["Ann", "Bo"]);
  });

  it("finds the longest unbeaten run", () => {
    expect(longestUnbeaten([])).toBe(0);
    expect(longestUnbeaten(["w", "d", "l", "w", "w", "d", "w", "l", "d"])).toBe(
      4,
    );
  });

  it("counts titles, finals, best finish and highest Elo", () => {
    const line = (over: Partial<SeasonLine>): SeasonLine => ({
      seasonNumber: 1,
      position: 5,
      played: 22,
      won: 10,
      drawn: 5,
      lost: 7,
      scored: 30,
      conceded: 25,
      points: 35,
      eloBefore: 1500,
      eloAfter: 1520,
      playoffs: "none",
      ...over,
    });
    expect(
      honoursFrom(
        [
          line({ playoffs: "champion", position: 2, eloAfter: 1610 }),
          line({ playoffs: "final", position: 1, eloAfter: 1580 }),
          line({ playoffs: "semi" }),
        ],
        9,
      ),
    ).toEqual({
      titles: 1,
      finals: 2,
      bestFinish: 1,
      highestElo: 1610,
      unbeatenRun: 9,
    });
    expect(honoursFrom([], 0)).toEqual({
      titles: 0,
      finals: 0,
      bestFinish: null,
      highestElo: null,
      unbeatenRun: 0,
    });
  });
});
