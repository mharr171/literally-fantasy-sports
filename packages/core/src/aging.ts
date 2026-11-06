/**
 * Aging rules every sport shares (D35, D154): young players grow toward
 * their potential, with their playing time; older ones decline and some
 * retire. Moved from soccer when baseball needed them (ADR 0009 §6).
 */
import type { Rng } from "./rng";

/** Balance defaults: changed only with Gary's OK. */
export interface AgingSettings {
  /** Players younger than this grow toward their potential. */
  peakAge: number;
  /** Share of the gap to potential closed in a year: a random value in this range. */
  growthShare: [number, number];
  /** From this age players decline. */
  declineAge: number;
  /** Overall lost per year by age: the first band whose maxAge fits. */
  decline: { maxAge: number; min: number; max: number }[];
  /** Chance of retiring at season end, by age. */
  retirement: { minAge: number; chance: number }[];
}

/** Soccer's aging, the default for every sport. */
export const DEFAULT_AGING: AgingSettings = {
  peakAge: 27,
  growthShare: [0.25, 0.6],
  declineAge: 31,
  decline: [
    { maxAge: 32, min: 1, max: 3 },
    { maxAge: 34, min: 2, max: 4 },
    { maxAge: Number.POSITIVE_INFINITY, min: 3, max: 6 },
  ],
  retirement: [
    { minAge: 37, chance: 0.85 },
    { minAge: 36, chance: 0.6 },
    { minAge: 35, chance: 0.4 },
    { minAge: 34, chance: 0.2 },
    { minAge: 33, chance: 0.1 },
  ],
};

/**
 * Growth from playing time (D154). `weight` 0 leaves growth as it was; at 1
 * a player who never played grows almost nothing. A player who played at
 * least `regularShare` of the club's minutes counts as a regular and grows
 * fully.
 */
export interface PlayingTimeGrowth {
  weight: number;
  /** The club's playing time this season, in the sport's unit (soccer: its own matches × 90 minutes). */
  clubMinutes: number;
  regularShare?: number;
}

/** Share of the club's minutes that makes a player a regular (D154). */
export const REGULAR_SHARE = 0.7;

/**
 * How much of a young player's usual growth he gets for the minutes he
 * played (D154): 1 for a regular, down to 1 − weight for a player who
 * didn't play.
 */
export function playingTimeFactor(
  seasonMinutes: number,
  growth: PlayingTimeGrowth | undefined,
): number {
  if (!growth || growth.weight <= 0 || growth.clubMinutes <= 0) return 1;
  const regular = growth.clubMinutes * (growth.regularShare ?? REGULAR_SHARE);
  const share = Math.min(1, Math.max(0, seasonMinutes) / regular);
  return 1 - growth.weight * (1 - share);
}

/** How much a player's overall changes over one year. */
export function yearlyChange(
  rng: Rng,
  player: {
    age: number;
    overall: number;
    potential: number;
    seasonMinutes?: number;
  },
  s: AgingSettings = DEFAULT_AGING,
  growth?: PlayingTimeGrowth,
): number {
  const nextAge = player.age + 1;
  if (nextAge <= s.peakAge) {
    const gap = player.potential - player.overall;
    if (gap <= 0) return 0;
    const share = rng.float(s.growthShare[0], s.growthShare[1]);
    // Regulars grow fully; players who rarely played grow less (D154).
    const factor = playingTimeFactor(player.seasonMinutes ?? 0, growth);
    if (factor === 1)
      return Math.max(1, Math.min(gap, Math.round(gap * share)));
    return Math.max(0, Math.min(gap, Math.round(gap * share * factor)));
  }
  if (nextAge < s.declineAge) return rng.int(-1, 1);
  const band = s.decline.find((b) => nextAge <= b.maxAge) ?? s.decline.at(-1);
  /* v8 ignore next */
  if (!band) return 0;
  return -rng.int(band.min, band.max);
}

export function retirementChance(
  age: number,
  s: AgingSettings = DEFAULT_AGING,
): number {
  return s.retirement.find((r) => age >= r.minAge)?.chance ?? 0;
}
