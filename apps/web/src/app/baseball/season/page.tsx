import { currentEnergy } from "@lfs/core";
import {
  BASEBALL_STAGE_NAMES,
  type BaseballStage,
  baseballStandings,
} from "@lfs/sport-baseball";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { loadBaseballYouth } from "@/lib/baseball-squad";
import { loadLatestSeason } from "@/lib/season";
import { loadEnergySettings } from "@/lib/sport-settings";
import { loadMyTeam } from "@/lib/team";
import { SeasonButton, YouthIntake } from "./season-buttons";

export const metadata: Metadata = { title: "Baseball season" };

/** The club's season (ADR 0009 §2): standings, this week's series and the next step. */
export default function BaseballSeasonPage() {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
      <div className="flex items-baseline justify-between gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">⚾ Season</h1>
        <Link href="/baseball/team" className="text-sm underline">
          Your club
        </Link>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Season />
      </Suspense>
    </section>
  );
}

const MANAGER_SLOT = 0;

async function Season() {
  await connection();
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const team = await loadMyTeam(user.id, "baseball");
  if (!team) redirect("/baseball/team");
  const [season, energySettings] = await Promise.all([
    loadLatestSeason(team.id),
    loadEnergySettings("baseball"),
  ]);
  const energy = energySettings.enabled
    ? currentEnergy(
        { energy: team.energy, updatedAt: new Date(team.energyUpdatedAt) },
        new Date(),
        energySettings,
      ).energy
    : null;
  const header = (
    <p className="text-sm text-zinc-600 dark:text-zinc-400">
      Elo <strong>{team.elo}</strong> · Funds{" "}
      <strong>{team.funds.toLocaleString("en-US")}</strong>
      {energy !== null && (
        <>
          {" "}
          · Energy <strong>{energy}</strong>/{energySettings.max}
        </>
      )}
    </p>
  );

  if (!season)
    return (
      <div className="flex flex-col gap-3">
        {header}
        <p className="text-sm">
          A season is 14 weeks: a 3-game series a week against every club in a
          league of 15, at the clubs nearest your Elo. Your bye week is played
          as the season starts. Each week costs 1 energy.
        </p>
        <SeasonButton action="start" label="Start your first season" />
      </div>
    );

  const name = (slot: number) =>
    season.slots.find((s) => s.slot === slot)?.name ?? `Club ${slot}`;
  const played = season.fixtures.filter(
    (f) => f.homeScore !== null && f.awayScore !== null,
  );
  const table = baseballStandings(
    season.slots.map((s) => s.slot),
    played.map((f) => ({
      homeSlot: f.homeSlot,
      awaySlot: f.awaySlot,
      homeScore: f.homeScore as number,
      awayScore: f.awayScore as number,
    })),
  );
  const mine = season.fixtures.filter(
    (f) => f.homeSlot === MANAGER_SLOT || f.awaySlot === MANAGER_SLOT,
  );
  const weeks = [...new Set(mine.map((f) => f.week))].sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-5">
      {header}
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <p className="text-sm">
          Season <strong>{season.number}</strong> ·{" "}
          {season.status === "finished"
            ? "Finished"
            : `Week ${season.week} of 14`}
        </p>
        <span className="flex-1" />
        {season.status !== "finished" && (
          <SeasonButton action="play" label="Play this week's series" />
        )}
        {season.status === "finished" && !season.closed && (
          <SeasonButton action="end" label="Wrap up the season" />
        )}
        {season.closed && season.intakeResolved && (
          <SeasonButton action="start" label="Start the next season" />
        )}
      </div>

      {season.closed && !season.intakeResolved && (
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">Youth intake</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            Take any of these prospects into your squad for free. Potential is a
            scout&apos;s estimate.
          </p>
          <YouthIntake prospects={await loadBaseballYouth(season.seed)} />
        </div>
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Standings</h2>
        <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Club</th>
                <th className="px-3 py-2 text-right">W</th>
                <th className="px-3 py-2 text-right">L</th>
                <th className="px-3 py-2 text-right">PCT</th>
                <th className="px-3 py-2 text-right">GB</th>
                <th className="px-3 py-2 text-right">RS</th>
                <th className="px-3 py-2 text-right">RA</th>
                <th className="px-3 py-2 text-right">Elo</th>
              </tr>
            </thead>
            <tbody>
              {table.map((r, i) => (
                <tr
                  key={r.slot}
                  className={`border-t border-zinc-100 dark:border-zinc-800 ${r.slot === MANAGER_SLOT ? "bg-sky-50 font-medium dark:bg-sky-950/40" : ""}`}
                >
                  <td className="px-3 py-1.5 text-zinc-500">{i + 1}</td>
                  <td className="px-3 py-1.5">{name(r.slot)}</td>
                  <td className="px-3 py-1.5 text-right">{r.won}</td>
                  <td className="px-3 py-1.5 text-right">{r.lost}</td>
                  <td className="px-3 py-1.5 text-right">
                    {r.won + r.lost === 0
                      ? "–"
                      : r.pct.toFixed(3).replace(/^0/, "")}
                  </td>
                  <td className="px-3 py-1.5 text-right">
                    {r.gamesBehind === 0 ? "–" : r.gamesBehind.toFixed(1)}
                  </td>
                  <td className="px-3 py-1.5 text-right">{r.runsScored}</td>
                  <td className="px-3 py-1.5 text-right">{r.runsAllowed}</td>
                  <td className="px-3 py-1.5 text-right">
                    {r.slot === MANAGER_SLOT
                      ? team.elo
                      : season.slots.find((s) => s.slot === r.slot)?.elo}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Your schedule</h2>
        <ol className="flex flex-col gap-1 text-sm">
          {weeks.map((w) => {
            const games = mine
              .filter((f) => f.week === w)
              .sort((a, b) => (a.gameNo ?? 1) - (b.gameNo ?? 1));
            const first = games[0];
            if (!first) return null;
            const home = first.homeSlot === MANAGER_SLOT;
            const opponent = name(home ? first.awaySlot : first.homeSlot);
            return (
              <li
                key={w}
                className={`flex flex-wrap items-baseline gap-x-3 rounded px-2 py-1 ${w === season.week && season.status !== "finished" ? "bg-amber-50 dark:bg-amber-950/40" : ""}`}
              >
                <span className="w-16 text-zinc-500">Week {w}</span>
                <span className="w-56">
                  {home ? "vs" : "at"} {opponent}
                  {first.stage !== "league" && (
                    <span className="text-xs text-zinc-500">
                      {" "}
                      · {BASEBALL_STAGE_NAMES[first.stage as BaseballStage]}
                    </span>
                  )}
                </span>
                <span className="flex gap-3">
                  {games.map((g) => {
                    if (g.homeScore === null || g.awayScore === null)
                      return (
                        <span key={g.id} className="text-zinc-400">
                          G{g.gameNo ?? 1}
                        </span>
                      );
                    const us = home ? g.homeScore : g.awayScore;
                    const them = home ? g.awayScore : g.homeScore;
                    return (
                      <span
                        key={g.id}
                        className={
                          us > them
                            ? "text-emerald-700 dark:text-emerald-400"
                            : "text-red-700 dark:text-red-400"
                        }
                      >
                        {us > them ? "W" : "L"} {us}–{them}
                      </span>
                    );
                  })}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
