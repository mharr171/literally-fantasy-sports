import { describe, expect, it } from "vitest";
import { aiBaseballClub, type BaseballPlayer } from "../src/sports/baseball";
import { cloneSquad, lastStarters } from "../src/sports/baseball-season";

describe("baseball's season in the game layer", () => {
  const club = aiBaseballClub("seed", 1, 1500);
  const players = club.players as BaseballPlayer[];

  it("keeps a copied club's saved squad when it still fits, else auto-picks", () => {
    expect(cloneSquad(players, club.squad)).toEqual(club.squad);
    // A soccer-shaped or broken squad falls back to auto-pick.
    const picked = cloneSquad(players, { formation: "4-4-2", lineup: [] });
    expect(picked.order).toHaveLength(9);
    expect(
      cloneSquad(players, { ...club.squad, rotation: [] }).rotation,
    ).toHaveLength(5);
  });

  it("finds each club's latest starter from the stored game summaries", () => {
    const f = (
      week: number,
      gameNo: number,
      home: number,
      away: number,
      h: string,
      a: string,
    ) => ({
      id: `${week}-${gameNo}`,
      week,
      gameNo,
      stage: "league",
      event: "main",
      homeSlot: home,
      awaySlot: away,
      homeScore: 1,
      awayScore: 0,
      winner: null,
      summary: { score: { home: 1, away: 0 }, starters: { home: h, away: a } },
    });
    const season = {
      fixtures: [
        f(1, 2, 0, 1, "m2", "o2"),
        f(1, 1, 0, 1, "m1", "o1"),
        { ...f(2, 1, 1, 0, "x", "y"), homeScore: null, summary: null },
      ],
    };
    const starters = lastStarters(season as never);
    expect(starters.get(0)).toBe("m2");
    expect(starters.get(1)).toBe("o2");
  });
});

describe("the season after each week (ADR 0009 §2)", () => {
  it("runs from the regular season through every round to the finish", async () => {
    const { baseballSchedule } = await import("../src/sports/baseball");
    const { seasonAfterWeek } = await import("../src/sports/baseball-season");
    const slots = Array.from({ length: 15 }, (_, i) => i);
    type F = Parameters<typeof seasonAfterWeek>[1][number] & { id: string };
    let n = 0;
    const fixtures: F[] = baseballSchedule("s", slots).map((g) => ({
      ...g,
      id: `g${n++}`,
      homeScore: null,
      awayScore: null,
      winner: null,
    }));
    // The lower slot always wins: a predictable season.
    const play = (week: number) => {
      const wins = new Map<string, number>();
      for (const f of fixtures
        .filter((x) => x.week === week)
        .sort((a, b) => (a.gameNo ?? 1) - (b.gameNo ?? 1))) {
        const key = `${f.stage}:${Math.min(f.homeSlot, f.awaySlot)}`;
        const need =
          f.stage === "league"
            ? 99
            : f.stage === "wildcard"
              ? 1
              : f.stage === "quarter"
                ? 2
                : f.stage === "semi"
                  ? 3
                  : 4;
        if ((wins.get(key) ?? 0) >= need) {
          f.skipped = true;
          continue;
        }
        const homeWins = f.homeSlot < f.awaySlot;
        Object.assign(f, {
          homeScore: homeWins ? 2 : 1,
          awayScore: homeWins ? 1 : 2,
          winner: homeWins ? "home" : "away",
        });
        wins.set(key, (wins.get(key) ?? 0) + 1);
      }
    };
    const statuses: string[] = [];
    const reached: string[] = [];
    let week = 0;
    for (let i = 0; i < 30; i++) {
      play(week);
      const after = seasonAfterWeek(slots, fixtures, week);
      statuses.push(after.status);
      reached.push(after.managerReached);
      for (const g of after.newGames)
        fixtures.push({
          ...g,
          id: `g${n++}`,
          homeScore: null,
          awayScore: null,
          winner: null,
        });
      if (after.status === "finished") break;
      week = after.nextWeek;
    }
    // 15 regular weeks (0–14), then wildcard, quarters, semis and the final.
    expect(statuses.filter((s) => s === "regular")).toHaveLength(14);
    expect(statuses.slice(14)).toEqual([
      "playoffs",
      "playoffs",
      "playoffs",
      "playoffs",
      "finished",
    ]);
    expect(week).toBe(18);
    // Slot 0 wins everything: it reaches the quarters, semis and final, then wins it.
    expect(reached.filter((r) => r !== "none")).toEqual([
      "quarter",
      "semi",
      "final",
      "champion",
    ]);
    // The quarterfinals were all 2–0, so every game 3 was skipped.
    const qf = fixtures.filter((f) => f.stage === "quarter");
    expect(qf.filter((f) => f.skipped).map((f) => f.gameNo)).toEqual([
      3, 3, 3, 3,
    ]);
  });
});
