/** Sorting for clickable table headers (roster, scouting; M7). */

export type SortDir = "asc" | "desc";

export interface SortState<K extends string> {
  key: K;
  dir: SortDir;
}

type Value = number | string | null;

/**
 * Rows sorted by the chosen column. Missing values (null) always go last,
 * and ties keep the order the rows came in, so a secondary sort applied
 * first (e.g. by position) shows through.
 */
export function sortRows<T, K extends string>(
  rows: readonly T[],
  state: SortState<K>,
  columns: Record<K, (row: T) => Value>,
): T[] {
  const get = columns[state.key];
  const sign = state.dir === "asc" ? 1 : -1;
  return rows
    .map((row, i) => ({ row, i, v: get(row) }))
    .sort((a, b) => {
      if (a.v === null || b.v === null)
        return a.v === b.v ? a.i - b.i : a.v === null ? 1 : -1;
      const c =
        typeof a.v === "number" && typeof b.v === "number"
          ? a.v - b.v
          : String(a.v).localeCompare(String(b.v));
      return c * sign || a.i - b.i;
    })
    .map((x) => x.row);
}

/**
 * The sort after clicking a column: the same column flips direction, a new
 * one starts in its natural direction (high numbers first, names A–Z).
 */
export function nextSort<K extends string>(
  state: SortState<K>,
  key: K,
  firstDir: SortDir,
): SortState<K> {
  if (state.key === key)
    return { key, dir: state.dir === "asc" ? "desc" : "asc" };
  return { key, dir: firstDir };
}
