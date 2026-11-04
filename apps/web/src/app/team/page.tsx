import { POSITIONS, rosterWarning } from "@lfs/sport-soccer";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { FOCUS_LABELS, scoutPlayer } from "@/lib/scouting";
import {
  loadMyTeam,
  loadOpenBoughtPack,
  loadRoster,
  loadStarterPacks,
  type MyTeam,
  openedContents,
  type RosterPlayer,
} from "@/lib/team";
import { CreateTeamForm } from "./create-team-form";
import { OpenPack } from "./open-pack";
import { RosterTable } from "./roster-table";
import { Scouting } from "./scouting";
import { Shop } from "./shop";

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

  const [roster, openPack] = await Promise.all([
    loadRoster(team.id),
    loadOpenBoughtPack(team.id),
  ]);
  const tierName = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);
  return (
    <>
      <TeamHeading team={team} />
      {openPack && (
        <OpenPack
          key={openPack.id}
          packId={openPack.id}
          title={`${tierName(openPack.tier)} pack · ${FOCUS_LABELS[openPack.focus]}`}
          players={openedContents(openPack).map(scoutPlayer)}
          rosterSize={roster.length}
        />
      )}
      <Roster players={roster} />
      <Shop funds={team.funds} hasOpenPack={openPack !== null} />
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
  const warning = rosterWarning(players.length);
  return (
    <div className="flex flex-col gap-3">
      <div>
        <h2 className="text-xl font-semibold">Roster</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {players.length} players (22–30 to play). Starter-pack players can be
          released but not sold.
        </p>
      </div>
      {warning && (
        <p className="text-sm text-amber-700 dark:text-amber-400">{warning}</p>
      )}
      <RosterTable players={sorted} />
    </div>
  );
}
