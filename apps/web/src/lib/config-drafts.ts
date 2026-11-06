import "server-only";
import {
  listSoccerVersions,
  loadVersionValues,
  SOCCER,
} from "./soccer-templates";
import { createClient } from "./supabase/server";

/**
 * Saves settings rows to a draft version and returns its number. Editing a
 * draft updates it in place; editing a published version or the defaults
 * starts a new draft that copies every other setting from where it began.
 * Runs as the signed-in admin: the database only lets admins write.
 */
export async function saveDraftRows(
  baseVersion: number | null,
  note: string,
  defaultNote: string,
  rows: readonly { key: string; value: unknown }[],
  /** Whose settings: soccer's unless said (ADR 0007 §7). */
  scope: string = SOCCER,
): Promise<number> {
  const supabase = await createClient();
  const versions = await listSoccerVersions(scope);
  const base = versions.find((v) => v.version === baseVersion);

  let version: number;
  if (base && !base.publishedAt) {
    version = base.version;
    const { error } = await supabase
      .from("game_config_versions")
      .update({ note })
      .eq("scope", scope)
      .eq("version", version);
    if (error) throw new Error(error.message);
  } else {
    version = (versions[0]?.version ?? 0) + 1;
    const { error } = await supabase
      .from("game_config_versions")
      .insert({ scope, version, note: note || defaultNote });
    if (error) throw new Error(error.message);
    if (base) {
      const replaced = new Set(rows.map((r) => r.key));
      const carried = Object.entries(
        await loadVersionValues(base.version, scope),
      )
        .filter(([key]) => !replaced.has(key))
        .map(([key, value]) => ({ scope, version, key, value }));
      if (carried.length > 0) {
        const { error: copyError } = await supabase
          .from("game_config")
          .insert(carried);
        if (copyError) throw new Error(copyError.message);
      }
    }
  }

  const { error } = await supabase
    .from("game_config")
    .upsert(rows.map((r) => ({ scope, version, key: r.key, value: r.value })));
  if (error) throw new Error(error.message);
  return version;
}

/** Makes a draft live. Published versions can never change again. */
export async function publishDraft(
  version: number,
  scope: string = SOCCER,
): Promise<void> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("game_config_versions")
    .update({ published_at: new Date().toISOString() })
    .eq("scope", scope)
    .eq("version", version)
    .is("published_at", null)
    .select("version");
  if (error) throw new Error(error.message);
  if (!data?.length) throw new Error(`Version ${version} isn't a draft.`);
}
