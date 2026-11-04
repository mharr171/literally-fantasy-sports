import { autoPickSquad } from "@lfs/sport-soccer";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { WithTemplates } from "@/components/player/with-templates";
import { getCurrentUser } from "@/lib/auth";
import { pickOptions } from "@/lib/pick-options";
import {
  loadMyTeam,
  loadRoster,
  loadSquad,
  loadStarterPacks,
} from "@/lib/team";
import { SquadBuilder } from "./squad-builder";

export const metadata: Metadata = { title: "Matchday squad" };

export default function SquadPage() {
  return (
    <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <WithTemplates>
          <SquadContent />
        </WithTemplates>
      </Suspense>
    </section>
  );
}

async function SquadContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const team = await loadMyTeam(user.id);
  if (!team) redirect("/team");
  const [packs, roster, saved] = await Promise.all([
    loadStarterPacks(team.id),
    loadRoster(team.id),
    loadSquad(team.id),
  ]);
  if (packs.some((p) => !p.resolved)) redirect("/team");

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Matchday squad
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {team.name}: drag players (or tap one, then another) to swap them.
            11 start, 11 wait on the bench.
          </p>
        </div>
        <Link href="/team" className="text-sm font-medium hover:underline">
          ← Back to team
        </Link>
      </div>
      <SquadBuilder
        roster={roster}
        initial={saved ?? autoPickSquad(roster, undefined, pickOptions(roster))}
        saved={saved !== null}
      />
    </>
  );
}
