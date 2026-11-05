import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { loadFormations } from "@/lib/formations";
import { createServiceClient } from "@/lib/supabase/service";
import { FormationEditor, FormationList } from "./formation-editor";

export const metadata: Metadata = { title: "Formations" };

export default function FormationsPage() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <Formations />
    </Suspense>
  );
}

/** How many clubs' saved squads use each formation. */
async function squadsByFormation(): Promise<Record<string, number>> {
  const { data, error } = await createServiceClient()
    .from("matchday_squads")
    .select("formation");
  if (error) throw new Error(error.message);
  const out: Record<string, number> = {};
  for (const r of data ?? [])
    out[r.formation as string] = (out[r.formation as string] ?? 0) + 1;
  return out;
}

async function Formations() {
  await requireAdmin();
  const [formations, used] = await Promise.all([
    loadFormations(),
    squadsByFormation(),
  ]);
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Formations</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Turn any formation on or off for every club, real and AI, or create a
          new one. Managers and the AI only pick formations that are on. A
          formation can&apos;t be changed or deleted once it exists, so every
          match played with it still replays the same; to change one, create a
          new one and turn the old one off.
        </p>
      </div>
      <FormationList
        formations={formations.map((f) => ({
          id: f.id,
          builtIn: f.builtIn,
          enabled: f.enabled,
          slots: f.formation.slots,
          used: used[f.id] ?? 0,
        }))}
      />
      <FormationEditor
        presets={formations.map((f) => ({
          id: f.id,
          slots: f.formation.slots,
        }))}
      />
    </section>
  );
}
