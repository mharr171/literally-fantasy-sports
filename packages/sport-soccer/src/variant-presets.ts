/**
 * Generated starting variants (D112): three named templates for each of the
 * 12 positions, for an admin to add in the template editor and then adjust.
 * Each is built from one or two soft blobs, so it reads as a clear role
 * (a poacher lives in the box, a false nine drops into midfield).
 *
 * Grids use the template orientation: row 0 is the team's own goal line,
 * column 0 its left touchline.
 */
import type { Position } from "./positions";
import type { StoredVariants, TemplateGrid } from "./stored-config";
import { SOCCER_GRID } from "./templates";

/** A soft blob: centre (row, col), spread along and across the pitch, and weight. */
interface Blob {
  row: number;
  col: number;
  along: number;
  across: number;
  weight?: number;
}

/** Three variants per position, by name. Right-sided ones mirror the left. */
const LEFT_AND_CENTRE: Record<
  Exclude<Position, "RB" | "RM" | "RW">,
  Record<string, Blob[]>
> = {
  GK: {
    "shot-stopper": [{ row: 0.8, col: 8, along: 1, across: 1.6 }],
    "sweeper-keeper": [
      { row: 1.5, col: 8, along: 1.2, across: 2 },
      { row: 5, col: 8, along: 2, across: 3, weight: 0.45 },
    ],
    commander: [{ row: 1.5, col: 8, along: 1.5, across: 3.2 }],
  },
  CB: {
    stopper: [
      { row: 5, col: 8, along: 2, across: 2.5 },
      { row: 9, col: 8, along: 2, across: 2.5, weight: 0.35 },
    ],
    "cover-defender": [{ row: 3.5, col: 8, along: 2, across: 4 }],
    "ball-playing": [
      { row: 5.5, col: 8, along: 2.5, across: 3 },
      { row: 11, col: 8, along: 3, across: 3, weight: 0.4 },
    ],
  },
  LB: {
    "full-back": [{ row: 6, col: 2, along: 3, across: 2 }],
    "wing-back": [{ row: 11, col: 1.5, along: 5.5, across: 1.8 }],
    inverted: [
      { row: 6, col: 3, along: 2.5, across: 2 },
      { row: 11, col: 6.5, along: 3, across: 2.5, weight: 0.5 },
    ],
  },
  DM: {
    anchor: [{ row: 8, col: 8, along: 2, across: 2.5 }],
    destroyer: [{ row: 8.5, col: 8, along: 3, across: 5 }],
    "deep-playmaker": [
      { row: 9.5, col: 8, along: 2.5, across: 3 },
      { row: 14, col: 8, along: 3, across: 3.5, weight: 0.35 },
    ],
  },
  CM: {
    "box-to-box": [{ row: 12, col: 8, along: 5.5, across: 3.5 }],
    playmaker: [{ row: 13, col: 8, along: 3, across: 3 }],
    "ball-winner": [{ row: 10, col: 8, along: 3, across: 4.5 }],
  },
  AM: {
    "number-ten": [{ row: 16, col: 8, along: 2.5, across: 2.8 }],
    "shadow-striker": [{ row: 18, col: 8, along: 2.5, across: 2.5 }],
    roaming: [{ row: 16, col: 8, along: 3.5, across: 5 }],
  },
  LM: {
    "wide-midfielder": [{ row: 13, col: 1.5, along: 4, across: 1.8 }],
    "defensive-wide": [{ row: 10, col: 2.5, along: 4, across: 2.2 }],
    "inside-midfielder": [{ row: 14, col: 5, along: 3.5, across: 2.8 }],
  },
  LW: {
    "touchline-winger": [{ row: 19, col: 1.2, along: 3.5, across: 1.6 }],
    "inside-forward": [
      { row: 18, col: 2.5, along: 2.5, across: 2 },
      { row: 21, col: 6, along: 2, across: 2, weight: 0.7 },
    ],
    "wide-forward": [{ row: 17, col: 2, along: 5, across: 2.5 }],
  },
  ST: {
    poacher: [{ row: 22, col: 8, along: 1.8, across: 2 }],
    "target-man": [{ row: 20.5, col: 8, along: 2.2, across: 2.8 }],
    "false-nine": [
      { row: 17, col: 8, along: 3, across: 3 },
      { row: 21, col: 8, along: 2, across: 2, weight: 0.4 },
    ],
  },
};

const MIRRORED: Partial<Record<Position, keyof typeof LEFT_AND_CENTRE>> = {
  RB: "LB",
  RM: "LM",
  RW: "LW",
};

function paint(blobs: Blob[], mirror: boolean): TemplateGrid {
  const { rows, cols } = SOCCER_GRID;
  const grid = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => {
      const col = mirror ? cols - 1 - c : c;
      let v = 0;
      for (const b of blobs) {
        const d =
          ((r - b.row) / b.along) ** 2 + ((col - b.col) / b.across) ** 2;
        v += (b.weight ?? 1) * Math.exp(-d / 2);
      }
      return v;
    }),
  );
  const total = grid.flat().reduce((a, b) => a + b, 0);
  // Rounded to keep stored rows small; tiny tails become 0.
  return grid.map((row) =>
    row.map((v) => {
      const share = v / total;
      return share < 1e-5 ? 0 : Math.round(share * 1e6) / 1e6;
    }),
  );
}

/** The generated variants for every position (D112), three each. */
export function generatedVariants(): Required<StoredVariants> {
  const out = {} as Required<StoredVariants>;
  for (const [position, named] of Object.entries(LEFT_AND_CENTRE)) {
    out[position as Position] = Object.fromEntries(
      Object.entries(named).map(([name, blobs]) => [name, paint(blobs, false)]),
    );
  }
  for (const [position, from] of Object.entries(MIRRORED) as [
    Position,
    keyof typeof LEFT_AND_CENTRE,
  ][]) {
    out[position] = Object.fromEntries(
      Object.entries(LEFT_AND_CENTRE[from]).map(([name, blobs]) => [
        name,
        paint(blobs, true),
      ]),
    );
  }
  return out;
}
