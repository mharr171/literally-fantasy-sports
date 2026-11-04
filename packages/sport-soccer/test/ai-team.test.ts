import { aiOpponentRatings, createRng } from "@lfs/core";
import { describe, expect, it } from "vitest";
import {
  aiTeamName,
  DEFAULT_AI_TEAM_SETTINGS,
  generateAiTeam,
  overallForRating,
} from "../src/ai-team";
import { defaultSoccerConfig, simulateMatch } from "../src/match";
import { squadProblems, squadToTeam } from "../src/matchday";

describe("AI teams (D8, D32)", () => {
  it("maps ratings to a level, clamped", () => {
    expect(overallForRating(1500)).toBe(55);
    expect(overallForRating(1700)).toBe(65);
    expect(overallForRating(1300)).toBe(45);
    expect(overallForRating(-5000)).toBe(30);
    expect(overallForRating(9000)).toBe(95);
  });

  it("builds a valid 22 around the rating's level, the same every time", () => {
    const team = generateAiTeam(createRng("ai"), 1600, "x");
    expect(team.players).toHaveLength(22);
    const ids = new Set(team.players.map((p) => p.id));
    expect(squadProblems(team.squad, ids)).toEqual([]);
    const starters = team.players.slice(0, 11);
    const mean = starters.reduce((a, p) => a + p.overall, 0) / 11;
    expect(Math.abs(mean - 60)).toBeLessThan(3.5);
    expect(starters[0]?.primaryPosition).toBe("GK");
    expect(team.players[11]?.primaryPosition).toBe("GK");
    expect(generateAiTeam(createRng("ai"), 1600, "x")).toEqual(team);
    expect(team.name).toMatch(/^[A-Z][\w ]+ [A-Z]\w+$/);
    expect(() =>
      generateAiTeam(createRng("ai"), 1600, "x", {
        ...DEFAULT_AI_TEAM_SETTINGS,
        formation: "1-1-8",
      }),
    ).toThrow(/Unknown formation/);
  });

  it("makes higher-rated teams win more often", () => {
    const config = defaultSoccerConfig();
    const [weakRating, , , , , , strongRating] = aiOpponentRatings(1500, 7);
    let strongPoints = 0;
    let weakPoints = 0;
    for (let i = 0; i < 60; i++) {
      const rng = createRng(`ai-match-${i}`);
      const strong = generateAiTeam(rng.fork("s"), strongRating as number, "s");
      const weak = generateAiTeam(rng.fork("w"), weakRating as number, "w");
      const team = (t: typeof strong, id: string) =>
        squadToTeam(id, t.squad, new Map(t.players.map((p) => [p.id, p])));
      const { result } = simulateMatch(
        {
          home: team(strong, "s"),
          away: team(weak, "w"),
          mode: "league",
          config,
        },
        `m${i}`,
      );
      if (result.winner === "home") strongPoints += 3;
      else if (result.winner === "away") weakPoints += 3;
      else {
        strongPoints++;
        weakPoints++;
      }
    }
    expect(strongPoints).toBeGreaterThan(weakPoints * 2);
  });

  it("names clubs from invented places", () => {
    const names = new Set(
      Array.from({ length: 50 }, (_, i) => aiTeamName(createRng(`n${i}`))),
    );
    expect(names.size).toBeGreaterThan(40);
  });
});
