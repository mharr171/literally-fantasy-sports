import type { Metadata } from "next";
import { Suspense } from "react";
import { loadAccountProgress } from "@/lib/account-progress";
import { requireAdmin } from "@/lib/auth";
import { sportUi } from "@/sports/registry";

export const metadata: Metadata = { title: "Account progress" };

export default function AccountProgressPage() {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Account progress
        </h1>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Each manager&apos;s finished seasons, titles, finals and best
          season-end Elo in every sport (D206.9). Recorded at every season close
          and kept when a club is reset, ready for cross-sport bonuses. AI clubs
          aren&apos;t counted.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Content />
      </Suspense>
    </section>
  );
}

async function Content() {
  await requireAdmin();
  const lines = await loadAccountProgress();
  if (lines.length === 0)
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        No manager has finished a season yet.
      </p>
    );
  const day = (iso: string) =>
    new Date(iso).toLocaleDateString("en-GB", {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-zinc-500">
          <tr>
            <th className="py-1 pr-3 font-medium">Manager</th>
            <th className="py-1 pr-3 font-medium">Sport</th>
            <th className="py-1 pr-3 text-right font-medium">Seasons</th>
            <th className="py-1 pr-3 text-right font-medium">Titles</th>
            <th className="py-1 pr-3 text-right font-medium">Finals</th>
            <th className="py-1 pr-3 text-right font-medium">Best Elo</th>
            <th className="py-1 font-medium">Last season</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => {
            const ui = sportUi(l.sport);
            return (
              <tr
                key={`${l.ownerId}-${l.sport}`}
                className="border-t border-zinc-200 dark:border-zinc-800"
              >
                <td className="py-1 pr-3">
                  {l.name ?? (
                    <span className="text-zinc-500">(no profile)</span>
                  )}
                </td>
                <td className="py-1 pr-3">
                  {ui ? `${ui.icon} ${ui.name}` : l.sport}
                </td>
                <td className="py-1 pr-3 text-right tabular-nums">
                  {l.seasons}
                </td>
                <td className="py-1 pr-3 text-right tabular-nums">
                  {l.titles}
                </td>
                <td className="py-1 pr-3 text-right tabular-nums">
                  {l.finals}
                </td>
                <td className="py-1 pr-3 text-right tabular-nums">
                  {l.bestElo ?? "–"}
                </td>
                <td className="py-1">{day(l.lastAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
