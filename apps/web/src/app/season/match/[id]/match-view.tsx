"use client";

import type { Side } from "@lfs/core";
import type { MatchSummary, PlayLine } from "@lfs/sport-soccer";
import { useEffect, useMemo, useRef, useState } from "react";
import { ClubBadge } from "@/components/club-badge";

export interface MatchViewProps {
  title: string;
  teams: Record<Side, string>;
  /** Club colors per side (D107); null for clubs that have none. */
  teamColors?: Record<Side, string[] | null>;
  /** The manager's side, or null for a match between two other clubs. */
  mySide: Side | null;
  score: Record<Side, number>;
  summary: MatchSummary | null;
  /** The match played again from its seed, or null if it can't be. */
  replay: {
    lines: PlayLine[];
    /** Each side's average influence, both in the home team's frame. */
    influence: Record<Side, number[][]>;
    length: number;
  } | null;
  /** Why there's no replay, if there isn't one. */
  problem: string | null;
}

const ICONS: Record<PlayLine["kind"], string> = {
  goal: "⚽",
  shot: "◎",
  card: "▮",
  sub: "⇄",
  injury: "✚",
  move: "↔",
  penalty: "●",
  period: "⏱",
};

/** Milliseconds per match minute while the replay plays. */
const TICK_MS = 120;

