/**
 * Tuning harness (roadmap Step 4): plays thousands of matches between
 * generated teams and reports the numbers the sim is tuned against.
 * Targets: about 2.5–2.8 goals per match and roughly 25% draws.
 */
import { colorEdge, createRng, type Rng, rankedColors } from "@lfs/core";
import {
  ATTRIBUTE_MAX,
  ATTRIBUTE_MIN,
  type Attributes,
  OUTFIELD_ATTRIBUTES,
} from "./attributes";
import {
  defaultSoccerConfig,
  SOCCER_COLOR_CYCLE,
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

function generatePlayer(
  rng: Rng,
  id: string,
  strength: number,
  position: Position,
) {
  const attributes = {} as Attributes;
  for (const key of OUTFIELD_ATTRIBUTES)
    attributes[key] = clamp(rng.normal(strength, 6));
  attributes.goalkeeping =
    position === "GK"
      ? clamp(rng.normal(strength, 6))
      : clamp(rng.normal(15, 5));
  return {
    id,
    attributes,
    primaryPosition: position,
    secondaryPosition: null,
    chemistryColor: rng.int(0, 4),
  };
}

/**
 * A team whose attributes centre on `strength` (1–99), varied by ±6 or so,
 * with a full bench of 11 (one per starting position, a little weaker).
 */
export function generateTeam(
  rng: Rng,
  id: string,
  strength: number,
): SoccerTeam {
  return {
    id,
    lineup: HARNESS_FORMATION.map((slot, i) => ({
      slot,
      player: generatePlayer(rng, `${id}-${i}`, strength, slot),
    })),
    bench: HARNESS_FORMATION.map((slot, i) =>
      generatePlayer(rng, `${id}-b${i}`, strength - 4, slot),
    ),
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
  yellowsPerMatch: number;
  redsPerMatch: number;
  injuriesPerMatch: number;
  subsPerMatch: number;
  /** Win / draw / loss rate of the stronger team at each strength gap. */
  byGap: { gap: number; win: number; draw: number; loss: number }[];
  /**
   * Even teams (gap 0) where one side's dominant color beats the other's
   * (ADR 0003): that side's results. Matchups are off unless the config's
   * tuning turns them on.
   */
  colorMatchup: { matches: number; win: number; draw: number; loss: number };
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
  const counts = { yellow: 0, red: 0, injury: 0, sub: 0 };
  const perGap = gaps.map((gap) => ({ gap, win: 0, draw: 0, loss: 0, n: 0 }));
  const color = { matches: 0, win: 0, draw: 0, loss: 0 };
  const dominant = (t: SoccerTeam) =>
    rankedColors(t.lineup.map((s) => s.player.chemistryColor)).first;

  for (let i = 0; i < options.matches; i++) {
    const bucket = perGap[i % perGap.length] as (typeof perGap)[number];
    // Alternate which side is stronger so home/away doesn't skew the gaps.
    const strongHome = i % 2 === 0;
    const strong = generateTeam(rng, `s${i}`, base + bucket.gap / 2);
    const weak = generateTeam(rng, `w${i}`, base - bucket.gap / 2);
    const { result, events } = simulateMatch(
      {
        home: strongHome ? strong : weak,
        away: strongHome ? weak : strong,
        mode: "league",
        config,
      },
      `${options.seed}:${i}`,
    );
    for (const e of events) {
      if (e.type in counts) counts[e.type as keyof typeof counts]++;
    }
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

    if (bucket.gap === 0) {
      const a = dominant(strong);
      const b = dominant(weak);
      const edge =
        a !== null && b !== null ? colorEdge(a, b, SOCCER_COLOR_CYCLE) : 0;
      if (edge !== 0) {
        const winnerSide =
          edge > 0 ? strongSide : strongSide === "home" ? "away" : "home";
        color.matches++;
        if (result.winner === null) color.draw++;
        else if (result.winner === winnerSide) color.win++;
        else color.loss++;
      }
    }
  }

  const n = options.matches;
  return {
    matches: n,
    goalsPerMatch: goals / n,
    drawRate: draws / n,
    homeWinRate: homeWins / n,
    highScoringRate: highScoring / n,
    yellowsPerMatch: counts.yellow / n,
    redsPerMatch: counts.red / n,
    injuriesPerMatch: counts.injury / n,
    subsPerMatch: counts.sub / n,
    byGap: perGap.map(({ gap, win, draw, loss, n: m }) => ({
      gap,
      win: m ? win / m : 0,
      draw: m ? draw / m : 0,
      loss: m ? loss / m : 0,
    })),
    colorMatchup: {
      matches: color.matches,
      win: color.matches ? color.win / color.matches : 0,
      draw: color.matches ? color.draw / color.matches : 0,
      loss: color.matches ? color.loss / color.matches : 0,
    },
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
    `Yellow cards:     ${r.yellowsPerMatch.toFixed(2)} per match`,
    `Red cards:        ${r.redsPerMatch.toFixed(2)} per match`,
    `Injuries:         ${r.injuriesPerMatch.toFixed(2)} per match`,
    `Substitutions:    ${r.subsPerMatch.toFixed(2)} per match`,
    "",
    "Stronger team by rating gap:",
    "  gap   win     draw    loss",
    ...r.byGap.map(
      (g) =>
        `  ${String(g.gap).padStart(3)}   ${pct(g.win).padEnd(7)} ${pct(g.draw).padEnd(7)} ${pct(g.loss)}`,
    ),
    "",
    `Even teams, dominant color wins the matchup (${r.colorMatchup.matches} matches):`,
    `  win ${pct(r.colorMatchup.win)}   draw ${pct(r.colorMatchup.draw)}   loss ${pct(r.colorMatchup.loss)}`,
  ];
  return lines.join("\n");
}
