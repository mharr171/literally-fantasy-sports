import "server-only";
import { createClient } from "./supabase/server";

export interface ConfigVersionRow {
  scope: string;
  version: number;
  note: string;
  createdAt: string;
  publishedAt: string | null;
}

export interface ConfigVersionSummary extends ConfigVersionRow {
  status: "draft" | "live" | "past";
}

/**
 * Marks each version as draft, live (the newest published one in its scope,
 * which new matches use) or past.
 */
export function summarizeVersions(
  rows: ConfigVersionRow[],
): ConfigVersionSummary[] {
  const live = new Map<string, number>();
  for (const r of rows) {
    if (r.publishedAt && r.version > (live.get(r.scope) ?? 0))
      live.set(r.scope, r.version);
  }
  return [...rows]
    .sort((a, b) => a.scope.localeCompare(b.scope) || b.version - a.version)
    .map((r) => ({
      ...r,
      status: !r.publishedAt
        ? "draft"
        : live.get(r.scope) === r.version
          ? "live"
          : "past",
    }));
}

/** All versions the signed-in user may see (admins also see drafts, via RLS). */
export async function listConfigVersions(): Promise<ConfigVersionSummary[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("game_config_versions")
    .select("scope, version, note, created_at, published_at");
  if (error) throw new Error(`Couldn't load game settings: ${error.message}`);
  return summarizeVersions(
    (data ?? []).map((r) => ({
      scope: r.scope as string,
      version: r.version as number,
      note: r.note as string,
      createdAt: r.created_at as string,
      publishedAt: (r.published_at as string | null) ?? null,
    })),
  );
}
