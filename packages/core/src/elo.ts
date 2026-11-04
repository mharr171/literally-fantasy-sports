/**
 * Elo ratings. Works the same for every match: AI, ghost, regular season and
 * playoffs (D40). Ratings are whole numbers and every update is zero-sum.
 */

/** Points the scale: a 400-point gap means ~10:1 expected odds. */
const SCALE = 400;

export const DEFAULT_K_FACTOR = 32;

/** Expected score (0–1) for a team rated `rating` against `opponent`. */
export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - rating) / SCALE));
}

/** 1 for a win, 0.5 for a draw, 0 for a loss. */
export type MatchScore = 1 | 0.5 | 0;

export interface EloUpdate {
  /** New rating for the first team. */
  rating: number;
  /** New rating for the opponent. */
  opponent: number;
  /** Points the first team gained (negative if it lost points). */
  change: number;
}

/**
 * Updates both ratings after a match. `score` is from the first team's point
 * of view. The change is rounded to a whole number and applied with opposite
 * signs, so no rating points are created or lost.
 */
export function updateElo(
  rating: number,
  opponent: number,
  score: MatchScore,
  kFactor: number = DEFAULT_K_FACTOR,
): EloUpdate {
  if (!(kFactor > 0) || !Number.isFinite(kFactor)) {
    throw new RangeError(`Invalid K-factor: ${kFactor}`);
  }
  const raw = kFactor * (score - expectedScore(rating, opponent));
  // Math.round(-0.5) is -0; add 0 to normalize it.
  const change = Math.round(raw) + 0;
  return {
    rating: rating + change,
    opponent: opponent - change,
    change,
  };
}
