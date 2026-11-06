/**
 * A sport's balance settings as admins edit them (ADR 0007 §7): groups of
 * number fields, each a dotted path into the sport's settings object (e.g.
 * "tuning.goalRate" or "packs.tiers.basic") with its limits. The admin
 * editor draws any sport's groups the same way.
 */

/** What an admin may set a number to, with a label and a short help line. */
export interface Limit {
  label: string;
  help?: string;
  min: number;
  max: number;
  /** Whole numbers only. */
  integer?: boolean;
}

export interface SettingField {
  /** Where the number lives, e.g. "condition.recoveryPerDay". */
  path: string;
  limit: Limit;
}

export interface SettingGroup {
  /** A stable id, for a sport's extra pieces shown with the group. */
  id: string;
  title: string;
  fields: readonly SettingField[];
  /** Columns on wide screens; 3 by default. */
  columns?: 3 | 4;
  /** A line shown under the fields. */
  note?: string;
}

/** The number at a dotted path, or undefined. */
export function getPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const key of path.split(".")) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/**
 * A copy of `obj` with each path set to its value. Objects along the way
 * are copied, never changed in place; missing ones are created.
 */
export function withPaths<T>(
  obj: T,
  values: Readonly<Record<string, unknown>>,
): T {
  const root = structuredClone(obj) as Record<string, unknown>;
  for (const [path, value] of Object.entries(values)) {
    const keys = path.split(".");
    let cur = root;
    keys.slice(0, -1).forEach((k) => {
      const next = cur[k];
      if (!next || typeof next !== "object") cur[k] = {};
      cur = cur[k] as Record<string, unknown>;
    });
    cur[keys[keys.length - 1] as string] = value;
  }
  return root as T;
}
