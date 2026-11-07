"use client";

import type { BaseballMatch } from "@lfs/game/baseball-match";
import { useMemo, useState } from "react";

type Event = BaseballMatch["events"][number];

const button =
  "rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 disabled:opacity-30 dark:border-zinc-700 dark:hover:bg-zinc-900";

const innings = (outs: number) => `${Math.floor(outs / 3)}.${outs % 3}`;

/** The diamond: bases with runners, outs and the count. */
function Diamond({
  bases,
  outs,
  balls,
  strikes,
}: {
  bases: readonly (string | null)[];
  outs: number;
  balls: number;
  strikes: number;
}) {
  const base = (x: number, y: number, on: boolean, label: string) => (
    <rect
      x={x - 9}
      y={y - 9}
      width={18}
      height={18}
      transform={`rotate(45 ${x} ${y})`}
      className={
        on
          ? "fill-amber-400 stroke-amber-600"
          : "fill-white stroke-zinc-400 dark:fill-zinc-900"
      }
      strokeWidth={2}
    >
      <title>{label}</title>
    </rect>
  );
  const dots = (n: number, of: number, color: string) =>
    Array.from({ length: of }, (_, i) => (
      <span
        // biome-ignore lint/suspicious/noArrayIndexKey: fixed dots
        key={i}
        className={`inline-block h-2.5 w-2.5 rounded-full ${i < n ? color : "bg-zinc-200 dark:bg-zinc-700"}`}
      />
    ));
  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 120 110" className="h-28 w-32" role="img">
        <title>Runners on base</title>
        <path
          d="M60 95 L100 55 L60 15 L20 55 Z"
          className="fill-emerald-50 stroke-emerald-700/40 dark:fill-emerald-950/40"
          strokeWidth={2}
        />
        {base(100, 55, Boolean(bases[0]), "First")}
        {base(60, 15, Boolean(bases[1]), "Second")}
        {base(20, 55, Boolean(bases[2]), "Third")}
        <rect
          x={53}
          y={88}
          width={14}
          height={14}
          className="fill-white stroke-zinc-500 dark:fill-zinc-800"
        />
      </svg>
      <div className="flex flex-col gap-1 text-xs">
        <span className="flex items-center gap-1">
          B {dots(balls, 4, "bg-emerald-500")}
        </span>
        <span className="flex items-center gap-1">
          S {dots(strikes, 3, "bg-amber-500")}
        </span>
        <span className="flex items-center gap-1">
          O {dots(outs, 3, "bg-red-500")}
        </span>
      </div>
    </div>
  );
}

/** The home side's chance of winning, before each plate appearance. */
function WinGraph({
  points,
  at,
  homeName,
}: {
  points: number[];
  at: number;
  homeName: string;
}) {
  const w = 600;
  const h = 120;
  const x = (i: number) => (i / Math.max(1, points.length - 1)) * w;
  const y = (p: number) => h - p * h;
  const path = points
    .map(
      (p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p).toFixed(1)}`,
    )
    .join(" ");
  const now = Math.min(at, points.length - 1);
  return (
    <div className="flex flex-col gap-1">
      <h2 className="font-semibold">Win probability</h2>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-32 w-full rounded-md border border-zinc-200 dark:border-zinc-800"
        preserveAspectRatio="none"
        role="img"
      >
        <title>{`${homeName}'s chance of winning through the game`}</title>
        <line
          x1={0}
          x2={w}
          y1={h / 2}
          y2={h / 2}
          className="stroke-zinc-300 dark:stroke-zinc-700"
          strokeDasharray="4 4"
        />
        <path d={path} fill="none" className="stroke-sky-600" strokeWidth={2} />
        <circle
          cx={x(now)}
          cy={y(points[now] ?? 0.5)}
          r={4}
          className="fill-sky-600"
        />
      </svg>
      <p className="text-xs text-zinc-500">
        {homeName}: {Math.round((points[now] ?? 0.5) * 100)}% to win at this
        point.
      </p>
    </div>
  );
}

/**
 * The game, replayed (ADR 0009 §9): step through it pitch by pitch or play
 * by play on the diamond, with the line score, box score, play-by-play and
 * win probability.
 */
