import {
  defaultStoredTemplates,
  normalizeTemplate,
  POSITIONS,
  type StoredTemplates,
} from "@lfs/sport-soccer";
import type { ReactNode } from "react";
import { loadLiveTemplates } from "@/lib/live-templates";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { TemplatesProvider } from "./templates-context";

/** Gives player cards and heatmaps the live influence templates. */
export async function WithTemplates({ children }: { children: ReactNode }) {
  let value: Awaited<ReturnType<typeof loadLiveTemplates>>;
  if (getSupabaseEnv() && process.env.SUPABASE_SECRET_KEY) {
    value = await loadLiveTemplates();
  } else {
    const d = defaultStoredTemplates();
    const templates = {} as StoredTemplates;
    for (const p of POSITIONS) templates[p] = normalizeTemplate(d[p]);
    value = { templates, variants: {} };
  }
  return <TemplatesProvider value={value}>{children}</TemplatesProvider>;
}
