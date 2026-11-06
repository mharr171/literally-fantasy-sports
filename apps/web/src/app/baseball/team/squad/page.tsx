import {
  autoPickSquad,
  type BaseballSquad,
  squadFromPicked,
} from "@lfs/sport-baseball";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import {
  loadBaseballSquad,
  loadBaseballSquadPlayers,
} from "@/lib/baseball-squad";
import { loadRosterLimits } from "@/lib/sport-settings";
import { loadMyTeam } from "@/lib/team";
import { SquadBuilder } from "./squad-builder";

export const metadata: Metadata = { title: "Baseball squad" };

/** The game-day squad (ADR 0009 §8): batting order, rotation, bullpen and bench. */
export default function BaseballSquadPage() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">
          ⚾ Game-day squad
        </h1>
        <Link href="/baseball/team" className="text-sm underline">
          Back to your club
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Builder />
      </Suspense>
    </section>
  );
}

async function Builder() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const team = await loadMyTeam(user.id, "baseball");
  if (!team) redirect("/baseball/team");
  const [players, saved, limits] = await Promise.all([
    loadBaseballSquadPlayers(team.id),
    loadBaseballSquad(team.id),
    loadRosterLimits("baseball"),
  ]);
  if (players.length === 0) redirect("/baseball/team");
  // Before the first save, start from auto-pick (Balanced).
  const squad: BaseballSquad =
    saved ??
    squadFromPicked(
      autoPickSquad(players, { available: (id) => isFit(players, id) }),
    );
  return (
    <SquadBuilder
      players={players}
      initial={squad}
      saved={saved !== null}
      benchMax={limits.benchMax}
    />
  );
}

const isFit = (
  players: readonly { id: string; injuredDays: number }[],
  id: string,
) => (players.find((p) => p.id === id)?.injuredDays ?? 0) === 0;
