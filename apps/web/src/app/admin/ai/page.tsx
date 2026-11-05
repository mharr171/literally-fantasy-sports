import type { Metadata } from "next";
import { Suspense } from "react";
import { listAiClubs, loadAiSettings } from "@/lib/ai-clubs";
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
  const [settings, clubs] = await Promise.all([
    loadAiSettings(),
    listAiClubs(),
  ]);
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
