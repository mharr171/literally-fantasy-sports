/**
 * Picking a game-day squad (D196, D212): the batting order of 9 with the
 * DH, the rotation, the bullpen and the bench with roles. Managers can
 * pick by hand in M18; AI clubs and the "auto-pick" button use this.
 *
 * The lineup style tilts how auto-pick weighs Bat against Field: Balanced
 * uses each position's own weights, Bat first and Glove first move each
 * position's batting share up or down. It changes only the choosing; the
 * game always uses the real weights.
 */
import type { BenchPlayer, BenchRole } from "./bench";
import {
  battingRating,
  DEFAULT_OVERALL_WEIGHTS,
  fieldingRating,
  type OverallWeights,
  overallAt,
} from "./overall";
import type { BaseballPlayer } from "./player";
import type { BatterPosition } from "./positions";
import { DEFAULT_SKILL_TUNING, positionFit } from "./skill";

export type LineupStyle = "balanced" | "batFirst" | "gloveFirst";

/** How far Bat first and Glove first move each position's batting share. */
export const STYLE_TILT = 0.2;

/** The fielding positions, hardest to fill first, then the DH. */
const FILL_ORDER: readonly BatterPosition[] = [
  "C",
  "SS",
  "CF",
  "2B",
  "3B",
  "RF",
  "LF",
  "1B",
  "DH",
];

export const ROTATION_SIZE = 5;
export const BULLPEN_MAX = 8;
export const BENCH_MAX = 5;

export interface PickedSquad {
  /** The batting order, with each batter's position. */
  batters: { player: BaseballPlayer; slot: BatterPosition }[];
  /** Starters in rotation order. */
  rotation: BaseballPlayer[];
  bullpen: BaseballPlayer[];
  bench: BenchPlayer[];
}

export interface PickOptions {
  style?: LineupStyle;
  /** False for injured players; they're never picked. */
  available?: (id: string) => boolean;
  weights?: OverallWeights;
}

/** How auto-pick rates a batter in a slot: the styled overall, with position fit. */
export function styledRating(
  player: BaseballPlayer,
  slot: BatterPosition,
  style: LineupStyle = "balanced",
  weights: OverallWeights = DEFAULT_OVERALL_WEIGHTS,
): number {
  const share = weights.battingShare[slot];
  const tilt =
    slot === "DH" || style === "balanced"
      ? 0
      : style === "batFirst"
        ? STYLE_TILT
        : -STYLE_TILT;
  const styled = Math.min(1, Math.max(0, share + tilt));
  const bat = battingRating(player.attributes, weights);
  const field = fieldingRating(player.attributes, slot, weights) ?? 0;
  const fit = DEFAULT_SKILL_TUNING.positionFit[positionFit(player, slot)];
  return (bat * styled + field * (1 - styled)) * (1 + fit);
}

/**
 * The batting order for nine batters: the two best on-base hitters (eye and
 * contact) lead off, the three best power hitters bat 3–5, and the rest
 * follow by Bat.
 */
export function battingOrder<T extends { player: BaseballPlayer }>(
  batters: readonly T[],
): T[] {
  const onBase = (b: T) =>
    b.player.attributes.eye + b.player.attributes.contact;
  const power = (b: T) => b.player.attributes.power;
  const byId = (a: T, b: T) => a.player.id.localeCompare(b.player.id);
  const rest = [...batters];
  const take = (score: (b: T) => number, n: number) => {
    rest.sort((a, b) => score(b) - score(a) || byId(a, b));
    return rest.splice(0, n);
  };
  const middle = take(power, 3);
  const top = take(onBase, 2);
  const bottom = take((b) => battingRating(b.player.attributes), rest.length);
  return [...top, ...middle, ...bottom];
}

/** Auto-pick: the best squad from a roster, for a lineup style. */
export function autoPickSquad(
  roster: readonly BaseballPlayer[],
  options: PickOptions = {},
): PickedSquad {
  const style = options.style ?? "balanced";
  const weights = options.weights ?? DEFAULT_OVERALL_WEIGHTS;
  const ok = (p: BaseballPlayer) => options.available?.(p.id) ?? true;
  const hitters = roster.filter((p) => p.primaryPosition !== "P" && ok(p));
  const pitchers = roster.filter((p) => p.primaryPosition === "P" && ok(p));
  const byId = (a: BaseballPlayer, b: BaseballPlayer) =>
    a.id.localeCompare(b.id);

  const left = [...hitters];
  const placed: { player: BaseballPlayer; slot: BatterPosition }[] = [];
  for (const slot of FILL_ORDER) {
    left.sort(
      (a, b) =>
        styledRating(b, slot, style, weights) -
          styledRating(a, slot, style, weights) || byId(a, b),
    );
    const pick = left.shift();
    if (pick) placed.push({ player: pick, slot });
  }

  const sp = (p: BaseballPlayer) => overallAt(p.attributes, "SP", weights);
  const rp = (p: BaseballPlayer) => overallAt(p.attributes, "RP", weights);
  // Starters by preference first, then the best of the rest as starters.
  const arms = [...pitchers].sort(
    (a, b) =>
      Number(b.pitcherRole === "starter") -
        Number(a.pitcherRole === "starter") ||
      sp(b) - sp(a) ||
      byId(a, b),
  );
  const rotation = arms.slice(0, ROTATION_SIZE);
  const bullpen = arms
    .slice(ROTATION_SIZE)
    .sort((a, b) => rp(b) - rp(a) || byId(a, b))
    .slice(0, BULLPEN_MAX);

  const bench: BenchPlayer[] = [];
  const pool = [...left];
  const takeBest = (score: (p: BaseballPlayer) => number, role: BenchRole) => {
    pool.sort((a, b) => score(b) - score(a) || byId(a, b));
    const p = pool.shift();
    if (p) bench.push({ player: p, role });
  };
  // The pinch hitter leans to the hand the lineup is short of (D224).
  const lefties = placed.filter((b) => b.player.bats === "L").length;
  const shortOf = lefties * 2 < placed.length ? "L" : "R";
  takeBest(
    (p) =>
      battingRating(p.attributes, weights) +
      (p.bats === shortOf || p.bats === "S" ? 3 : 0),
    "pinchHitter",
  );
  takeBest((p) => p.attributes.speed, "pinchRunner");
  takeBest(
    (p) =>
      Math.max(
        ...FILL_ORDER.slice(0, 8).map(
          (s) => fieldingRating(p.attributes, s, weights) ?? 0,
        ),
      ),
    "defense",
  );
  while (bench.length < BENCH_MAX && pool.length > 0)
    takeBest((p) => battingRating(p.attributes, weights), "injury");

  return { batters: battingOrder(placed), rotation, bullpen, bench };
}
