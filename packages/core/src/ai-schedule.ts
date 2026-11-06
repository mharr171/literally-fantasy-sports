/**
 * When AI clubs play (D114, D177), the same for every sport: pace, how many
 * scheduled runs a run makes up for, and how many weeks a club plays in one.
 * Moved from soccer's AI manager (ADR 0007 §8); the numbers are unchanged.
 */
import type { Rng } from "./rng";

/** How fast an AI club plays (D114). */
export type Pace = "slow" | "normal" | "fast";

/** Seasons a day by pace (D114, proposed defaults, adjustable in admin). */
export const PACE_SEASONS_PER_DAY: Record<Pace, number> = {
  slow: 0.5,
  normal: 1,
  fast: 2,
};

/** Share of AI clubs at each pace (ADR 0002). */
export const PACE_SHARE: Record<Pace, number> = {
  slow: 0.3,
  normal: 0.5,
  fast: 0.2,
};

/** A run catches up for at most this many missed runs (D177). */
export const MAX_RUNS_OWED = 6;

/**
 * How many scheduled runs' worth of play a run is owed (D177): the time
 * since the last finished run over the time between runs, so a run that
 * comes late (GitHub's schedule is best effort) catches up and one started
 * soon after another plays little. Capped at MAX_RUNS_OWED; a first run
 * counts as one.
 */
export function runsOwed(
  lastRunAt: string | null,
  now: Date,
  runsPerDay: number,
): number {
  if (!lastRunAt) return 1;
  const hours = (now.getTime() - new Date(lastRunAt).getTime()) / 3_600_000;
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.min(MAX_RUNS_OWED, hours / (24 / runsPerDay));
}

/**
 * Weeks an AI club tries to play in one scheduled run (D114): its pace's
 * share of a 26-week season, spread over the day's runs, rounded at random
 * so the average comes out right. Energy may allow fewer.
 */
export function weeksThisRun(
  rng: Rng,
  pace: Pace,
  runsPerDay: number,
  seasonWeeks = 26,
  paceSeasonsPerDay: Record<Pace, number> = PACE_SEASONS_PER_DAY,
  /** Scheduled runs this one stands for (see `runsOwed`); 1 by default. */
  runs = 1,
): number {
  const expected =
    ((paceSeasonsPerDay[pace] * seasonWeeks) / runsPerDay) * runs;
  const whole = Math.floor(expected);
  return whole + (rng.next() < expected - whole ? 1 : 0);
}
