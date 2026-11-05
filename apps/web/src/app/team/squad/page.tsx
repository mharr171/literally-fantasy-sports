import { autoPickSquad } from "@lfs/sport-soccer";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FormationMoved } from "@/components/formation-moved";
import { GettingStarted } from "@/components/getting-started";
import { WithTemplates } from "@/components/player/with-templates";
import { getCurrentUser } from "@/lib/auth";
import { loadFormations } from "@/lib/formations";
import { pickOptions } from "@/lib/pick-options";
import { currentOutOfPosition } from "@/lib/season";
import {
  loadMovedFrom,
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
      <Suspense fallback={null}>
        <GettingStarted />
      </Suspense>
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
  const [packs, roster, saved, outOfPosition, all, movedFrom] =
    await Promise.all([
      loadStarterPacks(team.id),
      loadRoster(team.id),
      loadSquad(team.id),
      currentOutOfPosition(team.id),
      loadFormations(),
      loadMovedFrom(team.id),
    ]);
  // The ones that are on, and the saved one even if it's off (D140).
  const formations = all
    .filter((f) => f.enabled || f.id === saved?.formation)
    .map((f) => ({ ...f.formation, enabled: f.enabled }));
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
      {saved && movedFrom && (
        <FormationMoved from={movedFrom} to={saved.formation} link={false} />
      )}
      <SquadBuilder
        roster={roster}
        formations={formations}
        initial={
          saved ??
          autoPickSquad(
            roster,
            formations.find((f) => f.enabled)?.id,
            pickOptions(roster),
          )
        }
        saved={saved !== null}
        outOfPosition={outOfPosition}
        morale={team.morale}
      />
    </>
  );
}
