/**
 * Converting soccer settings to and from what the game_config table stores
 * (D59): plain JSON, one row per key.
 *
 * Keys used:
 * - "tuning": a partial MatchTuning; missing values use the defaults.
 * - "templates.<position>": a 25 × 17 grid (rows from own goal line to the
 *   opponent's), e.g. "templates.st".
 */
import { type InfluenceMap, influenceMapFromRows } from "@lfs/core";
import {
  DEFAULT_MATCH_TUNING,
  defaultSoccerConfig,
  type MatchTuning,
  type SoccerConfig,
} from "./match";
import { POSITIONS, type Position } from "./positions";
import { placeholderTemplates, SOCCER_GRID } from "./templates";

/** A template as stored: rows × cols of non-negative numbers. */
export type TemplateGrid = number[][];

export type StoredTemplates = Record<Position, TemplateGrid>;

/** Positions whose templates mirror each other left to right. */
export const MIRROR_PAIRS: Partial<Record<Position, Position>> = {
  LB: "RB",
  RB: "LB",
  LM: "RM",
  RM: "LM",
  LW: "RW",
  RW: "LW",
};

export const templateKey = (position: Position) =>
  `templates.${position.toLowerCase()}`;

/** Throws unless the grid is 25 × 17, non-negative and not all zero. */
export function assertValidTemplate(
  grid: TemplateGrid,
  label = "template",
): void {
  if (grid.length !== SOCCER_GRID.rows) {
    throw new RangeError(
      `${label} has ${grid.length} rows, expected ${SOCCER_GRID.rows}`,
    );
  }
  let total = 0;
  grid.forEach((row, r) => {
    if (row.length !== SOCCER_GRID.cols) {
      throw new RangeError(
        `${label} row ${r} has ${row.length} cells, expected ${SOCCER_GRID.cols}`,
      );
    }
    for (const v of row) {
      if (!(v >= 0) || !Number.isFinite(v))
        throw new RangeError(`${label} has an invalid value: ${v}`);
      total += v;
    }
  });
  if (total <= 0)
    throw new RangeError(`${label} is empty: paint at least one cell`);
}

/**
 * Scales a grid so its cells sum to 1. Every position then carries the same
 * total influence: painting a bigger area spreads it thinner rather than
 * making the player stronger.
 */
export function normalizeTemplate(grid: TemplateGrid): TemplateGrid {
  assertValidTemplate(grid);
  const total = grid.reduce(
    (sum, row) => sum + row.reduce((a, b) => a + b, 0),
    0,
  );
  return grid.map((row) => row.map((v) => v / total));
}

/** The same grid flipped left to right (e.g. LB → RB). */
export function mirrorTemplate(grid: TemplateGrid): TemplateGrid {
  return grid.map((row) => [...row].reverse());
}

export function mapToGrid(map: InfluenceMap): TemplateGrid {
  const { rows, cols } = map.size;
  return Array.from({ length: rows }, (_, r) =>
    Array.from(map.values.subarray(r * cols, (r + 1) * cols)),
  );
}

/** The built-in placeholder templates as grids, for the editor's starting point. */
export function defaultStoredTemplates(): StoredTemplates {
  const maps = placeholderTemplates();
  const out = {} as StoredTemplates;
  for (const p of POSITIONS) out[p] = mapToGrid(maps[p]);
  return out;
}

/** Rows for game_config: one per template, normalised. */
export function templatesToRows(
  templates: StoredTemplates,
): { key: string; value: TemplateGrid }[] {
  return POSITIONS.map((p) => {
    assertValidTemplate(templates[p], p);
    return { key: templateKey(p), value: normalizeTemplate(templates[p]) };
  });
}

/** Reads templates back from game_config values, keyed by row key. */
export function templatesFromValues(
  values: Record<string, unknown>,
): Partial<StoredTemplates> {
  const out: Partial<StoredTemplates> = {};
  for (const p of POSITIONS) {
    const v = values[templateKey(p)];
    if (v !== undefined) {
      assertValidTemplate(v as TemplateGrid, p);
      out[p] = v as TemplateGrid;
    }
  }
  return out;
}

/**
 * A playable config from a stored version's values. Anything missing falls
 * back to the built-in defaults, so a version can hold only what changed.
 */
export function soccerConfigFromValues(
  version: string,
  values: Record<string, unknown>,
): SoccerConfig {
  const base = defaultSoccerConfig();
  const stored = templatesFromValues(values);
  const templates = { ...base.templates };
  for (const [p, grid] of Object.entries(stored) as [
    Position,
    TemplateGrid,
  ][]) {
    templates[p] = influenceMapFromRows(normalizeTemplate(grid));
  }
  const tuning: MatchTuning = {
    ...DEFAULT_MATCH_TUNING,
    ...((values.tuning as Partial<MatchTuning> | undefined) ?? {}),
  };
  return { ...base, version, templates, tuning };
}
