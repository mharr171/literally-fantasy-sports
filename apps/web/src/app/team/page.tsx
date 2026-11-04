import { POSITIONS, rosterWarning, squadProblems } from "@lfs/sport-soccer";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { GettingStarted } from "@/components/getting-started";
import { WithTemplates } from "@/components/player/with-templates";
import { getCurrentUser } from "@/lib/auth";
import { FOCUS_LABELS, scoutPlayer } from "@/lib/scouting";
import { liveGenerationSettings, liveSoccerConfig } from "@/lib/season";
import {
  loadMyTeam,
  loadOpenBoughtPack,
  loadRoster,
  loadSquad,
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
      <Suspense fallback={null}>
        <GettingStarted />
      </Suspense>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <WithTemplates>
          <TeamContent />
        </WithTemplates>
      </Suspense>
    </section>
  );
}

async function TeamContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const team = await loadMyTeam(user.id);
  if (!team) return <CreateTeamForm />;

  const [packs, generation] = await Promise.all([
    loadStarterPacks(team.id),
    liveGenerationSettings(),
  ]);
  if (packs.some((p) => !p.resolved)) {
    return (
      <>
        <TeamHeading team={team} />
        <Scouting
          packs={packs.map((p) => ({
            id: p.id,
            focus: p.focus,
            players: p.opened
              ? openedContents(p, generation).map(scoutPlayer)
              : null,
          }))}
        />
      </>
    );
  }

  const [roster, openPack, squad, live] = await Promise.all([
    loadRoster(team.id),
    loadOpenBoughtPack(team.id),
    loadSquad(team.id),
    liveSoccerConfig(),
  ]);
  const squadReady =
    squad !== null &&
    squadProblems(squad, new Set(roster.map((p) => p.id))).length === 0;
  const tierName = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);
  return (
    <>
      <TeamHeading team={team} />
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
        <span className="font-medium">Matchday squad:</span>
        <span
          className={
            squadReady
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-amber-700 dark:text-amber-400"
          }
        >
          {squadReady ? "ready" : squad ? "needs changes" : "not picked yet"}
        </span>
        <span className="flex-1" />
        {squadReady && (
          <Link href="/season" className="font-medium hover:underline">
            Go to season →
          </Link>
        )}
        <Link
          href="/team/squad"
          className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {squad ? "Edit squad" : "Pick your matchday 22"}
        </Link>
      </div>
      {openPack && (
        <OpenPack
          key={openPack.id}
          packId={openPack.id}
          title={`${tierName(openPack.tier)} pack · ${FOCUS_LABELS[openPack.focus]}`}
          players={openedContents(openPack, generation).map(scoutPlayer)}
          rosterSize={roster.length}
        />
      )}
      <Roster players={roster} />
      <Shop
        funds={team.funds}
        hasOpenPack={openPack !== null}
        prices={live.balance.packs}
      />
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
