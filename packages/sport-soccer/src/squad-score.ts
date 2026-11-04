/**
 * Squad helpers for the squad builder (D110): how auto-pick weighs a
 * player's fitness and form, a rotated pick that rests tired starters, and
 * a score for the current starting 11.
 */
import { type ChemistryBoosts, DEFAULT_CHEMISTRY_BOOSTS } from "@lfs/core";
import { formModifier } from "./form";
import { DEFAULT_MATCH_TUNING, type MatchTuning } from "./match";
import { lineupChemistry, slotRating } from "./matchday";
import type { SoccerPlayer } from "./player";
import type { Position } from "./positions";

/**
 * How much more a rotated pick weighs fitness than a normal one (D110).
 * At 3, a starter at 70 fitness counts as about 27% weaker instead of 9%,
 * so a fresh player a few points lower takes his place.
 */
export const ROTATION_FITNESS_EMPHASIS = 3;

/**
 * Multiplies a player's rating when auto-pick chooses (D97): tiredness
 * costs what it costs at kickoff, times `fitnessEmphasis` when rotating,
 * and form nudges it like in matches.
 */
export function pickWeight(
  fitness: number,
  form: number,
  fitnessEmphasis = 1,
  tuning: MatchTuning = DEFAULT_MATCH_TUNING,
): number {
  const tiredness = Math.min(
    0.95,
    tuning.fatiguePenalty * fitnessEmphasis * ((100 - fitness) / 100),
  );
  return (1 - tiredness) * (1 + formModifier(form, 0));
}

export interface ScoredStarter {
  player: SoccerPlayer;
  slot: Position;
  /** This week's fitness and form weight (from `pickWeight`); 1 if fresh. */
  weight?: number;
}

export interface SquadScore {
  /** Average rating of the starters in their slots, with chemistry. */
  base: number;
  /** The same, counting this week's fitness and form. */
  today: number;
}

/** A starting 11's score (D110); empty slots count as nothing. */
export function squadScore(
  starters: readonly ScoredStarter[],
  slots = 11,
  boosts: ChemistryBoosts = DEFAULT_CHEMISTRY_BOOSTS,
): SquadScore {
  const chemistry = lineupChemistry(
    starters.map((s) => s.player),
    boosts,
  );
  let base = 0;
  let today = 0;
  starters.forEach((s, i) => {
    const rating = slotRating(s.player, s.slot) * (1 + (chemistry[i] ?? 0));
    base += rating;
    today += rating * (s.weight ?? 1);
  });
  return { base: base / slots, today: today / slots };
}

export interface ColorShare {
  color: number;
  count: number;
  /** 0–1 of the players given. */
  share: number;
}

/**
 * How a group of players splits across chemistry colors (D111), biggest
 * first, ties by color. Colors nobody has are left out.
 */
export function chemistryShares(
  players: readonly { chemistryColor: number }[],
): ColorShare[] {
  const counts = new Map<number, number>();
  for (const p of players)
    counts.set(p.chemistryColor, (counts.get(p.chemistryColor) ?? 0) + 1);
  return [...counts]
    .map(([color, count]) => ({
      color,
      count,
      share: players.length ? count / players.length : 0,
    }))
    .sort((a, b) => b.count - a.count || a.color - b.color);
}
