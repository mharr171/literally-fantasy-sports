/**
 * Baseball's templates (ADR 0008 §4, D211). Players get one preset of each
 * kind at generation, like soccer's variants; the template editor edits
 * them in M18.
 *
 * - The **strike zone** is a 5 × 5 grid: the 3 × 3 zone (rows and columns
 *   1–3) with a ring of balls just outside. Row 0 is high; column 0 is the
 *   inside edge to a right-handed batter. Presets are written for a
 *   right-handed batter and pitcher, and mirrored for left-handers (D224).
 * - A batter's **zone profile** says how well they hit in each cell (1 is
 *   average, above is hot, below cold).
 * - A batter's **spray profile** weighs the 12 directions of fair
 *   territory, from the left-field line (0) round to the right-field
 *   line (11), for a right-handed batter: his pull side is left field. A
 *   left-handed batter's is mirrored, so he pulls to right field.
 * - A pitcher's **location profile** weighs where they aim.
 * - **Fielding ranges** cover the field grid, 12 directions × 8 depths
 *   (depth 0 at the plate, 7 the warning track): how well each fielder
 *   reaches a ball landing in each cell.
 */
import type { FieldPosition, Position } from "./positions";

export const ZONE_SIZE = 5;
export const DIRECTIONS = 12;
export const DEPTHS = 8;

/** A 5 × 5 grid of numbers, row by row. */
export type ZoneGrid = readonly (readonly number[])[];

/** Whether a strike-zone cell is a strike (the middle 3 × 3). */
export const inZone = (row: number, col: number): boolean =>
  row >= 1 && row <= 3 && col >= 1 && col <= 3;

const grid = (f: (row: number, col: number) => number): number[][] =>
  Array.from({ length: ZONE_SIZE }, (_, r) =>
    Array.from({ length: ZONE_SIZE }, (_, c) => f(r, c)),
  );

export const ZONE_PRESETS = {
  even: grid(() => 1),
  "low-ball": grid((r) => [0.8, 0.9, 1, 1.15, 1.2][r] as number),
  "high-ball": grid((r) => [1.2, 1.15, 1, 0.9, 0.8][r] as number),
  /** Hot over the middle and the inside third, cold away. */
  "middle-in": grid((r, c) =>
    !inZone(r, c) ? 0.85 : c === 3 ? 0.95 : r === 2 && c <= 2 ? 1.25 : 1.1,
  ),
} as const;
export type ZonePreset = keyof typeof ZONE_PRESETS;

const spray = (f: (d: number) => number): number[] =>
  Array.from({ length: DIRECTIONS }, (_, d) => f(d));

export const SPRAY_PRESETS = {
  /** All fields, leaning a little to his pull side as most hitters do. */
  spray: spray((d) => 1.15 - d * 0.03),
  /** To his pull side: left field for a right-handed batter. */
  pull: spray((d) => 1.6 - d * 0.1),
  /** The other way. */
  opposite: spray((d) => 0.5 + d * 0.1),
  "up-the-middle": spray((d) => 1.6 - Math.abs(d - 5.5) * 0.15 - d * 0.02),
} as const;
export type SprayPreset = keyof typeof SPRAY_PRESETS;

export const LOCATION_PRESETS = {
  /** Mostly in the zone, around the middle. */
  attacks: grid((r, c) =>
    inZone(r, c) ? (r === 2 && c === 2 ? 2 : 1.5) : 0.4,
  ),
  /** The zone's corners and just off them. */
  "paints-corners": grid((r, c) =>
    inZone(r, c) ? ((r === 2) !== (c === 2) ? 0.9 : r === 2 ? 0.4 : 1.7) : 0.55,
  ),
  /** Down in the zone and just below it. */
  "keeps-it-low": grid(
    (r, c) =>
      (r === 3 ? 1.8 : r === 2 ? 1.2 : r === 4 ? 0.85 : 0.45) *
      (c === 0 || c === 4 ? 0.5 : 1),
  ),
  /** Up in the zone and just above it. */
  "climbs-the-ladder": grid(
    (r, c) =>
      (r === 1 ? 1.8 : r === 2 ? 1.2 : r === 0 ? 0.85 : 0.45) *
      (c === 0 || c === 4 ? 0.5 : 1),
  ),
} as const;
export type LocationPreset = keyof typeof LOCATION_PRESETS;

/** Where each fielder stands on the field grid: direction and depth. */
const HOME: Record<FieldPosition | "P", [number, number, number]> = {
  // direction, depth, reach (spread)
  P: [5.5, 1, 1.1],
  C: [5.5, 0, 0.8],
  "1B": [10.3, 1.6, 1.2],
  "2B": [7.6, 2.2, 1.4],
  SS: [3.7, 2.2, 1.5],
  "3B": [1.4, 1.6, 1.2],
  LF: [2, 5.3, 1.8],
  CF: [5.5, 6, 2.1],
  RF: [9, 5.3, 1.8],
};

/** A fielder's reach over the 12 × 8 field grid, by direction then depth. */
export type FieldRange = readonly (readonly number[])[];

const range = ([dir, depth, reach]: [number, number, number]): number[][] =>
  Array.from({ length: DIRECTIONS }, (_, d) =>
    Array.from({ length: DEPTHS }, (_, k) => {
      const dist2 = ((d - dir) / 1.5) ** 2 + (k - depth) ** 2;
      return Math.round(Math.exp(-dist2 / (2 * reach * reach)) * 100) / 100;
    }),
  );

export const DEFAULT_FIELDING_RANGES: Record<FieldPosition | "P", FieldRange> =
  Object.fromEntries(
    Object.entries(HOME).map(([p, home]) => [p, range(home)]),
  ) as unknown as Record<FieldPosition | "P", FieldRange>;

/** The presets a new player gets (ADR 0008 §4), by position. */
export function profileChoices(position: Position): {
  zone: readonly ZonePreset[];
  spray: readonly SprayPreset[];
  location: readonly LocationPreset[];
} {
  if (position === "P")
    return {
      zone: [],
      spray: [],
      location: Object.keys(LOCATION_PRESETS) as LocationPreset[],
    };
  return {
    zone: Object.keys(ZONE_PRESETS) as ZonePreset[],
    spray: Object.keys(SPRAY_PRESETS) as SprayPreset[],
    location: [],
  };
}

/** A grid mirrored left to right, for a left-handed batter or pitcher. */
export const mirrorGrid = (g: ZoneGrid): number[][] =>
  g.map((row) => [...row].reverse());

/** Spray weights mirrored, for a left-handed batter. */
export const mirrorSpray = (w: readonly number[]): number[] => [...w].reverse();
