/**
 * Player worth (D55, D73) and the bulk resale price. Sport-agnostic: every
 * sport rates players with a 1–99 overall, an age and a shown potential range.
 *
 * worth = base × growth^(overall − 50) × age factor × potential factor,
 * rounded to the nearest `roundTo`.
 */

export interface WorthSettings {
  /** Worth of a 50-overall player in their prime with no growth shown. */
  base: number;
  /** Multiplier per overall point (1.08 ≈ doubles every 9 points). */
  growthPerPoint: number;
  /** Age factors, checked in order: the first band whose maxAge fits applies. */
  ageBands: { maxAge: number; factor: number }[];
  /** Extra worth per point the shown potential midpoint sits above the overall. */
  potentialBonusPerPoint: number;
  roundTo: number;
  /** Share of worth paid when bulk-reselling a pack player (kept below sale value, D55). */
  resaleRate: number;
}

/** Approved by Gary (D85). */
export const DEFAULT_WORTH_SETTINGS: WorthSettings = {
  base: 1000,
  growthPerPoint: 1.08,
  ageBands: [
    { maxAge: 21, factor: 1.2 },
    { maxAge: 29, factor: 1.0 },
    { maxAge: 31, factor: 0.8 },
    { maxAge: Number.POSITIVE_INFINITY, factor: 0.6 },
  ],
  potentialBonusPerPoint: 0.04,
  roundTo: 50,
  resaleRate: 0.25,
};

export interface WorthInput {
  overall: number;
  age: number;
  /**
   * The range managers see. Worth uses its midpoint, never the hidden true
   * potential, so a player's price can't give the secret away.
   */
  potentialRange: readonly [number, number];
}

const roundToNearest = (value: number, step: number) =>
  Math.max(step, Math.round(value / step) * step);

export function ageFactor(
  age: number,
  settings: WorthSettings = DEFAULT_WORTH_SETTINGS,
): number {
  for (const band of settings.ageBands)
    if (age <= band.maxAge) return band.factor;
  /* v8 ignore next */
  return settings.ageBands.at(-1)?.factor ?? 1;
}

export function playerWorth(
  input: WorthInput,
  settings: WorthSettings = DEFAULT_WORTH_SETTINGS,
): number {
  const [low, high] = input.potentialRange;
  const headroom = Math.max(0, (low + high) / 2 - input.overall);
  const raw =
    settings.base *
    settings.growthPerPoint ** (input.overall - 50) *
    ageFactor(input.age, settings) *
    (1 + settings.potentialBonusPerPoint * headroom);
  return roundToNearest(raw, settings.roundTo);
}

/** What bulk-reselling a pack player pays. Starter-pack players pay nothing (D83). */
export function resalePrice(
  worth: number,
  settings: WorthSettings = DEFAULT_WORTH_SETTINGS,
): number {
  return roundToNearest(worth * settings.resaleRate, settings.roundTo);
}
