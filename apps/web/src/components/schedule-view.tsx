import {
  colorMatchups,
  dominantMatchup,
  STAGE_MATCH_NAMES,
  type Stage,
} from "@lfs/sport-soccer";
import Link from "next/link";
import { ChemistryShares } from "@/components/chemistry-shares";
import { ClubBadge } from "@/components/club-badge";
import { ChemistryDot } from "@/components/player/player-card";
import { CHEMISTRY_COLORS } from "@/lib/chemistry-colors";
import type { Schedule } from "@/lib/club-view";

const colorName = (c: number | null) =>
  c === null ? "none" : (CHEMISTRY_COLORS[c]?.name ?? "Unknown");

function Matchup({
  mine,
  theirs,
  cycle,
}: {
  mine: readonly { chemistryColor: number }[];
  theirs: readonly { chemistryColor: number }[];
  cycle: readonly number[];
}) {
  const m = dominantMatchup(mine, theirs, cycle);
  if (m.mine === null || m.theirs === null)
    return <span className="text-zinc-500">No dominant color</span>;
  const verb = m.edge > 0 ? "beats" : m.edge < 0 ? "loses to" : "even with";
  const tone =
    m.edge > 0
      ? "text-emerald-700 dark:text-emerald-400"
      : m.edge < 0
        ? "text-red-700 dark:text-red-400"
        : "text-zinc-600 dark:text-zinc-400";
  return (
    <span className={`inline-flex items-center gap-1 ${tone}`}>
      <ChemistryDot color={m.mine} /> {verb} <ChemistryDot color={m.theirs} />
      <span className="sr-only">
        Your {colorName(m.mine)} {verb} their {colorName(m.theirs)}
      </span>
    </span>
  );
}

/** The season schedule with each opponent's colors (D139). */
export function ScheduleView({ schedule }: { schedule: Schedule }) {
  const mine = dominantMatchup(schedule.myStarters, []).mine;
  const cycle = mine === null ? null : colorMatchups(mine, schedule.cycle);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Season {schedule.seasonNumber} schedule
        </h1>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Every opponent&apos;s starting 11 by chemistry color. Leagues are
          frozen copies, so these stay the same all season. Each color beats the
          next two along Red → Yellow → Green → Blue → Purple and loses to the
          two before it.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ChemistryShares
          title="Your starting 11"
          players={schedule.myStarters}
        />
        <div className="flex flex-col gap-1 rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
          <h2 className="font-semibold">Your dominant color</h2>
          {mine === null || !cycle ? (
            <p className="text-zinc-500">
              No single largest color group in your starting 11 (at least 2
              players, no tie).
            </p>
          ) : (
            <>
              <p className="inline-flex items-center gap-1.5">
                <ChemistryDot color={mine} /> {colorName(mine)}
              </p>
              <p>
                Beats {cycle.beats.map(colorName).join(" and ")}; loses to{" "}
                {cycle.losesTo.map(colorName).join(" and ")}.
              </p>
            </>
          )}
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="py-2 pr-3">Week</th>
              <th className="py-2 pr-3">Opponent</th>
              <th className="py-2 pr-3">Their starting 11</th>
              <th className="py-2 pr-3">Dominant colors</th>
              <th className="py-2">Result</th>
            </tr>
          </thead>
          <tbody>
            {schedule.rows.map((r) => (
              <tr
                key={r.id}
                className={`border-t border-zinc-200 dark:border-zinc-800 ${
                  r.week === schedule.week && !r.result
                    ? "bg-zinc-50 dark:bg-zinc-900"
                    : ""
                }`}
              >
                <td className="py-2 pr-3 align-top tabular-nums">
                  {r.week}
                  {r.stage !== "league" && (
                    <span className="block text-xs text-zinc-500">
                      {STAGE_MATCH_NAMES[r.stage as Stage] ?? r.stage}
                    </span>
                  )}
                </td>
                <td className="py-2 pr-3 align-top">
                  <Link
                    href={`/season/club/${r.opponent.slot}`}
                    className="inline-flex items-center gap-2 hover:underline"
                  >
                    <ClubBadge
                      name={r.opponent.name}
                      colors={r.opponent.colors}
                    />
                    {r.opponent.name}
                  </Link>
                  <span className="block text-xs text-zinc-500">
                    {r.home ? "Home" : "Away"}
                  </span>
                </td>
                <td className="py-2 pr-3 align-top">
                  <ChemistryShares players={r.opponentStarters} compact />
                </td>
                <td className="py-2 pr-3 align-top">
                  <Matchup
                    cycle={schedule.cycle}
                    mine={schedule.myStarters}
                    theirs={r.opponentStarters}
                  />
                </td>
                <td className="py-2 align-top tabular-nums">
                  {r.result
                    ? `${r.result.won === true ? "W" : r.result.won === false ? "L" : "D"} ${r.result.for}–${r.result.against}`
                    : "–"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        Your colors are from your saved matchday squad. Change it on the{" "}
        <Link href="/team/squad" className="underline">
          matchday squad
        </Link>{" "}
        page.
      </p>
    </div>
  );
}
