/**
 * Influence maps: a grid of non-negative numbers over a sport's playing
 * surface, used by the match sim and drawn as heatmaps (D7). Each sport sets
 * its own size (soccer: 17 × 25).
 */

export interface GridSize {
  rows: number;
  cols: number;
}

/** Row-major values, length rows × cols. */
export interface InfluenceMap {
  size: GridSize;
  values: Float64Array;
}

function assertSize(size: GridSize): void {
  if (
    !Number.isInteger(size.rows) ||
    !Number.isInteger(size.cols) ||
    size.rows < 1 ||
    size.cols < 1
  ) {
    throw new RangeError(`Invalid grid size ${size.rows}×${size.cols}`);
  }
}

export function createInfluenceMap(size: GridSize): InfluenceMap {
  assertSize(size);
  return { size: { ...size }, values: new Float64Array(size.rows * size.cols) };
}

/** Builds a map from nested rows, e.g. a template drawn in the editor. */
export function influenceMapFromRows(
  rows: readonly (readonly number[])[],
): InfluenceMap {
  const size = { rows: rows.length, cols: rows[0]?.length ?? 0 };
  const map = createInfluenceMap(size);
  rows.forEach((row, r) => {
    if (row.length !== size.cols) {
      throw new RangeError(
        `Row ${r} has ${row.length} cells, expected ${size.cols}`,
      );
    }
    row.forEach((v, c) => {
      if (!(v >= 0) || !Number.isFinite(v)) {
        throw new RangeError(`Invalid value ${v} at row ${r}, col ${c}`);
      }
      map.values[r * size.cols + c] = v;
    });
  });
  return map;
}

export function cellValue(map: InfluenceMap, row: number, col: number): number {
  if (row < 0 || row >= map.size.rows || col < 0 || col >= map.size.cols) {
    throw new RangeError(`Cell (${row}, ${col}) is outside the grid`);
  }
  return map.values[row * map.size.cols + col] as number;
}

/** Adds `source × weight` into `target` in place (team map = Σ template × skill). */
export function addScaled(
  target: InfluenceMap,
  source: InfluenceMap,
  weight: number,
): void {
  if (
    target.size.rows !== source.size.rows ||
    target.size.cols !== source.size.cols
  ) {
    throw new RangeError("Grid sizes differ");
  }
  for (let i = 0; i < target.values.length; i++) {
    target.values[i] =
      (target.values[i] as number) + (source.values[i] as number) * weight;
  }
}

/** Sum of the cells in rows [fromRow, toRow) — e.g. a team's influence in the final third. */
export function sumRows(
  map: InfluenceMap,
  fromRow: number,
  toRow: number,
): number {
  if (fromRow < 0 || toRow > map.size.rows || fromRow > toRow) {
    throw new RangeError(`Invalid row range [${fromRow}, ${toRow})`);
  }
  let total = 0;
  for (let i = fromRow * map.size.cols; i < toRow * map.size.cols; i++) {
    total += map.values[i] as number;
  }
  return total;
}
