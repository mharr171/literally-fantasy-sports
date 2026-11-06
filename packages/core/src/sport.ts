/**
 * The contract every sport package implements (`packages/sport-*`).
 * Core never imports a sport; the web app and tools look sports up by id.
 * See docs/adr/0001-sport-interface.md for why it looks like this.
 */
import type { GridSize, InfluenceMap } from "./grid";
import type { Seed } from "./rng";
import type { PointsRule } from "./season";

export type SportId =
  | "soccer"
  | "baseball"
  | "paintball"
  | "football"
  | "basketball"
  | "hockey";

export type Side = "home" | "away";

/** Regular-season matches may end level; knockout matches must produce a winner. */
export type MatchMode = "league" | "knockout";

export interface MatchInput<TTeam, TConfig> {
  home: TTeam;
  away: TTeam;
  mode: MatchMode;
  /** The versioned tuning values and templates the match uses (from game_config). */
  config: TConfig;
}

export interface MatchResult {
  /** Points, goals or runs, in the sport's own unit. */
  score: Record<Side, number>;
  /** null only for a draw, which knockout matches never return. */
  winner: Side | null;
  /** How the winner was decided when regulation ended level (e.g. "extra_time", "penalties"). */
  decidedBy?: string;
}

export interface MatchOutput<
  TEvent,
  TResult extends MatchResult = MatchResult,
> {
  result: TResult;
  /** Play-by-play, in order. */
  events: TEvent[];
  /** Each side's influence over the playing surface, for heatmaps. */
  influence: Record<Side, InfluenceMap>;
}

/**
 * How a sport's results count (ADR 0007 §6): draws, league points, what a
 * score is called and how a level knockout game is settled.
 */
export interface ResultRules {
  /** Whether league games can end level. */
  allowsDraws: boolean;
  /** League points for a win, draw and loss. */
  points: PointsRule;
  /** What one point of score is called, e.g. "goal" and "goals". */
  scoreName: { one: string; many: string };
  /**
   * How a knockout game level after regulation is settled, as the
   * `decidedBy` keys the engine returns and their labels, in order, e.g.
   * extra time, then penalties.
   */
  tiebreaks: readonly { key: string; label: string }[];
}

/**
 * One stat a sport keeps for its players (ADR 0007 §2). Totals are stored;
 * a rate is worked out from two totals when shown, e.g. batting average =
 * hits ÷ at-bats, or ERA = earned runs × 9 ÷ innings.
 */
export type StatDef =
  | { key: string; label: string; short: string; kind: "total" }
  | {
      key: string;
      label: string;
      short: string;
      kind: "rate";
      numerator: string;
      denominator: string;
      /** Multiplies the ratio, e.g. 9 for ERA. 1 by default. */
      scale?: number;
      /** Decimal places when shown, e.g. 3 for batting average. */
      decimals?: number;
    };

/** A stat's value from stored totals; null for a rate with nothing to divide by. */
export function statValue(
  def: StatDef,
  totals: Readonly<Record<string, number | undefined>>,
): number | null {
  if (def.kind === "total") return totals[def.key] ?? 0;
  const den = totals[def.denominator] ?? 0;
  if (den === 0) return null;
  return ((totals[def.numerator] ?? 0) / den) * (def.scale ?? 1);
}

export interface Sport<
  TTeam,
  TConfig,
  TEvent,
  TResult extends MatchResult = MatchResult,
> {
  id: SportId;
  name: string;
  /**
   * Influence grid for heatmaps and templates (soccer: 17 × 25). Optional:
   * a sport may draw its players another way (ADR 0007 §1, D206.6).
   */
  grid?: GridSize;
  /** Players on the field per side; drives chemistry colour count (D42/D51). */
  playersOnField: number;
  /** How results count (ADR 0007 §6). */
  results: ResultRules;
  /** The stats the sport keeps, in the order they're shown (ADR 0007 §2). */
  stats: readonly StatDef[];
  /**
   * Plays one match. Must be pure and deterministic: the same input and seed
   * always return the same output, and all randomness comes from the seed.
   */
  simulate(
    input: MatchInput<TTeam, TConfig>,
    seed: Seed,
  ): MatchOutput<TEvent, TResult>;
}
