/**
 * Tuning harness (roadmap Step 4): plays thousands of matches between
 * generated teams and reports the numbers the sim is tuned against.
 * Targets: about 2.5–2.8 goals per match and roughly 25% draws.
 */
import { createRng, type Rng } from "@lfs/core";
import {
  ATTRIBUTE_MAX,
  ATTRIBUTE_MIN,
  type Attributes,
  OUTFIELD_ATTRIBUTES,
} from "./attributes";
import {
  defaultSoccerConfig,
  type SoccerConfig,
  type SoccerTeam,
  simulateMatch,
} from "./match";
import type { Position } from "./positions";

/** A plain 4-4-2 used for generated teams. */
export const HARNESS_FORMATION: Position[] = [
  "GK",
  "LB",
  "CB",
  "CB",
  "RB",
  "LM",
  "CM",
  "CM",
  "RM",
  "ST",
  "ST",
];

const clamp = (v: number) =>
  Math.max(ATTRIBUTE_MIN, Math.min(ATTRIBUTE_MAX, Math.round(v)));

/** A team whose attributes centre on `strength` (1–99), varied by ±6 or so. */
export function generateTeam(
  rng: Rng,
  id: string,
  strength: number,
): SoccerTeam {
  return {
    id,
    lineup: HARNESS_FORMATION.map((slot, i) => {
      const attributes = {} as Attributes;
      for (const key of OUTFIELD_ATTRIBUTES)
        attributes[key] = clamp(rng.normal(strength, 6));
      attributes.goalkeeping =
        slot === "GK"
          ? clamp(rng.normal(strength, 6))
          : clamp(rng.normal(15, 5));
      return {
        slot,
        player: {
          id: `${id}-${i}`,
          attributes,
          primaryPosition: slot,
          secondaryPosition: null,
          chemistryColor: rng.int(0, 4),
        },
      };
    }),
  };
}

export interface HarnessOptions {
  matches: number;
  seed: string;
  /** Strength gaps (stronger minus weaker) to report win rates for. */
  gaps?: number[];
  baseStrength?: number;
  config?: SoccerConfig;
}

export interface HarnessReport {
  matches: number;
  goalsPerMatch: number;
  drawRate: number;
  homeWinRate: number;
  /** Share of matches with 5+ goals, a sanity check on blowouts. */
  highScoringRate: number;
  /** Win / draw / loss rate of the stronger team at each strength gap. */
  byGap: { gap: number; win: number; draw: number; loss: number }[];
}

export function runHarness(options: HarnessOptions): HarnessReport {
  const config = options.config ?? defaultSoccerConfig();
  const base = options.baseStrength ?? 60;
  const gaps = options.gaps ?? [0, 5, 10, 15, 20];
  const rng = createRng(options.seed);
  let goals = 0;
  let draws = 0;
  let homeWins = 0;
  let highScoring = 0;
  const perGap = gaps.map((gap) => ({ gap, win: 0, draw: 0, loss: 0, n: 0 }));

  for (let i = 0; i < options.matches; i++) {
    const bucket = perGap[i % perGap.length] as (typeof perGap)[number];
    // Alternate which side is stronger so home/away doesn't skew the gaps.
    const strongHome = i % 2 === 0;
    const strong = generateTeam(rng, `s${i}`, base + bucket.gap / 2);
    const weak = generateTeam(rng, `w${i}`, base - bucket.gap / 2);
    const { result } = simulateMatch(
      {
        home: strongHome ? strong : weak,
        away: strongHome ? weak : strong,
        mode: "league",
        config,
      },
      `${options.seed}:${i}`,
    );
    const total = result.score.home + result.score.away;
    goals += total;
    if (total >= 5) highScoring++;
    if (result.winner === null) draws++;
    if (result.winner === "home") homeWins++;
    bucket.n++;
    const strongSide = strongHome ? "home" : "away";
    if (result.winner === null) bucket.draw++;
    else if (result.winner === strongSide) bucket.win++;
    else bucket.loss++;
  }

  const n = options.matches;
  return {
    matches: n,
    goalsPerMatch: goals / n,
    drawRate: draws / n,
    homeWinRate: homeWins / n,
    highScoringRate: highScoring / n,
    byGap: perGap.map(({ gap, win, draw, loss, n: m }) => ({
      gap,
      win: m ? win / m : 0,
      draw: m ? draw / m : 0,
      loss: m ? loss / m : 0,
    })),
  };
}

const pct = (x: number) => `${(x * 100).toFixed(1)}%`;

export function formatReport(r: HarnessReport): string {
  const lines = [
    `Matches:          ${r.matches}`,
    `Goals per match:  ${r.goalsPerMatch.toFixed(2)}   (target 2.5–2.8)`,
    `Draws:            ${pct(r.drawRate)}   (target ~25%)`,
    `Home wins:        ${pct(r.homeWinRate)}   (no home advantage yet)`,
    `5+ goal matches:  ${pct(r.highScoringRate)}`,
    "",
    "Stronger team by rating gap:",
    "  gap   win     draw    loss",
    ...r.byGap.map(
      (g) =>
        `  ${String(g.gap).padStart(3)}   ${pct(g.win).padEnd(7)} ${pct(g.draw).padEnd(7)} ${pct(g.loss)}`,
    ),
  ];
  return lines.join("\n");
}