export function MatchViewer({ match }: { match: BaseballMatch }) {
  const { events, box, lines, names } = match;
  const last = events.length - 1;
  const [at, setAt] = useState(0);
  const name = (id: string | null | undefined) =>
    id ? (names[id] ?? "?") : "";
  const e: Event | undefined = events[at];

  // The score after each event, and where each plate appearance starts.
  const { scores, paStarts } = useMemo(() => {
    let home = 0;
    let away = 0;
    const scores: { home: number; away: number }[] = [];
    const paStarts: number[] = [];
    events.forEach((ev, i) => {
      if (ev.type === "pitch" && ev.balls === 0 && ev.strikes === 0)
        paStarts.push(i);
      if (ev.type === "play") {
        if (ev.batting === "home") home += ev.runs;
        else away += ev.runs;
      }
      scores.push({ home, away });
    });
    return { scores, paStarts };
  }, [events]);
  const paIndex = paStarts.filter((i) => i <= at).length - 1;
  const step = (by: -1 | 1, plays: boolean) => {
    let i = at + by;
    while (plays && i > 0 && i < last && (events[i] as Event).type === "pitch")
      i += by;
    setAt(Math.max(0, Math.min(last, i)));
  };

  const count =
    e?.type === "pitch"
      ? { balls: e.balls, strikes: e.strikes }
      : { balls: 0, strikes: 0 };
  const score = scores[at] ?? { home: 0, away: 0 };
  const batter = e && "batter" in e ? e.batter : null;
  const pitcher = e && "pitcher" in e ? e.pitcher : null;
  const pitchText =
    e?.type === "pitch"
      ? {
          ball: "Ball",
          called: "Called strike",
          swinging: "Swinging strike",
          foul: "Foul",
          inPlay: "In play",
        }[e.call]
      : null;

  const extra = Math.max(box.lineScore.away.length, box.lineScore.home.length);
  const inningCols = Array.from({ length: Math.max(9, extra) }, (_, i) => i);

  return (
    <div className="flex flex-col gap-5">
      <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-xs text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-2 py-1 text-left">Club</th>
              {inningCols.map((i) => (
                <th key={i} className="px-1.5 py-1 text-right">
                  {i + 1}
                </th>
              ))}
              <th className="px-2 py-1 text-right">R</th>
              <th className="px-2 py-1 text-right">H</th>
              <th className="px-2 py-1 text-right">E</th>
            </tr>
          </thead>
          <tbody>
            {(["away", "home"] as const).map((side) => (
              <tr
                key={side}
                className="border-t border-zinc-100 dark:border-zinc-800"
              >
                <td className="px-2 py-1">
                  {side === "home" ? match.homeName : match.awayName}
                </td>
                {inningCols.map((i) => (
                  <td key={i} className="px-1.5 py-1 text-right">
                    {box.lineScore[side][i] ?? (i < 9 ? "x" : "")}
                  </td>
                ))}
                <td className="px-2 py-1 text-right font-semibold">
                  {box.runs[side]}
                </td>
                <td className="px-2 py-1 text-right">{box.hits[side]}</td>
                <td className="px-2 py-1 text-right">{box.errors[side]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={button}
            disabled={at === 0}
            onClick={() => setAt(0)}
          >
            ⏮ Start
          </button>
          <button
            type="button"
            className={button}
            disabled={at === 0}
            onClick={() => step(-1, true)}
          >
            ◀ Play
          </button>
          <button
            type="button"
            className={button}
            disabled={at === 0}
            onClick={() => step(-1, false)}
          >
            ◀ Pitch
          </button>
          <button
            type="button"
            className={button}
            disabled={at === last}
            onClick={() => step(1, false)}
          >
            Pitch ▶
          </button>
          <button
            type="button"
            className={button}
            disabled={at === last}
            onClick={() => step(1, true)}
          >
            Play ▶
          </button>
          <button
            type="button"
            className={button}
            disabled={at === last}
            onClick={() => setAt(last)}
          >
            End ⏭
          </button>
          <span className="ml-auto text-xs text-zinc-500">
            {at + 1} / {events.length}
          </span>
        </div>
        {e && (
          <div className="flex flex-wrap items-center gap-6">
            <Diamond bases={e.bases} outs={e.outs} {...count} />
            <div className="flex flex-col gap-1 text-sm">
              <p className="font-medium">
                {e.batting === "away" ? "Top" : "Bottom"} {e.inning} ·{" "}
                {match.awayName} {score.away}, {match.homeName} {score.home}
              </p>
              {batter && (
                <p>
                  At bat: <strong>{name(batter)}</strong>
                  {pitcher && (
                    <>
                      {" "}
                      · Pitching: <strong>{name(pitcher)}</strong>
                    </>
                  )}
                </p>
              )}
              <p className="text-zinc-600 dark:text-zinc-400">
                {pitchText ?? lines[at] ?? ""}
              </p>
            </div>
          </div>
        )}
      </div>

      <WinGraph
        points={match.winProbability}
        at={Math.max(0, paIndex)}
        homeName={match.homeName}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        {(["away", "home"] as const).map((side) => (
          <div key={side} className="flex flex-col gap-2">
            <h2 className="font-semibold">
              {side === "home" ? match.homeName : match.awayName}
            </h2>
            <table className="w-full text-sm">
              <thead className="text-xs text-zinc-500">
                <tr>
                  <th className="text-left">Batter</th>
                  <th className="text-right">AB</th>
                  <th className="text-right">R</th>
                  <th className="text-right">H</th>
                  <th className="text-right">HR</th>
                  <th className="text-right">RBI</th>
                  <th className="text-right">BB</th>
                  <th className="text-right">K</th>
                </tr>
              </thead>
              <tbody>
                {box.batters[side].map((b) => (
                  <tr
                    key={b.id}
                    className="border-t border-zinc-100 dark:border-zinc-800"
                  >
                    <td>{name(b.id)}</td>
                    <td className="text-right">{b.ab}</td>
                    <td className="text-right">{b.r}</td>
                    <td className="text-right">{b.h}</td>
                    <td className="text-right">{b.hr}</td>
                    <td className="text-right">{b.rbi}</td>
                    <td className="text-right">{b.bb}</td>
                    <td className="text-right">{b.k}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <table className="w-full text-sm">
              <thead className="text-xs text-zinc-500">
                <tr>
                  <th className="text-left">Pitcher</th>
                  <th className="text-right">IP</th>
                  <th className="text-right">H</th>
                  <th className="text-right">R</th>
                  <th className="text-right">ER</th>
                  <th className="text-right">BB</th>
                  <th className="text-right">K</th>
                  <th className="text-right">P</th>
                </tr>
              </thead>
              <tbody>
                {box.pitchers[side].map((p) => (
                  <tr
                    key={p.id}
                    className="border-t border-zinc-100 dark:border-zinc-800"
                  >
                    <td>
                      {name(p.id)}
                      {box.decisions.win === p.id && " (W)"}
                      {box.decisions.loss === p.id && " (L)"}
                      {box.decisions.save === p.id && " (S)"}
                    </td>
                    <td className="text-right">{innings(p.outs)}</td>
                    <td className="text-right">{p.h}</td>
                    <td className="text-right">{p.r}</td>
                    <td className="text-right">{p.er}</td>
                    <td className="text-right">{p.bb}</td>
                    <td className="text-right">{p.k}</td>
                    <td className="text-right">{p.pitches}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-semibold">Play-by-play</h2>
        <ol className="flex flex-col gap-0.5 text-sm">
          {events.map((ev, i) => {
            const text = lines[i];
            if (!text) return null;
            const first =
              events.findIndex(
                (x) => x.inning === ev.inning && x.batting === ev.batting,
              ) === i ||
              lines.findIndex(
                (l, j) =>
                  l &&
                  events[j]?.inning === ev.inning &&
                  events[j]?.batting === ev.batting,
              ) === i;
            return (
              <li key={`${i}-${ev.type}`} className="flex flex-col">
                {first && (
                  <span className="mt-2 text-xs font-semibold uppercase text-zinc-500">
                    {ev.batting === "away" ? "Top" : "Bottom"} {ev.inning}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => setAt(i)}
                  className={`rounded px-1 text-left hover:bg-zinc-100 dark:hover:bg-zinc-900 ${i === at ? "bg-sky-50 dark:bg-sky-950/40" : ""}`}
                >
                  {text}
                </button>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
