import "server-only";
import {
  defaultStoredTemplates,
  type EnabledVariants,
  enabledVariantsFromValues,
  POSITIONS,
  type StoredTemplates,
  type StoredVariants,
  templatesFromValues,
  variantsFromValues,
} from "@lfs/sport-soccer";
import { createClient } from "./supabase/server";

export const SOCCER = "soccer";

export interface SoccerVersion {
  version: number;
  note: string;
  publishedAt: string | null;
}

export interface EditorState {
  /** The version being edited or viewed; null means the built-in defaults. */
  version: number | null;
  status: "draft" | "published" | "defaults";
  note: string;
  templates: StoredTemplates;
  /** Named variants per position, and which templates new players can get (D82, D84). */
  variants: StoredVariants;
  enabled: EnabledVariants;
  /** The live version's ticked templates: what new players get now (D132). */
  liveEnabled: EnabledVariants;
  versions: SoccerVersion[];
  /** Newest published version, if any. */
  live: number | null;
}

/** A sport's settings versions, newest first (soccer's by default). */
export async function listSoccerVersions(
  scope: string = SOCCER,
): Promise<SoccerVersion[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("game_config_versions")
    .select("version, note, published_at")
    .eq("scope", scope)
    .order("version", { ascending: false });
  if (error) throw new Error(`Couldn't load versions: ${error.message}`);
  return (data ?? []).map((r) => ({
    version: r.version as number,
    note: r.note as string,
    publishedAt: (r.published_at as string | null) ?? null,
  }));
}

/** Every stored value of a version, keyed by setting name. */
export async function loadVersionValues(
  version: number,
  scope: string = SOCCER,
): Promise<Record<string, unknown>> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("game_config")
    .select("key, value")
    .eq("scope", scope)
    .eq("version", version);
  if (error)
    throw new Error(`Couldn't load version ${version}: ${error.message}`);
  return Object.fromEntries(
    (data ?? []).map((r) => [r.key as string, r.value]),
  );
}

export function liveVersion(versions: SoccerVersion[]): number | null {
  return versions.find((v) => v.publishedAt)?.version ?? null;
}

/**
 * What the editor opens: the requested version, else the newest draft, else
 * the live version, else the built-in defaults.
 */
export async function loadEditorState(
  requested?: number,
): Promise<EditorState> {
  const versions = await listSoccerVersions();
  const live = liveVersion(versions);
  const chosen =
    versions.find((v) => v.version === requested) ??
    versions.find((v) => !v.publishedAt) ??
    versions.find((v) => v.version === live);

  const templates = defaultStoredTemplates();
  if (!chosen) {
    return {
      version: null,
      status: "defaults",
      note: "",
      templates,
      variants: {},
      enabled: {},
      liveEnabled: {},
      versions,
      live,
    };
  }
  const [values, liveValues] = await Promise.all([
    loadVersionValues(chosen.version),
    live === null || live === chosen.version ? null : loadVersionValues(live),
  ]);
  const enabled = enabledVariantsFromValues(values);
  const stored = templatesFromValues(values);
  for (const p of POSITIONS) if (stored[p]) templates[p] = stored[p];
  return {
    version: chosen.version,
    status: chosen.publishedAt ? "published" : "draft",
    note: chosen.note,
    templates,
    variants: variantsFromValues(values),
    enabled,
    liveEnabled:
      live === null
        ? {}
        : liveValues
          ? enabledVariantsFromValues(liveValues)
          : enabled,
    versions,
    live,
  };
}
