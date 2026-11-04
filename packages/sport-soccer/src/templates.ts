/**
 * Position influence templates (D7, D41). Each template says how much of the
 * pitch a player in that position influences. The real templates will be
 * painted in the admin template editor; until then these placeholders are
 * smooth "blobs" centred where each position usually plays.
 *
 * Orientation: every team's map is in its own attacking direction.
 * Row 0 is the team's own goal line, row 24 the opponent's; column 0 is the
 * team's left touchline, column 16 its right. (25 long × 17 wide = D7's 17×25.)
 */
import {
  createInfluenceMap,
  type GridSize,
  type InfluenceMap,
} from "@lfs/core";
import type { Position } from "./positions";

export const SOCCER_GRID: GridSize = { rows: 25, cols: 17 };

/** Where each position's influence is centred, and how far it spreads. */
const PLACEHOLDER_SHAPES: Record<
  Position,
  { row: number; col: number; spread: number }
> = {
  GK: { row: 1, col: 8, spread: 1.5 },
  CB: { row: 5, col: 8, spread: 3 },
  LB: { row: 7, col: 2, spread: 3.5 },
  RB: { row: 7, col: 14, spread: 3.5 },
  DM: { row: 9, col: 8, spread: 3.5 },
  CM: { row: 12, col: 8, spread: 4 },
  AM: { row: 16, col: 8, spread: 3.5 },
  LM: { row: 13, col: 2, spread: 4 },
  RM: { row: 13, col: 14, spread: 4 },
  LW: { row: 19, col: 2, spread: 3.5 },
  RW: { row: 19, col: 14, spread: 3.5 },
  ST: { row: 21, col: 8, spread: 3 },
};

export type PositionTemplates = Record<Position, InfluenceMap>;

/** A Gaussian blob, scaled so the whole template sums to 1. */
function blob(row: number, col: number, spread: number): InfluenceMap {
  const map = createInfluenceMap(SOCCER_GRID);
  let total = 0;
  for (let r = 0; r < SOCCER_GRID.rows; r++) {
    for (let c = 0; c < SOCCER_GRID.cols; c++) {
      const d2 = (r - row) ** 2 + (c - col) ** 2;
      const v = Math.exp(-d2 / (2 * spread * spread));
      map.values[r * SOCCER_GRID.cols + c] = v;
      total += v;
    }
  }
  for (let i = 0; i < map.values.length; i++) {
    map.values[i] = (map.values[i] as number) / total;
  }
  return map;
}

export function placeholderTemplates(): PositionTemplates {
  const out = {} as PositionTemplates;
  for (const [position, s] of Object.entries(PLACEHOLDER_SHAPES)) {
    out[position as Position] = blob(s.row, s.col, s.spread);
  }
  return out;
}

/** Rotates a map 180°, turning one team's frame into the other's. */
export function flipMap(map: InfluenceMap): InfluenceMap {
  const out = createInfluenceMap(map.size);
  const n = map.values.length;
  for (let i = 0; i < n; i++) out.values[n - 1 - i] = map.values[i] as number;
  return out;
}
