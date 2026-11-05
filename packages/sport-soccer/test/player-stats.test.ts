import { createRng, hashSeed } from "@lfs/core";
import { describe, expect, it } from "vitest";
import { generateTeam } from "../src/harness";
import {
  ASSIST_SHARE,
  defaultSoccerConfig,
  type PlayerMatchReport,
  simulateMatch,
} from "../src/match";
import { matchStats, NO_STATS, winPercent } from "../src/player-stats";

const config = defaultSoccerConfig();

const matches = Array.from({ length: 200 }, (_, i) => {
  const r = createRng(`fp-${i}`);
  const home = generateTeam(r, `h${i}`, 55 + (i % 20));
  const away = generateTeam(r, `a${i}`, 60);
  return {
    home,
    away,
    out: simulateMatch(
      { home, away, mode: i % 3 === 0 ? "knockout" : "league", config },
      `fp-seed-${i}`,
    ),
  };
});

describe("player stats in matches (D143)", () => {
  it("never change a score, a winner or an event", () => {
    // Fingerprint of these 200 matches taken before assists, tackles and
    // saves existed: they're rolled on their own streams.
    const parts = matches.map(({ out }) =>
      JSON.stringify([
        out.result.score,
        out.result.winner,
        out.result.penalties ?? null,
        out.events,
      ]),
    );
    expect(hashSeed(parts.join("|"))).toBe(1668181241);
  });

  it("credits assists, tackles and saves sensibly", () => {
    let goals = 0;
    let assists = 0;
    for (const { home, away, out } of matches) {
      // Starting keepers, and anyone who went in goal during the match.
      const keepers = new Set([
        ...[home, away].flatMap((t) =>
          t.lineup.filter((s) => s.slot === "GK").map((s) => s.player.id),
        ),
        ...out.events.flatMap((e) =>
          e.type === "sub" && e.reason === "keeper"
            ? [e.inId]
            : e.type === "position_change" && e.slot === "GK"
              ? [e.playerId]
              : [],
        ),
      ]);
      for (const side of ["home", "away"] as const) {
        const mine = Object.entries(out.result.players).filter(
          ([, r]) => r.side === side,
        );
        const sum = (k: keyof PlayerMatchReport) =>
          mine.reduce((n, [, r]) => n + (r[k] as number), 0);
        goals += sum("goals");
        assists += sum("assists");
        // Every shot on target the other side didn't score is a save.
        const other = side === "home" ? "away" : "home";
        expect(sum("saves")).toBe(
          out.result.shots[other] - out.result.score[other],
        );
        // A goal has at most one assist.
        expect(sum("assists")).toBeLessThanOrEqual(sum("goals"));
        // Only keepers save.
        for (const [id, r] of mine) {
          if (!keepers.has(id)) expect(r.saves).toBe(0);
        }
        expect(sum("tackles")).toBeGreaterThan(0);
      }
    }
    expect(assists / goals).toBeGreaterThan(ASSIST_SHARE - 0.08);
    expect(assists / goals).toBeLessThan(ASSIST_SHARE + 0.08);
  });
});

describe("career totals (D143)", () => {
  const report = (extra: Partial<PlayerMatchReport>): PlayerMatchReport => ({
    side: "home",
    minutes: 90,
    energy: 70,
    yellowCards: 0,
    redCard: false,
    injuryWeeks: 0,
    goals: 1,
    assists: 2,
    tackles: 3,
    saves: 0,
    ...extra,
  });

  it("adds a game and its result for a player who got on the pitch", () => {
    expect(matchStats(report({}), "win")).toEqual({
      games: 1,
      wins: 1,
      draws: 0,
      losses: 0,
      goals: 1,
      assists: 2,
      tackles: 3,
      saves: 0,
    });
    expect(matchStats(report({}), "draw").draws).toBe(1);
    expect(matchStats(report({}), "loss").losses).toBe(1);
  });

  it("adds nothing for an unused sub, a week off or no report", () => {
    expect(matchStats(report({ minutes: 0 }), "win")).toEqual(NO_STATS);
    expect(matchStats(report({}), null)).toEqual(NO_STATS);
    expect(matchStats(undefined, "win")).toEqual(NO_STATS);
  });

  it("shows win % once a player has played", () => {
    expect(winPercent({ wins: 0, draws: 0, losses: 0 })).toBeNull();
    expect(winPercent({ wins: 2, draws: 1, losses: 0 })).toBe(67);
  });
});
