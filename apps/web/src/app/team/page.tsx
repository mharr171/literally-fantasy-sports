import { POSITIONS } from "@lfs/sport-soccer";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { scoutPlayer } from "@/lib/scouting";
import {
  loadMyTeam,
  loadRoster,
  loadStarterPacks,
  type MyTeam,
  openedContents,
  type RosterPlayer,
} from "@/lib/team";
import { CreateTeamForm } from "./create-team-form";
import { PlayerTable } from "./player-table";
import { Scouting } from "./scouting";

export const metadata: Metadata = { title: "My team" };

export default function TeamPage() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <TeamContent />
      </Suspense>
    </section>
  );
}

async function TeamContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const team = await loadMyTeam(user.id);
  if (!team) return <CreateTeamForm />;

  const packs = await loadStarterPacks(team.id);
  if (packs.some((p) => !p.resolved)) {
    return (
      <>
        <TeamHeading team={team} />
        <Scouting
          packs={packs.map((p) => ({
            id: p.id,
            focus: p.focus,
            players: p.opened ? openedContents(p).map(scoutPlayer) : null,
          }))}
        />
      </>
    );
  }

  return (
    <>
      <TeamHeading team={team} />
      <Roster players={await loadRoster(team.id)} />
    </>
  );
}

function TeamHeading({ team }: { team: MyTeam }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <h1 className="text-3xl font-semibold tracking-tight">{team.name}</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Elo {team.elo} · Funds {team.funds.toLocaleString("en-US")}
      </p>
    </div>
  );
}

function Roster({ players }: { players: RosterPlayer[] }) {
  const order = (p: RosterPlayer) => POSITIONS.indexOf(p.primaryPosition);
  const sorted = [...players].sort(
    (a, b) => order(a) - order(b) || b.overall - a.overall,
  );
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-xl font-semibold">Roster</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {players.length} players. Picking your matchday 22 comes next.
        </p>
      </div>
      <PlayerTable players={sorted} />
    </div>
  );
}
