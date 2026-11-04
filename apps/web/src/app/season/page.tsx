import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { loadLatestSeason } from "@/lib/season";
import { loadMyTeam, loadStarterPacks } from "@/lib/team";
import { StartSeasonButton } from "./season-buttons";
import { SeasonView } from "./season-view";

export const metadata: Metadata = { title: "Season" };

export default function SeasonPage() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <SeasonContent />
      </Suspense>
    </section>
  );
}

async function SeasonContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const team = await loadMyTeam(user.id);
  if (!team) redirect("/team");
  const packs = await loadStarterPacks(team.id);
  if (packs.some((p) => !p.resolved)) redirect("/team");
  const season = await loadLatestSeason(team.id);

  if (!season) {
    return (
      <div className="flex max-w-xl flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Season 1</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          You&apos;ll play 7 AI clubs home and away over 14 weeks, from 300 Elo
          below yours to 300 above. The top 4 go into the playoffs. Every match
          pays 1,000, plus 500 for a win or 200 for a draw.
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Your saved{" "}
          <Link href="/team/squad" className="underline">
            matchday squad
          </Link>{" "}
          plays every match, so set it up first.
        </p>
        <StartSeasonButton number={1} />
      </div>
    );
  }

  return (
    <SeasonView
      season={season}
      teamName={team.name}
      elo={team.elo}
      funds={team.funds}
    />
  );
}
