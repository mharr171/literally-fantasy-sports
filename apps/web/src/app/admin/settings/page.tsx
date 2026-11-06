import type { Metadata } from "next";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import {
  type ConfigVersionSummary,
  listConfigVersions,
} from "@/lib/game-config";
import {
  loadEnergySettings,
  loadRosterLimits,
  loadSportSwitches,
  SPORTS,
} from "@/lib/sport-settings";
import { sportUi } from "@/sports/registry";
import { EnergyForm } from "./energy-form";
import { RosterForm } from "./roster-form";
import { SwitchesForm } from "./switches-form";

export const metadata: Metadata = { title: "Game settings" };

export default function SettingsPage() {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Game settings</h1>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Each sport has numbered versions of its settings. New matches use the{" "}
          <strong>live</strong> version (the newest published one). Published
          versions can never change, so old matches always replay exactly; to
          change something, publish a new version. Until a sport has one, it
          uses the defaults built into the game.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <VersionTable />
      </Suspense>
      <div className="mt-4 flex flex-col gap-2">
        <h2 className="text-xl font-semibold tracking-tight">Energy</h2>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Playing a game week costs 1 energy, which comes back one point at a
          time up to the maximum. Switch it off to let every manager of that
          sport play as often as they like. Changes apply straight away, with no
          new settings version.
        </p>
        <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
          <EnergySettingsList />
        </Suspense>
      </div>
    </section>
  );
}

const STATUS_STYLES: Record<ConfigVersionSummary["status"], string> = {
  live: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
  draft: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-200",
  past: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

async function VersionTable() {
  await requireAdmin();
  const versions = await listConfigVersions();
  if (versions.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:text-zinc-400">
        No settings versions yet. Every sport is using its built-in defaults.
        The template editor will create the first version.
      </p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full text-left text-sm">
        <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
          <tr>
            <th className="px-4 py-2 font-medium">Sport</th>
            <th className="px-4 py-2 font-medium">Version</th>
            <th className="px-4 py-2 font-medium">Status</th>
            <th className="px-4 py-2 font-medium">Note</th>
            <th className="px-4 py-2 font-medium">Created</th>
            <th className="px-4 py-2 font-medium">Published</th>
          </tr>
        </thead>
        <tbody>
          {versions.map((v) => (
            <tr
              key={`${v.scope}-${v.version}`}
              className="border-t border-zinc-200 dark:border-zinc-800"
            >
              <td className="px-4 py-2 capitalize">{v.scope}</td>
              <td className="px-4 py-2 tabular-nums">{v.version}</td>
              <td className="px-4 py-2">
                <span
                  className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[v.status]}`}
                >
                  {v.status}
                </span>
              </td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                {v.note || "—"}
              </td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                {formatDate(v.createdAt)}
              </td>
              <td className="px-4 py-2 text-zinc-600 dark:text-zinc-400">
                {v.publishedAt ? formatDate(v.publishedAt) : "—"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

async function EnergySettingsList() {
  await requireAdmin();
  const switches = await loadSportSwitches();
  const settings = await Promise.all(
    SPORTS.map(async (sport) => ({
      sport,
      value: await loadEnergySettings(sport),
      limits: await loadRosterLimits(sport),
      switches: switches.find((s) => s.sport === sport),
    })),
  );
  return (
    <div className="flex flex-col gap-3">
      {settings.map(({ sport, value, limits, switches: sw }) => (
        <div key={sport} className="flex flex-col gap-3">
          {/* Show or hide the sport, and run its AI world (D207). */}
          <SwitchesForm
            sport={sport}
            name={sportUi(sport)?.name ?? sport}
            initial={{
              public: sw?.public ?? false,
              aiEnabled: sw?.aiEnabled ?? false,
            }}
          />
          <EnergyForm sport={sport} initial={value} />
          <RosterForm sport={sport} initial={limits} />
        </div>
      ))}
    </div>
  );
}
