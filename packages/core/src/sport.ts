/**
 * The contract every sport package implements (`packages/sport-*`).
 * Core never imports a sport; the web app and tools look sports up by id.
 * See docs/adr/0001-sport-interface.md for why it looks like this.
 */
import type { GridSize, InfluenceMap } from "./grid";
import type { Seed } from "./rng";

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

export interface Sport<
  TTeam,
  TConfig,
  TEvent,
  TResult extends MatchResult = MatchResult,
> {
  id: SportId;
  name: string;
  /** Influence grid for heatmaps and templates (soccer: 17 × 25). */
  grid: GridSize;
  /** Players on the field per side; drives chemistry colour count (D42/D51). */
  playersOnField: number;
  /** Whether league matches can end in a draw. */
  allowsDraws: boolean;
  /**
   * Plays one match. Must be pure and deterministic: the same input and seed
   * always return the same output, and all randomness comes from the seed.
   */
  simulate(
    input: MatchInput<TTeam, TConfig>,
    seed: Seed,
  ): MatchOutput<TEvent, TResult>;
}
