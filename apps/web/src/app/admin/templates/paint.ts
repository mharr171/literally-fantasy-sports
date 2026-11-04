/**
 * Brush maths for the template editor. Pure functions on plain grids, so
 * they're easy to test and cheap to run on every pointer move.
 */
import type { Position as SoccerPosition } from "@lfs/sport-soccer";

export type Position = SoccerPosition;
export type Grid = number[][];
export type Templates = Record<Position, Grid>;
export type Tool = "paint" | "erase" | "smooth";

/** Tab order: back to front, left to right. */
export const POSITION_ORDER: Position[] = [
  "GK",
  "LB",
  "CB",
  "RB",
  "DM",
  "LM",
  "CM",
  "RM",
  "AM",
  "LW",
  "ST",
  "RW",
];

export const POSITION_LABELS: Record<Position, string> = {
  GK: "Goalkeeper",
  CB: "Centre-back",
  LB: "Left-back",
  RB: "Right-back",
  DM: "Defensive midfielder",
  CM: "Central midfielder",
  AM: "Attacking midfielder",
  LM: "Left midfielder",
  RM: "Right midfielder",
  LW: "Left winger",
  RW: "Right winger",
  ST: "Striker",
};

/** Matches MIRROR_PAIRS in @lfs/sport-soccer. */
export const MIRROR: Partial<Record<Position, Position>> = {
  LB: "RB",
  RB: "LB",
  LM: "RM",
  RM: "LM",
  LW: "RW",
  RW: "LW",
};

/**
 * Applies one brush dab centred on (row, col) and returns a new grid.
 * - paint adds up to `strength` at the centre, fading to the brush edge;
 * - erase removes the same amount (never below zero);
 * - smooth blends each cell towards its neighbours' average.
 */
export function applyStroke(
  grid: Grid,
  row: number,
  col: number,
  tool: Tool,
  size: number,
  strength: number,
): Grid {
  const rows = grid.length;
  const cols = grid[0]?.length ?? 0;
  const next = grid.map((r) => r.slice());
  const radius = Math.max(1, size);
  for (let r = row - radius + 1; r <= row + radius - 1; r++) {
    for (let c = col - radius + 1; c <= col + radius - 1; c++) {
      if (r < 0 || r >= rows || c < 0 || c >= cols) continue;
      const distance = Math.hypot(r - row, c - col);
      if (distance > radius - 1 + 0.5) continue;
      const weight = 1 - distance / radius;
      const current = grid[r]?.[c] ?? 0;
      const cells = next[r] as number[];
      if (tool === "paint") {
        cells[c] = current + strength * weight;
      } else if (tool === "erase") {
        cells[c] = Math.max(0, current - strength * weight);
      } else {
        const avg = neighbourAverage(grid, r, c);
        cells[c] = current + (avg - current) * Math.min(1, strength * weight);
      }
    }
  }
  return next;
}

function neighbourAverage(grid: Grid, row: number, col: number): number {
  let sum = 0;
  let n = 0;
  for (let r = row - 1; r <= row + 1; r++) {
    for (let c = col - 1; c <= col + 1; c++) {
      const v = grid[r]?.[c];
      if (v !== undefined) {
        sum += v;
        n++;
      }
    }
  }
  return sum / n;
}
