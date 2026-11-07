import { BASEBALL_STAGE_NAMES, type BaseballStage } from "@lfs/sport-baseball";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { loadBaseballMatch } from "@/lib/baseball-match";
import { loadMyTeam } from "@/lib/team";
import { MatchViewer } from "./match-viewer";

export const metadata: Metadata = { title: "Baseball game" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One of the club's games, replayed (ADR 0009 §9). */
export default function BaseballMatchPage({
  params,
}: PageProps<"/baseball/season/match/[id]">) {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
      <Link href="/baseball/season" className="text-sm hover:underline">
        ← Season
      </Link>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Match params={params} />
      </Suspense>
    </section>
  );
}

async function Match({
  params,
}: Pick<PageProps<"/baseball/season/match/[id]">, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const team = await loadMyTeam(user.id, "baseball");
  if (!team) redirect("/baseball/team");
  const match = await loadBaseballMatch(team.id, id);
  if (!match) notFound();
  const round =
    match.stage === "league"
      ? `Week ${match.week}, game ${match.gameNo}`
      : `${BASEBALL_STAGE_NAMES[match.stage as BaseballStage]}, game ${match.gameNo}`;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm text-zinc-500">{round}</p>
        <h1 className="text-2xl font-semibold tracking-tight">
          {match.awayName} {match.box.runs.away} at {match.homeName}{" "}
          {match.box.runs.home}
        </h1>
      </div>
      <MatchViewer match={match} />
    </div>
  );
}
