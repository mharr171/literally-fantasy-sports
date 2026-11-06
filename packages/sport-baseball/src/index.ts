/**
 * Baseball's stand-in (ADR 0007 §12, D207): just enough of a sport for the
 * framework to carry a second one while M16 is built, hidden from players.
 * M17 replaces it with the real engine (D194–D204).
 */
import {
  createRng,
  type MatchInput,
  type MatchOutput,
  type MatchResult,
  type Seed,
  type Sport,
  type StatDef,
} from "@lfs/core";
import { PLAYERS_ON_FIELD } from "./generation";

/** A stand-in club: a name and nine players (one lineup group). */
export interface StandInTeam {
  name: string;
  battingOrder: readonly string[];
}

export interface StandInEvent {
  inning: number;
  side: "home" | "away";
  runs: number;
}

export const BASEBALL_STATS: readonly StatDef[] = [
  { key: "games", label: "Games", short: "G", kind: "total" },
];

/**
 * A stand-in game: each side scores 0–2 runs in each of 9 innings, at
 * random from the seed, and a tie goes to extra innings (no draws, D194).
 */
export function simulateStandIn(
  _input: MatchInput<StandInTeam, Record<string, never>>,
  seed: Seed,
): MatchOutput<StandInEvent, MatchResult> {
  const rng = createRng(seed).fork("stand-in");
  const score = { home: 0, away: 0 };
  const events: StandInEvent[] = [];
  for (let inning = 1; inning <= 30; inning++) {
    for (const side of ["away", "home"] as const) {
      const runs = rng.int(0, 2);
      score[side] += runs;
      events.push({ inning, side, runs });
    }
    if (inning >= 9 && score.home !== score.away) break;
  }
  return {
    result: {
      score,
      winner: score.home > score.away ? "home" : "away",
      ...(events.length > 18 ? { decidedBy: "extra_innings" } : {}),
    },
    events,
  };
}

export const baseball: Sport<
  StandInTeam,
  Record<string, never>,
  StandInEvent,
  MatchResult
> = {
  id: "baseball",
  name: "Baseball",
  playersOnField: PLAYERS_ON_FIELD,
  results: {
    allowsDraws: false,
    points: { win: 1, draw: 0, loss: 0 },
    scoreName: { one: "run", many: "runs" },
    tiebreaks: [{ key: "extra_innings", label: "in extra innings" }],
  },
  stats: BASEBALL_STATS,
  simulate: simulateStandIn,
};

export * from "./attributes";
export * from "./game";
export * from "./generation";
export * from "./overall";
export * from "./pitching";
export * from "./player";
export * from "./positions";
export * from "./profiles";
export * from "./skill";
