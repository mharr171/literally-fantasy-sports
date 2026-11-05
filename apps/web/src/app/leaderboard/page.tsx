import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { ClubBadge } from "@/components/club-badge";
import { EmptyState } from "@/components/empty-state";
import { getCurrentUser } from "@/lib/auth";
import { loadLeaderboard } from "@/lib/season";
import { getSupabaseEnv } from "@/lib/supabase/env";
import { loadMyTeam } from "@/lib/team";

export const metadata: Metadata = { title: "Leaderboard" };

const PLAYOFFS = {
  champion: "🏆 Champions",
  final: "Runners-up",
  semi: "Semi-finals",
  none: "",
} as const;

export default function LeaderboardPage() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Leaderboard</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Every finished soccer season, ranked by Elo at the end of the season,
          then by points, goal difference and goals. Each one also lives on as a
          ghost team in other managers&apos; leagues.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Board />
      </Suspense>
    </section>
  );
}

async function Board() {
  // Always current: read at request time, never at build time.
  await connection();
  if (!getSupabaseEnv())
    return <p className="text-sm text-zinc-500">No seasons yet.</p>;
  const [entries, user] = await Promise.all([
    loadLeaderboard(),
    getCurrentUser(),
  ]);
  const myTeam = user ? await loadMyTeam(user.id) : null;
  if (entries.length === 0)
    return (
      <EmptyState
        title="No finished seasons yet."
        action={{ href: "/season", label: "Play a season" }}
      >
        Finish a season, playoffs included, and your club goes on the board.
      </EmptyState>
    );
  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[40rem] text-sm">
        <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
          <tr>
            <th className="px-3 py-2 text-left">#</th>
            <th className="px-3 py-2 text-left">Club</th>
            <th className="px-3 py-2 text-right">Season</th>
            <th className="px-3 py-2 text-right">Elo</th>
            <th className="px-3 py-2 text-right">Finish</th>
            <th className="px-3 py-2 text-right">W-D-L</th>
            <th className="px-3 py-2 text-right">GD</th>
            <th className="px-3 py-2 text-right">Pts</th>
            <th className="px-3 py-2 text-left">Playoffs</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e, i) => {
            const gd = e.stats.scored - e.stats.conceded;
            const mine = myTeam?.id === e.teamId;
            return (
              <tr
                key={e.id}
                className={`border-t border-zinc-200 dark:border-zinc-800 ${mine ? "bg-sky-50 font-semibold dark:bg-sky-950" : ""}`}
              >
                <td className="px-3 py-1.5">{i + 1}</td>
                <td className="px-3 py-1.5">
                  {e.snapshotId ? (
                    <Link
                      href={`/leaderboard/${e.snapshotId}`}
                      className="inline-flex items-center gap-1.5 hover:underline"
                      title="See this season's roster"
                    >
                      <ClubBadge name={e.teamName} colors={e.colors} />
                      {e.teamName}
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1.5">
                      <ClubBadge name={e.teamName} colors={e.colors} />
                      {e.teamName}
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5 text-right">{e.seasonNumber}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{e.elo}</td>
                <td className="px-3 py-1.5 text-right">
                  {ordinal(e.stats.position)}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {e.stats.won}-{e.stats.drawn}-{e.stats.lost}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {gd > 0 ? `+${gd}` : gd}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {e.stats.points}
                </td>
                <td className="px-3 py-1.5">{PLAYOFFS[e.stats.playoffs]}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function ordinal(n: number): string {
  const s =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ??
        "th");
  return `${n}${s}`;
}
