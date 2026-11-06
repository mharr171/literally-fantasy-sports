import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ClubHallOfFamePanel } from "@/components/club-hall-of-fame";
import { EmptyState } from "@/components/empty-state";
import { getCurrentUser } from "@/lib/auth";
import {
  loadClubHallOfFame,
  loadClubHistory,
  type Playoffs,
} from "@/lib/history";
import { loadLatestSeason } from "@/lib/season";
import { loadMyTeam } from "@/lib/team";

export const metadata: Metadata = { title: "History" };

const PLAYOFFS: Record<Playoffs, string> = {
  champion: "🏆 Champions",
  final: "Runners-up",
  semi: "Semi-finals",
  quarter: "Quarter-finals",
  none: "",
};

const ordinal = (n: number) => {
  const s =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ??
        "th");
  return `${n}${s}`;
};

/** Every season the club has played (D121, ADR 0005). */
export default function HistoryPage() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <Link href="/soccer/team" className="text-sm hover:underline">
        ← My team
      </Link>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <History />
      </Suspense>
    </section>
  );
}

async function History() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const team = await loadMyTeam(user.id);
  if (!team) redirect("/soccer/team");
  const [lines, latest, hall] = await Promise.all([
    loadClubHistory(team.id),
    loadLatestSeason(team.id),
    loadClubHallOfFame(team.id),
  ]);
  const inProgress =
    latest && !lines.some((l) => l.seasonNumber === latest.number)
      ? latest
      : null;
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">History</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Every season {team.name} has played. Open one for its table, results,
          scorers and who retired.
        </p>
      </div>
      {lines.length === 0 && !inProgress ? (
        <EmptyState
          title="No seasons yet."
          action={{ href: "/soccer/season", label: "Play a season" }}
        >
          Your seasons appear here as you play them.
        </EmptyState>
      ) : (
        <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[40rem] text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2 text-left">Season</th>
                <th className="px-3 py-2 text-right">Place</th>
                <th className="px-3 py-2 text-right">W-D-L</th>
                <th className="px-3 py-2 text-right">GD</th>
                <th className="px-3 py-2 text-right">Pts</th>
                <th className="px-3 py-2 text-right">Elo</th>
                <th className="px-3 py-2 text-left">Playoffs</th>
              </tr>
            </thead>
            <tbody>
              {inProgress && (
                <tr className="border-t border-zinc-200 dark:border-zinc-800">
                  <td className="px-3 py-1.5">
                    <Link
                      href="/soccer/season"
                      className="font-medium hover:underline"
                    >
                      Season {inProgress.number}
                    </Link>
                  </td>
                  <td colSpan={6} className="px-3 py-1.5 text-zinc-500">
                    In progress
                  </td>
                </tr>
              )}
              {lines.map((l) => {
                const gd = l.scored - l.conceded;
                const elo = l.eloAfter - l.eloBefore;
                return (
                  <tr
                    key={l.seasonNumber}
                    className={`border-t border-zinc-200 dark:border-zinc-800 ${l.playoffs === "champion" ? "bg-amber-50 dark:bg-amber-950/30" : ""}`}
                  >
                    <td className="px-3 py-1.5">
                      <Link
                        href={`/soccer/team/history/${l.seasonNumber}`}
                        className="font-medium hover:underline"
                      >
                        Season {l.seasonNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-1.5 text-right">
                      {ordinal(l.position)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {l.won}-{l.drawn}-{l.lost}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {gd > 0 ? `+${gd}` : gd}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {l.points}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {l.eloBefore} → {l.eloAfter}{" "}
                      <span
                        className={
                          elo >= 0
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-red-700 dark:text-red-400"
                        }
                      >
                        ({elo >= 0 ? "+" : ""}
                        {elo})
                      </span>
                    </td>
                    <td className="px-3 py-1.5">{PLAYOFFS[l.playoffs]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <ClubHallOfFamePanel hall={hall} />
    </div>
  );
}
