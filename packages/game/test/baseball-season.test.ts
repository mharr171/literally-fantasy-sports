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
