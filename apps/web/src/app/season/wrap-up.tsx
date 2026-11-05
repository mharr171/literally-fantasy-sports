"use client";

import { ROSTER_MAX } from "@lfs/sport-soccer";
import { useState } from "react";
import { PlayerCard } from "@/components/player/player-card";
import type { ScoutedPlayer } from "@/lib/scouting";
import { useAction } from "../team/use-action";
import { endSeason, takeYouth } from "./actions";

const primary =
  "rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

export function EndSeasonButton() {
  const { error, pending, run } = useAction();
  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(endSeason)}
        className={primary}
      >
        {pending ? "Wrapping up…" : "End the season"}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

/** Youth intake (D53): take any number of the 22 prospects, free. */
export function YouthIntake({
  prospects,
  rosterSize,
  rosterMax = ROSTER_MAX,
}: {
  prospects: ScoutedPlayer[];
  rosterSize: number;
  /** The sport's maximum roster (D182). */
  rosterMax?: number;
}) {
  const [taken, setTaken] = useState<number[]>([]);
  const { error, pending, run } = useAction();
  const toggle = (i: number) =>
    setTaken((t) => (t.includes(i) ? t.filter((x) => x !== i) : [...t, i]));
  const after = rosterSize + taken.length;

  return (
    <fieldset className="flex flex-col gap-3 rounded-md border-2 border-zinc-900 p-3 dark:border-zinc-100">
      <legend className="px-1 font-semibold">Youth intake</legend>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        22 academy prospects, aged 16–18. Take as many as you like for free;
        anyone you leave goes elsewhere. Young players grow toward their
        potential each season.
      </p>
      <ul className="grid gap-x-4 sm:grid-cols-2">
        {prospects.map((p, i) => {
          const id = `prospect-${i}`;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: prospects never change order
            <li key={i}>
              <label
                htmlFor={id}
                className="grid cursor-pointer grid-cols-[auto_3rem_1fr_auto] items-center gap-2 rounded px-1 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={taken.includes(i)}
                  onChange={() => toggle(i)}
                />
                <span className="font-medium">{p.primaryPosition}</span>
                <span className="truncate">
                  <PlayerCard player={p} />{" "}
                  <span className="text-xs text-zinc-500">
                    {p.nationality} · {p.age}
                  </span>
                </span>
                <span className="text-right tabular-nums">
                  <strong>{p.overall}</strong>
                  <span className="text-xs text-zinc-500">
                    {" "}
                    pot {p.potentialRange[0]}–{p.potentialRange[1]}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {after > rosterMax && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          That takes you to {after} players: release or sell down to {rosterMax}{" "}
          before your next match.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => run(() => takeYouth(taken))}
        className={`self-start ${primary}`}
      >
        {pending
          ? "Signing…"
          : taken.length === 0
            ? "Take nobody this year"
            : `Take ${taken.length} prospect${taken.length === 1 ? "" : "s"}`}
      </button>
    </fieldset>
  );
}
