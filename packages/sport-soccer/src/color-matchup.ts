/**
 * Color matchups as managers see them (D139, ADR 0003): which colors each
 * color beats, and how two starting 11s' dominant colors compare.
 */
import { colorEdge, rankedColors } from "@lfs/core";
import { SOCCER_COLOR_CYCLE } from "./match";

/**
 * The colors `color` beats and loses to, in ring order: the next ones round
 * the rainbow, and the ones just before it.
 */
export function colorMatchups(
  color: number,
  ring: readonly number[] = SOCCER_COLOR_CYCLE,
): {
  beats: number[];
  losesTo: number[];
} {
  const n = ring.length;
  const i = ring.indexOf(color);
  if (i < 0) return { beats: [], losesTo: [] };
  const half = (n - 1) / 2;
  const at = (k: number) => ring[(((i + k) % n) + n) % n] as number;
  return {
    beats: Array.from({ length: half }, (_, k) => at(k + 1)),
    losesTo: Array.from({ length: half }, (_, k) => at(k - half)),
  };
}

export interface DominantMatchup {
  /** Each side's dominant color on the pitch, null when there isn't one. */
  mine: number | null;
  theirs: number | null;
  /** +1 when mine beats theirs, −1 when it loses, 0 otherwise. */
  edge: -1 | 0 | 1;
}

/** How two starting 11s' dominant colors compare (D119's team matchup). */
export function dominantMatchup(
  mine: readonly { chemistryColor: number }[],
  theirs: readonly { chemistryColor: number }[],
  cycle: readonly number[] = SOCCER_COLOR_CYCLE,
): DominantMatchup {
  const a = rankedColors(mine.map((p) => p.chemistryColor)).first;
  const b = rankedColors(theirs.map((p) => p.chemistryColor)).first;
  return {
    mine: a,
    theirs: b,
    edge: a !== null && b !== null ? colorEdge(a, b, cycle) : 0,
  };
}