export function MatchView({
  title,
  teams,
  teamColors,
  mySide,
  score,
  summary,
  replay,
  problem,
}: MatchViewProps) {
  // When each line appears in the replay: its minute, and one tick per
  // shoot-out kick after 120 minutes so penalties come one at a time.
  const ticks = useMemo(() => {
    if (!replay) return [];
    let extra = 0;
    let shootout = false;
    return replay.lines.map((l) => {
      if (l.penalties) shootout = true;
      if (shootout) extra += 3;
      return l.minute + extra;
    });
  }, [replay]);
  const lastTick = ticks.at(-1) ?? 0;
  // Every shot in the log, on target or not.
  const chances = replay && {
    home: replay.lines
      .filter((l) => l.kind === "shot" || l.kind === "goal")
      .filter((l) => l.side === "home").length,
    away: replay.lines
      .filter((l) => l.kind === "shot" || l.kind === "goal")
      .filter((l) => l.side === "away").length,
  };
  const [tick, setTick] = useState<number | null>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing) return;
    const timer = setInterval(() => setTick((t) => (t ?? 0) + 1), TICK_MS);
    return () => clearInterval(timer);
  }, [playing]);
  // At the final whistle the replay stops and shows the whole match.
  useEffect(() => {
    if (tick !== null && tick > lastTick) {
      setPlaying(false);
      setTick(null);
    }
  }, [tick, lastTick]);

  const shown = replay
    ? tick === null
      ? replay.lines
      : replay.lines.filter((_, i) => (ticks[i] ?? 0) <= tick)
    : [];
  const current = shown.at(-1);
  const liveScore = tick === null ? score : (current?.score ?? score);
  const livePens = tick === null ? summary?.penalties : current?.penalties;
  const clock =
    tick === null ? null : Math.min(tick, replay?.length ?? 90, 120);

  const logRef = useRef<HTMLOListElement>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll as lines appear
  useEffect(() => {
    const el = logRef.current;
    if (el && tick !== null) el.scrollTop = el.scrollHeight;
  }, [shown.length, tick]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
        <p className="text-xs uppercase tracking-wide text-zinc-500">{title}</p>
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-lg">
          <span
            className={`text-right font-semibold ${mySide === "home" ? "text-sky-700 dark:text-sky-400" : ""}`}
          >
            {teams.home}{" "}
            <ClubBadge name={teams.home} colors={teamColors?.home} />
          </span>
          <span className="text-center">
            <span className="block text-3xl font-bold tabular-nums">
              {liveScore.home} – {liveScore.away}
            </span>
            {livePens && (
              <span className="block text-xs text-zinc-500 tabular-nums">
                pens {livePens.home}–{livePens.away}
              </span>
            )}
            <span className="block text-xs text-zinc-500 tabular-nums">
              {clock === null
                ? summary?.decidedBy === "extra_time"
                  ? "After extra time"
                  : summary?.decidedBy === "penalties"
                    ? "After penalties"
                    : "Full time"
                : `${clock}'`}
            </span>
          </span>
          <span
            className={`font-semibold ${mySide === "away" ? "text-sky-700 dark:text-sky-400" : ""}`}
          >
            <ClubBadge name={teams.away} colors={teamColors?.away} />{" "}
            {teams.away}
          </span>
        </div>
        {summary && (
          <div className="grid grid-cols-[1fr_auto_1fr] gap-x-3 text-sm">
            <span className="text-right tabular-nums">
              {Math.round(summary.possession.home * 100)}%
            </span>
            <span className="text-center text-zinc-500">Possession</span>
            <span className="tabular-nums">
              {Math.round(summary.possession.away * 100)}%
            </span>
            {chances && (
              <>
                <span className="text-right tabular-nums">{chances.home}</span>
                <span className="text-center text-zinc-500">Chances</span>
                <span className="tabular-nums">{chances.away}</span>
              </>
            )}
            <span className="text-right tabular-nums">
              {summary.shots.home}
            </span>
            <span className="text-center text-zinc-500">On target</span>
            <span className="tabular-nums">{summary.shots.away}</span>
          </div>
        )}
      </div>

      {problem && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          {problem}
        </p>
      )}

      {replay && (
        <div className="grid gap-6 md:grid-cols-[auto_1fr]">
          <PitchPanel teams={teams} influence={replay.influence} />
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="mr-auto text-xl font-semibold">Play-by-play</h2>
              {playing ? (
                <button
                  type="button"
                  onClick={() => setPlaying(false)}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium dark:border-zinc-700"
                >
                  Pause
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    if (tick === null) setTick(0);
                    setPlaying(true);
                  }}
                  className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-100 dark:text-zinc-900"
                >
                  {tick === null ? "▶ Watch the replay" : "▶ Resume"}
                </button>
              )}
              {tick !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setPlaying(false);
                    setTick(null);
                  }}
                  className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium dark:border-zinc-700"
                >
                  Skip to the end
                </button>
              )}
            </div>
            {tick !== null && (
              <div
                className="h-1.5 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800"
                role="progressbar"
                aria-label="Replay progress"
                aria-valuemin={0}
                aria-valuemax={lastTick}
                aria-valuenow={tick}
              >
                <div
                  className="h-full bg-sky-600"
                  style={{ width: `${(tick / Math.max(1, lastTick)) * 100}%` }}
                />
              </div>
            )}
            <ol
              ref={logRef}
              aria-live={playing ? "polite" : "off"}
              className="flex max-h-[32rem] flex-col overflow-y-auto rounded-md border border-zinc-200 text-sm dark:border-zinc-800"
            >
              {shown.map((l, i) => (
                <li
                  // biome-ignore lint/suspicious/noArrayIndexKey: lines never reorder
                  key={i}
                  className={`grid grid-cols-[2.5rem_1.25rem_1fr_auto] items-baseline gap-2 border-b border-zinc-100 px-3 py-1.5 last:border-b-0 dark:border-zinc-900 ${l.kind === "goal" ? "bg-emerald-50 font-semibold dark:bg-emerald-950/40" : ""} ${l.kind === "period" ? "text-zinc-500" : ""}`}
                >
                  <span className="text-right tabular-nums text-zinc-500">
                    {l.minute}&apos;
                  </span>
                  <span aria-hidden="true" className={iconClass(l)}>
                    {ICONS[l.kind]}
                  </span>
                  <span>
                    {l.side && (
                      <span
                        className={`mr-1.5 inline-block h-2 w-2 rounded-full ${l.side === "home" ? "bg-sky-500" : "bg-rose-500"}`}
                        title={teams[l.side]}
                      />
                    )}
                    {l.text}
                  </span>
                  <span className="tabular-nums text-zinc-500">
                    {l.kind === "goal" || l.kind === "period"
                      ? `${l.score.home}–${l.score.away}`
                      : ""}
                  </span>
                </li>
              ))}
            </ol>
            <p className="text-xs text-zinc-500">
              The match is played again from its seed with the same teams and
              settings, so the replay always matches the result.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function iconClass(l: PlayLine): string {
  if (l.kind === "card")
    return l.text.includes("sent off") ? "text-red-600" : "text-amber-500";
  if (l.kind === "injury") return "text-red-600";
  return "";
}

type View = "both" | Side;

