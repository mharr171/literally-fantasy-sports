/**
 * The bench in a game (ADR 0008 §6, D212). Each bench player has a role
 * the engine uses automatically, as it does the bullpen plan:
 * - pinch hitter: from the 7th, when his side is behind or level, he bats
 *   for the weakest hitter due up, if clearly better against this pitcher;
 * - pinch runner: from the 8th in a close game, he runs for a slow runner;
 * - defensive replacement: from the 8th with a lead, he takes over from
 *   the weakest fielder at a position he can play;
 * - injury cover: anyone left on the bench covers an injury, best fit first.
 * A role may name the starter it replaces. A player taken out can't come
 * back (MLB's rule), and the new player takes over the position.
 */
import { battingRating, fieldingRating, overallAt } from "./overall";
import type { BaseballPlayer } from "./player";
import type { BatterPosition } from "./positions";
import { DEFAULT_SKILL_TUNING, positionFit } from "./skill";

export type BenchRole = "pinchHitter" | "pinchRunner" | "defense" | "injury";

export interface BenchPlayer {
  player: BaseballPlayer;
  role: BenchRole;
  /** The starter this one replaces; the weakest fit when left out. */
  replaces?: string;
}

export interface BenchTuning {
  pinchHitFrom: number;
  /** A pinch hitter's Bat must beat the batter's by this much. */
  pinchHitMargin: number;
  pinchRunFrom: number;
  /** A pinch runner's speed must beat the runner's by this much. */
  pinchRunMargin: number;
  /** "Close": within this many runs. */
  closeRuns: number;
  defenseFrom: number;
  /** A replacement's Field (with fit) must beat the fielder's by this much. */
  defenseMargin: number;
  /** Chance per plate appearance the batter gets hurt, and the days out. */
  injuryPerPlateAppearance: number;
  injuryDays: readonly [number, number];
}

export const DEFAULT_BENCH_TUNING: BenchTuning = {
  pinchHitFrom: 7,
  pinchHitMargin: 5,
  pinchRunFrom: 8,
  pinchRunMargin: 10,
  closeRuns: 2,
  defenseFrom: 8,
  defenseMargin: 5,
  injuryPerPlateAppearance: 0.0015,
  injuryDays: [1, 15],
};

type Slot = { player: BaseballPlayer; slot: BatterPosition };

const free = (
  bench: readonly BenchPlayer[],
  used: ReadonlySet<string>,
  role: BenchRole | null,
  replacing: string,
) =>
  bench.filter(
    (b) =>
      !used.has(b.player.id) &&
      (role === null || b.role === role) &&
      (b.replaces === undefined || b.replaces === replacing),
  );

/** How well a player fields a slot, with position fit (the DH fields nothing). */
const fieldingAt = (p: BaseballPlayer, slot: BatterPosition) => {
  const fit = DEFAULT_SKILL_TUNING.positionFit[positionFit(p, slot)];
  return (fieldingRating(p.attributes, slot) ?? 0) * (1 + fit);
};

/** A pinch hitter for `batter`, or null. */
export function choosePinchHitter(input: {
  bench: readonly BenchPlayer[];
  used: ReadonlySet<string>;
  batter: BaseballPlayer;
  inning: number;
  /** The batting side is behind or level. */
  needRuns: boolean;
  tuning?: BenchTuning;
}): BenchPlayer | null {
  const t = input.tuning ?? DEFAULT_BENCH_TUNING;
  if (input.inning < t.pinchHitFrom || !input.needRuns) return null;
  const bar = battingRating(input.batter.attributes) + t.pinchHitMargin;
  const best = free(input.bench, input.used, "pinchHitter", input.batter.id)
    .filter((b) => battingRating(b.player.attributes) >= bar)
    .sort(
      (a, b) =>
        battingRating(b.player.attributes) - battingRating(a.player.attributes),
    )[0];
  return best ?? null;
}

/** A pinch runner for `runner`, or null. */
export function choosePinchRunner(input: {
  bench: readonly BenchPlayer[];
  used: ReadonlySet<string>;
  runner: BaseballPlayer;
  inning: number;
  /** The score is within `closeRuns`. */
  close: boolean;
  tuning?: BenchTuning;
}): BenchPlayer | null {
  const t = input.tuning ?? DEFAULT_BENCH_TUNING;
  if (input.inning < t.pinchRunFrom || !input.close) return null;
  const bar = input.runner.attributes.speed + t.pinchRunMargin;
  const best = free(input.bench, input.used, "pinchRunner", input.runner.id)
    .filter((b) => b.player.attributes.speed >= bar)
    .sort((a, b) => b.player.attributes.speed - a.player.attributes.speed)[0];
  return best ?? null;
}

/** The defensive replacement with the biggest gain, and whom he replaces. */
export function chooseDefense(input: {
  bench: readonly BenchPlayer[];
  used: ReadonlySet<string>;
  lineup: readonly Slot[];
  inning: number;
  leading: boolean;
  tuning?: BenchTuning;
}): { index: number; sub: BenchPlayer } | null {
  const t = input.tuning ?? DEFAULT_BENCH_TUNING;
  if (input.inning < t.defenseFrom || !input.leading) return null;
  let best: { index: number; sub: BenchPlayer } | null = null;
  let bestGain = t.defenseMargin;
  for (const [index, s] of input.lineup.entries()) {
    if (s.slot === "DH") continue;
    for (const sub of free(input.bench, input.used, "defense", s.player.id)) {
      if (positionFit(sub.player, s.slot) === "other") continue;
      const gain =
        fieldingAt(sub.player, s.slot) - fieldingAt(s.player, s.slot);
      if (gain >= bestGain) {
        best = { index, sub };
        bestGain = gain;
      }
    }
  }
  return best;
}

/** Who covers an injured player at `slot`: anyone left, best fit first. */
export function chooseInjuryCover(input: {
  bench: readonly BenchPlayer[];
  used: ReadonlySet<string>;
  injured: Slot;
}): BenchPlayer | null {
  const score = (p: BaseballPlayer) => {
    const fit =
      DEFAULT_SKILL_TUNING.positionFit[positionFit(p, input.injured.slot)];
    return overallAt(p.attributes, input.injured.slot) * (1 + fit);
  };
  return (
    free(input.bench, input.used, null, input.injured.player.id)
      .filter((b) => b.player.primaryPosition !== "P")
      .sort((a, b) => score(b.player) - score(a.player))[0] ?? null
  );
}
