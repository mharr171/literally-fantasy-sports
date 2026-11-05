import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { SeasonView } from "@/app/season/season-view";
import { RetirementTributes } from "@/components/retirement-tributes";
import { SeasonReviewPanel } from "@/components/season-review";
import { getCurrentUser } from "@/lib/auth";
import { loadClubHistory, loadTributes, seasonScorers } from "@/lib/history";
import { loadSeasonByNumber } from "@/lib/season";
import { loadMyTeam } from "@/lib/team";

export const metadata: Metadata = { title: "Past season" };

/** One of your club's past seasons (D121, ADR 0005). */
export default function PastSeasonPage({
  params,
}: PageProps<"/team/history/[season]">) {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <Link href="/team/history" className="text-sm hover:underline">
        ← History
      </Link>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <PastSeason params={params} />
      </Suspense>
    </section>
  );
}

async function PastSeason({
  params,
}: Pick<PageProps<"/team/history/[season]">, "params">) {
  const { season: raw } = await params;
  if (!/^\d{1,4}$/.test(raw)) notFound();
  const number = Number(raw);
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const team = await loadMyTeam(user.id);
  if (!team) redirect("/team");
  const [season, lines, tributes] = await Promise.all([
    loadSeasonByNumber(team.id, number),
    loadClubHistory(team.id),
    loadTributes(team.id, number),
  ]);
  if (!season) notFound();
  const line = lines.find((l) => l.seasonNumber === number);
  // Still being played: that's the Season page.
  if (!line) redirect("/season");
  const scorers = seasonScorers(season);
  return (
    <>
      <SeasonView
        season={season}
        teamName={team.name}
        teamColors={team.colors}
        elo={line.eloAfter}
        funds={0}
        archive={{ eloBefore: line.eloBefore, eloAfter: line.eloAfter }}
      />
      <div className="grid gap-4 sm:grid-cols-[1fr_2fr]">
        <div className="rounded-md border border-zinc-200 p-4 text-sm dark:border-zinc-800">
          <h2 className="mb-2 text-lg font-semibold">Top scorers</h2>
          {scorers.length === 0 ? (
            <p className="text-zinc-500">No goals recorded.</p>
          ) : (
            <ol className="flex flex-col gap-0.5">
              {scorers.slice(0, 10).map((s, i) => (
                <li key={s.name} className="flex justify-between gap-3">
                  <span>
                    <span className="mr-2 tabular-nums text-zinc-500">
                      {i + 1}
                    </span>
                    {s.name}
                  </span>
                  <span className="font-semibold tabular-nums">{s.goals}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
        {season.review && (
          <div className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
            <h2 className="mb-2 text-lg font-semibold">
              At the season&apos;s end
            </h2>
            <SeasonReviewPanel review={season.review} />
          </div>
        )}
      </div>
      <RetirementTributes tributes={tributes} />
    </>
  );
}
