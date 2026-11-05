/**
 * Converting soccer settings to and from what the game_config table stores
 * (D59): plain JSON, one row per key.
 *
 * Keys used:
 * - "tuning", "payouts", "packs": balance settings (see balance.ts); missing
 *   values use the defaults.
 * - "templates.<position>": a 25 × 17 grid (rows from own goal line to the
 *   opponent's), e.g. "templates.st".
 * - "variants.<position>": named extra templates for a position (D82), as
 *   { name: grid }, e.g. "variants.st": { "poacher": [...] }.
 * - "variants.enabled": the templates new players can be given (D84), as
 *   { position: names }, where "default" is the position's main template.
 */
import { type InfluenceMap, influenceMapFromRows } from "@lfs/core";
import { balanceFromValues } from "./balance";
import {
  DEFAULT_GENERATION_SETTINGS,
  DEFAULT_TEMPLATE_VARIANT,
  type GenerationSettings,
} from "./generation";
import { defaultSoccerConfig, type SoccerConfig } from "./match";
import { POSITIONS, type Position } from "./positions";
import {
  placeholderTemplates,
  type SlotSide,
  SOCCER_GRID,
  sideMap,
} from "./templates";

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

export const variantsKey = (position: Position) =>
  `variants.${position.toLowerCase()}`;
export const ENABLED_VARIANTS_KEY = "variants.enabled";

/** Named variants per position (the default template is stored separately). */
export type StoredVariants = Partial<
  Record<Position, Record<string, TemplateGrid>>
>;
/** Templates new players can be given, per position; "default" is the main one. */
export type EnabledVariants = Partial<Record<Position, string[]>>;

/** Variant names: short, lowercase letters, digits and dashes, never "default". */
export function variantNameError(name: string): string | null {
  if (!/^[a-z0-9][a-z0-9-]{0,23}$/.test(name))
    return "Use 1–24 lowercase letters, digits or dashes.";
  if (name === DEFAULT_TEMPLATE_VARIANT)
    return "That name is taken by the default template.";
  return null;
}

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

/** A grid's left or right version (D112), as the match draws it. */
export function sideGrid(
  grid: TemplateGrid,
  side: SlotSide | undefined,
): TemplateGrid {
  if (!side) return grid;
  return mapToGrid(sideMap(influenceMapFromRows(grid), side));
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

/** Rows for game_config: one per position that has variants, plus the enabled lists. */
export function variantsToRows(
  variants: StoredVariants,
  enabled: EnabledVariants,
): { key: string; value: unknown }[] {
  const rows: { key: string; value: unknown }[] = [];
  for (const p of POSITIONS) {
    const named = variants[p] ?? {};
    const normalised: Record<string, TemplateGrid> = {};
    for (const [name, grid] of Object.entries(named)) {
      const problem = variantNameError(name);
      if (problem) throw new RangeError(`${p} variant "${name}": ${problem}`);
      assertValidTemplate(grid, `${p} ${name}`);
      normalised[name] = normalizeTemplate(grid);
    }
    rows.push({ key: variantsKey(p), value: normalised });
  }
  const lists: EnabledVariants = {};
  for (const p of POSITIONS) {
    const names = (enabled[p] ?? []).filter(
      (n) => n === DEFAULT_TEMPLATE_VARIANT || variants[p]?.[n] !== undefined,
    );
    if (names.length > 0) lists[p] = [...new Set(names)];
  }
  rows.push({ key: ENABLED_VARIANTS_KEY, value: lists });
  return rows;
}

export function variantsFromValues(
  values: Record<string, unknown>,
): StoredVariants {
  const out: StoredVariants = {};
  for (const p of POSITIONS) {
    const v = values[variantsKey(p)] as
      | Record<string, TemplateGrid>
      | undefined;
    if (!v || Object.keys(v).length === 0) continue;
    for (const [name, grid] of Object.entries(v))
      assertValidTemplate(grid, `${p} ${name}`);
    out[p] = v;
  }
  return out;
}

export function enabledVariantsFromValues(
  values: Record<string, unknown>,
): EnabledVariants {
  return (values[ENABLED_VARIANTS_KEY] as EnabledVariants | undefined) ?? {};
}

/**
 * Generation settings for a stored version: new players get one of the
 * position's enabled templates at random (D84). Positions with nothing
 * enabled use the default template.
 */
export function generationSettingsFromValues(
  values: Record<string, unknown>,
  base: GenerationSettings = DEFAULT_GENERATION_SETTINGS,
): GenerationSettings {
  const enabled = enabledVariantsFromValues(values);
  if (Object.keys(enabled).length === 0) return base;
  return { ...base, templateVariants: enabled };
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
  const variants: SoccerConfig["variants"] = {};
  for (const [p, named] of Object.entries(variantsFromValues(values)) as [
    Position,
    Record<string, TemplateGrid>,
  ][]) {
    variants[p] = Object.fromEntries(
      Object.entries(named).map(([name, grid]) => [
        name,
        influenceMapFromRows(normalizeTemplate(grid)),
      ]),
    );
  }
  const { tuning } = balanceFromValues(values);
  return { ...base, version, templates, variants, tuning };
}

/**
 * Positions whose ticked templates differ between a version being edited and
 * the live one (D132). New players only get what the live version has
 * ticked; a position with nothing ticked gives the default.
 */
export function unpublishedVariantPositions(
  editing: EnabledVariants,
  live: EnabledVariants,
): Position[] {
  const list = (e: EnabledVariants, p: Position) => {
    const names = e[p] ?? [];
    return [...new Set(names.length > 0 ? names : [DEFAULT_TEMPLATE_VARIANT])]
      .sort()
      .join(",");
  };
  return POSITIONS.filter((p) => list(editing, p) !== list(live, p));
}
