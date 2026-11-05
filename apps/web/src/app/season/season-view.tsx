import {
  hasBracket,
  leagueWeeks,
  MANAGER_SLOT,
  type MatchSummary,
  STAGE_MATCH_NAMES,
  STAGE_NAMES,
  table,
} from "@lfs/sport-soccer";
import Link from "next/link";
import type { ReactNode } from "react";
import { ClubBadge } from "@/components/club-badge";
import { EmptyState } from "@/components/empty-state";
import { moraleLabel } from "@/components/form-label";
import type { LoadedSeason } from "@/lib/season";
import { type EnergyView, PlayWeekButton } from "./season-buttons";

function stageLabel(season: LoadedSeason): string {
  if (season.status === "finished") return "Finished";
  const current = season.fixtures.find((f) => f.week === season.week);
  if (current && current.stage !== "league")
    return `Playoffs: ${STAGE_NAMES[current.stage].toLowerCase()}`;
  return `Week ${season.week} of ${leagueWeeks(season.slots.length)}`;
}

/** A season in progress or finished: next match, last result, table and results. */
export function SeasonView({
  season,
  teamName,
  teamColors,
  elo,
  funds,
  wrapUp,
  energy,
  notice,
  morale,
}: {
  /** Team morale, −1 to 1 (M4). */
  morale?: number;
  /** Shown under the next match, e.g. who sits out injured or suspended. */
  notice?: ReactNode;
  /** The manager's energy now, or null when energy is switched off (D93). */
  energy?: EnergyView | null;
  season: LoadedSeason;
  teamName: string;
  /** The manager's club colors (D107); other clubs get theirs from their name. */
  teamColors?: string[];
  elo: number;
  funds: number;
  /** Season-end steps, shown once the season is finished. */
  wrapUp?: ReactNode;
}) {
  const name = (slot: number) =>
    season.slots.find((s) => s.slot === slot)?.name ?? "?";
  const badge = (slot: number) => {
    const own = season.slots.find((s) => s.slot === slot)?.colors ?? [];
    return (
      <ClubBadge
        name={name(slot)}
        colors={
          slot === MANAGER_SLOT ? teamColors : own.length > 0 ? own : null
        }
      />
    );
  };
  const standings = table(season.slots, season.fixtures);
  const played = season.fixtures.filter((f) => f.homeScore !== null);
  const mine = (f: { homeSlot: number; awaySlot: number }) =>
    f.homeSlot === MANAGER_SLOT || f.awaySlot === MANAGER_SLOT;
  const lastMine = [...played].reverse().find(mine);
  const upcoming = season.fixtures.filter(
    (f) => f.week === season.week && f.homeScore === null,
  );
  const nextMine = upcoming.find(mine);
  const final = season.fixtures.find(
    (f) => f.stage === "final" && f.homeScore !== null,
  );
  const champion = final
    ? final.winner === "home"
      ? final.homeSlot
      : final.awaySlot
    : null;
  const weeks = [...new Set(played.map((f) => f.week))].sort((a, b) => b - a);
  // Lines under the places that go through (D117: 7th and 9th; else 4th).
  const bracket = hasBracket(season.slots);
  const lines = bracket ? [6, 8] : [3];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Season {season.number}
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            {teamName} · {stageLabel(season)} · Elo {elo}
            {morale !== undefined && ` · Morale ${moraleLabel(morale)}`} · Funds{" "}
            {funds.toLocaleString("en-US")}
          </p>
        </div>
        <Link
          href="/team/squad"
          className="text-sm font-medium hover:underline"
        >
          Matchday squad →
        </Link>
      </div>

      {season.status === "finished" ? (
        <div className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="font-semibold">
            {champion === MANAGER_SLOT
              ? "Champions! You won the playoff final."
              : `${name(champion ?? 0)} won the title.`}
          </p>
          {wrapUp}
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-4 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
          <div className="flex-1 text-sm">
            {nextMine ? (
              <>
                Next:{" "}
                <strong>
                  {name(nextMine.homeSlot)} v {name(nextMine.awaySlot)}
                </strong>
                {nextMine.stage !== "league" &&
                  " (knockout: extra time and penalties if level)"}
              </>
            ) : (
              <>
                You&apos;re not in this round, so it costs no energy. Play it to
                see who goes through.
              </>
            )}
          </div>
          <PlayWeekButton
            label={
              nextMine
                ? `Play ${stageLabel(season).toLowerCase().startsWith("week") ? `week ${season.week}` : "match"}`
                : "Play the round"
            }
            energy={energy ?? null}
          />
        </div>
      )}

      {season.status !== "finished" && notice}
      {lastMine?.summary && (
        <MatchCard
          id={lastMine.id}
          title={`Last match · ${lastMine.stage === "league" ? `week ${lastMine.week}` : STAGE_MATCH_NAMES[lastMine.stage]}`}
          home={name(lastMine.homeSlot)}
          away={name(lastMine.awaySlot)}
          homeScore={lastMine.homeScore as number}
          awayScore={lastMine.awayScore as number}
          summary={lastMine.summary}
        />
      )}

      <div className="flex flex-col gap-2">
        <h2 className="text-xl font-semibold">Table</h2>
        <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="w-full min-w-[32rem] text-sm">
            <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2 text-left">#</th>
                <th className="px-3 py-2 text-left">Club</th>
                {["P", "W", "D", "L", "GF", "GA", "GD", "Pts", "Elo"].map(
                  (h) => (
                    <th key={h} className="px-2 py-2 text-right">
                      {h}
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {standings.map((r, i) => {
                const slot = Number(r.team);
                const info = season.slots.find((s) => s.slot === slot);
                return (
                  <tr
                    key={r.team}
                    className={`border-t border-zinc-200 dark:border-zinc-800 ${slot === MANAGER_SLOT ? "bg-sky-50 font-semibold dark:bg-sky-950" : ""} ${lines.includes(i) ? "border-b-2 border-b-zinc-400" : ""}`}
                  >
                    <td className="px-3 py-1.5">{i + 1}</td>
                    <td className="px-3 py-1.5">
                      <Link
                        href={`/season/club/${slot}`}
                        className="inline-flex items-center gap-1.5 hover:underline"
                        title="See this club's roster"
                      >
                        {badge(slot)}
                        {info?.name}
                      </Link>
                    </td>
                    {(
                      [
                        ["p", r.played],
                        ["w", r.won],
                        ["d", r.drawn],
                        ["l", r.lost],
                        ["gf", r.scored],
                        ["ga", r.conceded],
                        ["gd", r.difference],
                        ["pts", r.points],
                      ] as const
                    ).map(([col, v]) => (
                      <td
                        key={col}
                        className="px-2 py-1.5 text-right tabular-nums"
                      >
                        {col === "gd" && v > 0 ? `+${v}` : v}
                      </td>
                    ))}
                    <td className="px-2 py-1.5 text-right tabular-nums text-zinc-500">
                      {slot === MANAGER_SLOT ? elo : info?.elo}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-zinc-500">
          {bracket
            ? "The top 7 go straight to the quarter-finals; 8th and 9th meet in a play-in for the last place."
            : "The top 4 (above the line) reach the playoffs."}
        </p>
      </div>

      {weeks.length === 0 && (
        <EmptyState title="No results yet.">
          Play week 1 and the results fill in here. Each one opens a match page
          with a heatmap, the play-by-play and a replay.
        </EmptyState>
      )}

      {weeks.length > 0 && (
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">Results</h2>
          {weeks.map((w) => {
            const games = played.filter((f) => f.week === w);
            const stage = games[0]?.stage;
            return (
              <details
                key={w}
                open={w === weeks[0]}
                className="rounded-md border border-zinc-200 p-2 text-sm dark:border-zinc-800"
              >
                <summary className="cursor-pointer font-medium">
                  {stage && stage !== "league"
                    ? STAGE_NAMES[stage]
                    : `Week ${w}`}
                </summary>
                <ul className="mt-1 flex flex-col">
                  {games.map((f) => (
                    <li
                      key={f.id}
                      className={`grid grid-cols-[1fr_auto_1fr] gap-2 py-0.5 ${mine(f) ? "font-semibold" : ""}`}
                    >
                      <span className="truncate text-right">
                        {name(f.homeSlot)} {badge(f.homeSlot)}
                      </span>
                      <Link
                        href={`/season/match/${f.id}`}
                        className="tabular-nums hover:underline"
                        title="Heatmap, play-by-play and replay"
                      >
                        {f.homeScore} – {f.awayScore}
                        {f.summary?.decidedBy === "penalties" &&
                        f.summary.penalties
                          ? ` (${f.summary.penalties.home}–${f.summary.penalties.away} pens)`
                          : f.summary?.decidedBy === "extra_time"
                            ? " (aet)"
                            : ""}
                      </Link>
                      <span className="truncate">
                        {badge(f.awaySlot)} {name(f.awaySlot)}
                      </span>
                    </li>
                  ))}
                </ul>
              </details>
            );
          })}
        </div>
      )}
    </>
  );
}

function MatchCard({
  id,
  title,
  home,
  away,
  homeScore,
  awayScore,
  summary,
}: {
  id: string;
  title: string;
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
  summary: MatchSummary;
}) {
  const icon = { goal: "⚽", yellow: "🟨", red: "🟥", injury: "✚" } as const;
  return (
    <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{title}</p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-lg">
        <span className="text-right font-semibold">{home}</span>
        <span className="text-2xl font-bold tabular-nums">
          {homeScore} – {awayScore}
        </span>
        <span className="font-semibold">{away}</span>
      </div>
      {summary.decidedBy && (
        <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
          {summary.decidedBy === "penalties" && summary.penalties
            ? `Won ${Math.max(summary.penalties.home, summary.penalties.away)}–${Math.min(summary.penalties.home, summary.penalties.away)} on penalties`
            : "After extra time"}
        </p>
      )}
      <div className="grid grid-cols-[1fr_auto_1fr] gap-x-3 text-sm">
        {(["possession", "shots"] as const).map((stat) => (
          <div key={stat} className="contents">
            <span className="text-right tabular-nums">
              {stat === "possession"
                ? `${Math.round(summary.possession.home * 100)}%`
                : summary.shots.home}
            </span>
            <span className="text-center text-zinc-500">
              {stat === "possession" ? "Possession" : "On target"}
            </span>
            <span className="tabular-nums">
              {stat === "possession"
                ? `${Math.round(summary.possession.away * 100)}%`
                : summary.shots.away}
            </span>
          </div>
        ))}
      </div>
      {summary.events.length > 0 && (
        <ul className="grid grid-cols-2 gap-x-4 text-sm">
          {summary.events.map((e, i) => (
            <li
              // biome-ignore lint/suspicious/noArrayIndexKey: events never reorder
              key={i}
              className={
                e.side === "home" ? "col-start-1 text-right" : "col-start-2"
              }
            >
              {e.minute}&apos; {icon[e.type]} {e.player}
            </li>
          ))}
        </ul>
      )}
      <Link
        href={`/season/match/${id}`}
        className="self-center text-sm font-medium hover:underline"
      >
        Heatmap, play-by-play and replay →
      </Link>
    </div>
  );
}