function PitchPanel({
  teams,
  influence,
}: {
  teams: Record<Side, string>;
  influence: Record<Side, number[][]>;
}) {
  const [view, setView] = useState<View>("both");
  const options: [View, string][] = [
    ["both", "Both"],
    ["home", teams.home],
    ["away", teams.away],
  ];
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xl font-semibold">Heatmap</h2>
      <fieldset className="flex flex-wrap gap-1 text-xs">
        <legend className="sr-only">Show influence for</legend>
        {options.map(([v, label]) => (
          <label
            key={v}
            className={`cursor-pointer truncate rounded-full border px-2.5 py-1 ${view === v ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900" : "border-zinc-300 dark:border-zinc-700"}`}
          >
            <input
              type="radio"
              name="heat-view"
              value={v}
              checked={view === v}
              onChange={() => setView(v)}
              className="sr-only"
            />
            {label}
          </label>
        ))}
      </fieldset>
      <MatchHeatmap
        influence={influence}
        view={view}
        label={
          view === "both"
            ? `Where each team had influence: ${teams.home} in blue, ${teams.away} in red`
            : `Where ${teams[view]} had influence`
        }
      />
      <div className="flex flex-col gap-0.5 text-xs text-zinc-600 dark:text-zinc-400">
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-sky-500" />
          {teams.home} attacks up ↑
        </span>
        <span>
          <span className="mr-1 inline-block h-2 w-2 rounded-full bg-rose-500" />
          {teams.away} attacks down ↓
        </span>
        <span className="max-w-60">
          Average over the whole match, from everyone who played.
          {view === "both" && " Brighter means more influence there."}
        </span>
      </div>
    </div>
  );
}

const ROWS = 25;
const COLS = 17;
const CELL = 14;
const HOME = [14, 165, 233] as const; // sky-500
const AWAY = [244, 63, 94] as const; // rose-500

/** Both teams' influence on one pitch, the home team attacking upward. */
function MatchHeatmap({
  influence,
  view,
  label,
}: {
  influence: Record<Side, number[][]>;
  view: View;
  label: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const ctx = ref.current?.getContext("2d");
    if (!ctx) return;
    const w = COLS * CELL;
    const h = ROWS * CELL;
    ctx.fillStyle = "#14532d";
    ctx.fillRect(0, 0, w, h);
    const at = (side: Side, r: number, c: number) =>
      influence[side][r]?.[c] ?? 0;
    const sides: Side[] = view === "both" ? ["home", "away"] : [view];
    // Shaded from the quietest cell to the busiest few (not the single
    // busiest), so the keepers' boxes don't wash everything else out.
    const totals: number[] = [];
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        totals.push(sides.reduce((a, s) => a + at(s, r, c), 0));
    totals.sort((a, b) => a - b);
    const low = totals[0] ?? 0;
    const high = Math.max(
      low + 1e-9,
      totals[Math.floor(totals.length * 0.98)] ?? 0,
    );
    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++) {
        const home = sides.includes("home") ? at("home", r, c) : 0;
        const away = sides.includes("away") ? at("away", r, c) : 0;
        const total = home + away;
        if (total <= 0) continue;
        const level = Math.min(1, (total - low) / (high - low));
        // Colour by who controls the cell, brightness by how much happens there.
        const share = home / total;
        const rgb = HOME.map((v, i) =>
          Math.round(v * share + (AWAY[i] as number) * (1 - share)),
        );
        ctx.fillStyle = `rgba(${rgb.join(",")}, ${0.12 + level * 0.83})`;
        // Row 0 is the home goal, drawn at the bottom.
        ctx.fillRect(c * CELL, (ROWS - 1 - r) * CELL, CELL, CELL);
      }
    // Pitch markings.
    ctx.strokeStyle = "rgba(255,255,255,0.55)";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(1, 1, w - 2, h - 2);
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, w * 0.13, 0, Math.PI * 2);
    ctx.stroke();
    const boxW = w * 0.6;
    const boxH = h * 0.16;
    ctx.strokeRect((w - boxW) / 2, 1, boxW, boxH);
    ctx.strokeRect((w - boxW) / 2, h - 1 - boxH, boxW, boxH);
  }, [influence, view]);
  return (
    <canvas
      ref={ref}
      width={COLS * CELL}
      height={ROWS * CELL}
      role="img"
      aria-label={label}
      className="w-full max-w-[238px] rounded-md"
    />
  );
}
