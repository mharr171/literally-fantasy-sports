/**
 * Chemistry colours (D37, D42–D44, D51–D52). Every player has a permanent,
 * random colour. On the field, players in the largest colour group get a
 * gameday boost; in sports with 4+ colours the second-largest group gets a
 * smaller one. Recalculated whenever a substitution changes who is on.
 */
import type { Rng } from "./rng";

/** Flat boosts per rank, set per sport in admin (D44). 0.25 = +25%. */
export interface ChemistryBoosts {
  /** Largest group, no tie. */
  largestAlone: number;
  /** Each group tied for largest. A tie for first uses up second place (D52). */
  largestTied: number;
  /** Second-largest group, no tie (4+ colours only). */
  secondAlone: number;
  /** Each group tied for second (4+ colours only). */
  secondTied: number;
  /** Smallest group that can earn a boost; smaller groups are ignored (D79). */
  minGroupSize: number;
}

/** Defaults from the roadmap's chemistry table (Step 4). */
export const DEFAULT_CHEMISTRY_BOOSTS: ChemistryBoosts = {
  largestAlone: 0.25,
  largestTied: 0.15,
  secondAlone: 0.1,
  secondTied: 0.05,
  minGroupSize: 2,
};

/** Colours per sport: n ÷ 3 + 1, rounded, minimum 3 (D51). Soccer (11) → 5. */
export function chemistryColorCount(playersOnField: number): number {
  if (!Number.isInteger(playersOnField) || playersOnField < 1) {
    throw new RangeError(`Invalid players on field: ${playersOnField}`);
  }
  return Math.max(3, Math.round(playersOnField / 3 + 1));
}

/** A new player's permanent colour, 0 … colorCount − 1 (D42). */
export function rollChemistryColor(rng: Rng, colorCount: number): number {
  return rng.int(0, colorCount - 1);
}

/**
 * The boost for each colour given the colours of the players on the field.
 * Returns an array indexed by colour; colours with no boost (or not on the
 * field) get 0.
 *
 * Examples (soccer, default boosts):
 * - 5/3/2/1 → +25% and +10%
 * - 4/4/2/1 → +15% for each 4, nothing for the 2
 * - 5/2/2/2 → +25%, and +5% for each 2
 * - 10/1 → +25%; the lone player gets nothing (groups need 2+ players, D79)
 */
export function chemistryBoostsByColor(
  colorsOnField: readonly number[],
  colorCount: number,
  boosts: ChemistryBoosts = DEFAULT_CHEMISTRY_BOOSTS,
): number[] {
  if (!Number.isInteger(colorCount) || colorCount < 1) {
    throw new RangeError(`Invalid colour count: ${colorCount}`);
  }
  const counts = new Array<number>(colorCount).fill(0);
  for (const color of colorsOnField) {
    if (!Number.isInteger(color) || color < 0 || color >= colorCount) {
      throw new RangeError(`Invalid colour ${color} for ${colorCount} colours`);
    }
    counts[color] = (counts[color] as number) + 1;
  }

  const result = new Array<number>(colorCount).fill(0);
  // Groups below the minimum size don't rank at all (D79).
  const minSize = Math.max(1, boosts.minGroupSize);
  const sizes = [...new Set(counts.filter((c) => c >= minSize))].sort(
    (a, b) => b - a,
  );
  const largest = sizes[0];
  if (largest === undefined) return result;

  const groupsOfSize = (size: number) =>
    counts.flatMap((c, color) => (c === size ? [color] : []));

  const first = groupsOfSize(largest);
  if (first.length > 1) {
    // A tie for first uses up first and second place (D52).
    for (const color of first) result[color] = boosts.largestTied;
    return result;
  }
  result[first[0] as number] = boosts.largestAlone;

  const secondSize = sizes[1];
  if (colorCount < 4 || secondSize === undefined) return result;
  const second = groupsOfSize(secondSize);
  const secondBoost =
    second.length > 1 ? boosts.secondTied : boosts.secondAlone;
  for (const color of second) result[color] = secondBoost;
  return result;
}

/** The chemistry boost for each player on the field, in the same order. */
export function chemistryBoostsByPlayer(
  colorsOnField: readonly number[],
  colorCount: number,
  boosts: ChemistryBoosts = DEFAULT_CHEMISTRY_BOOSTS,
): number[] {
  const byColor = chemistryBoostsByColor(colorsOnField, colorCount, boosts);
  return colorsOnField.map((color) => byColor[color] as number);
}
