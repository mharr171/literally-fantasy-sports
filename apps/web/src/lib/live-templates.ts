import "server-only";
import {
  defaultStoredTemplates,
  normalizeTemplate,
  POSITIONS,
  type StoredTemplates,
  type StoredVariants,
  templatesFromValues,
  variantsFromValues,
} from "@lfs/sport-soccer";
import { createServiceClient } from "./supabase/service";
import { SOCCER } from "./team";

/** The influence templates players are shown, from the live settings version. */
export interface LiveTemplates {
  templates: StoredTemplates;
  variants: StoredVariants;
}

const round = (grid: number[][]) =>
  grid.map((row) => row.map((v) => Math.round(v * 1e5) / 1e5));

/**
 * The live version's templates and variants, normalised and rounded so
 * they're small enough to send to the browser for heatmaps.
 */
export async function loadLiveTemplates(): Promise<LiveTemplates> {
  const db = createServiceClient();
  const templates = defaultStoredTemplates();
  let variants: StoredVariants = {};
  const { data } = await db
    .from("game_config_versions")
    .select("version")
    .eq("scope", SOCCER)
    .not("published_at", "is", null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (data) {
    const { data: rows } = await db
      .from("game_config")
      .select("key, value")
      .eq("scope", SOCCER)
      .eq("version", data.version);
    const values = Object.fromEntries(
      (rows ?? []).map((r) => [r.key as string, r.value]),
    );
    const stored = templatesFromValues(values);
    for (const p of POSITIONS) if (stored[p]) templates[p] = stored[p];
    variants = variantsFromValues(values);
  }
  const out: LiveTemplates = { templates: {} as StoredTemplates, variants: {} };
  for (const p of POSITIONS)
    out.templates[p] = round(normalizeTemplate(templates[p]));
  for (const [p, named] of Object.entries(variants)) {
    out.variants[p as keyof StoredVariants] = Object.fromEntries(
      Object.entries(named ?? {}).map(([n, g]) => [
        n,
        round(normalizeTemplate(g)),
      ]),
    );
  }
  return out;
}
