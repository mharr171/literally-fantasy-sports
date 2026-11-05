import type { Metadata } from "next";
import { Suspense } from "react";
import { listAiClubs, listAiRuns, loadAiSettings } from "@/lib/ai-clubs";
import { requireAdmin } from "@/lib/auth";
import { AiControls } from "./ai-controls";

export const metadata: Metadata = { title: "AI clubs" };

// Adding clubs and running a turn can take a while.
export const maxDuration = 60;

export default function AiClubsPage() {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">AI clubs</h1>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          The AI world (D113): clubs that play their own seasons, buy packs, age
          and take youth, through the same rules as managers. Only admins can
          tell them apart from real clubs.
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
  const [settings, clubs, runs] = await Promise.all([
    loadAiSettings(),
    listAiClubs(),
    listAiRuns(12),
  ]);
  const time = (iso: string) =>
    new Date(iso).toLocaleString("en-GB", {
      timeZone: "UTC",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  const count = (key: "personality" | "pace", value: string) =>
    clubs.filter((c) => c.profile[key] === value).length;
  return (
    <div className="flex flex-col gap-6">
      <AiControls settings={settings} clubs={clubs.length} />
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {clubs.length} of {settings.poolSize} clubs · builders{" "}
        {count("personality", "builder")}, spenders{" "}
        {count("personality", "spender")}, steady{" "}
        {count("personality", "steady")} · slow {count("pace", "slow")}, normal{" "}
        {count("pace", "normal")}, fast {count("pace", "fast")}
      </p>
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Recent scheduled runs</h2>
        {runs.length === 0 ? (
          <p className="text-sm text-zinc-500">
            No runs yet. They start every 2 hours once the AI world is switched
            on and the GitHub secrets are set (setup guide, &ldquo;AI
            world&rdquo;).
          </p>
        ) : (
          <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
                <tr>
                  <th className="px-3 py-2">Started (UTC)</th>
                  <th className="px-3 py-2 text-right">Minutes</th>
                  <th className="px-3 py-2 text-right">Clubs</th>
                  <th className="px-3 py-2 text-right">New</th>
                  <th className="px-3 py-2 text-right">Turns</th>
                  <th className="px-3 py-2 text-right">Left</th>
                  <th className="px-3 py-2 text-right">Weeks</th>
                  <th className="px-3 py-2">Problems</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr
                    key={r.id}
                    className="border-t border-zinc-200 align-top dark:border-zinc-800"
                  >
                    <td className="whitespace-nowrap px-3 py-1.5">
                      {time(r.startedAt)}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {r.finishedAt
                        ? (
                            (Date.parse(r.finishedAt) -
                              Date.parse(r.startedAt)) /
                            60_000
                          ).toFixed(1)
                        : "running or failed"}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {r.clubs}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {r.created}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {r.ran}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {r.skipped}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">
                      {r.weeksPlayed}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-red-600 dark:text-red-400">
                      {r.errors.length === 0 ? (
                        <span className="text-zinc-400">none</span>
                      ) : (
                        <details>
                          <summary className="cursor-pointer">
                            {r.errors.length}
                          </summary>
                          <ul className="mt-1 flex flex-col gap-0.5">
                            {r.errors.map((e) => (
                              <li key={e}>{e}</li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Club</th>
              <th className="px-3 py-2">Manager</th>
              <th className="px-3 py-2">Style</th>
              <th className="px-3 py-2">Pace</th>
              <th className="px-3 py-2">Formation</th>
              <th className="px-3 py-2 text-right">Elo</th>
              <th className="px-3 py-2 text-right">Funds</th>
              <th className="px-3 py-2 text-right">Energy</th>
            </tr>
          </thead>
          <tbody>
            {clubs.map((c) => (
              <tr
                key={c.id}
                className="border-t border-zinc-200 dark:border-zinc-800"
              >
                <td className="px-3 py-1.5 font-medium">{c.name}</td>
                <td className="px-3 py-1.5">{c.managerName}</td>
                <td className="px-3 py-1.5 capitalize">
                  {c.profile.personality}
                </td>
                <td className="px-3 py-1.5 capitalize">{c.profile.pace}</td>
                <td className="px-3 py-1.5">{c.profile.formation}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">{c.elo}</td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {c.funds.toLocaleString("en-US")}
                </td>
                <td className="px-3 py-1.5 text-right tabular-nums">
                  {c.energy}
                </td>
              </tr>
            ))}
            {clubs.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center text-zinc-500">
                  No AI clubs yet. Add a few to try them out.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
