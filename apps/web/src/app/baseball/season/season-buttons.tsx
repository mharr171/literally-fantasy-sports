"use client";

import type { ScoutedBaseballPlayer } from "@lfs/game/sports/baseball-players";
import { useState, useTransition } from "react";
import {
  type ActionResult,
  endBaseballSeason,
  playBaseballWeekAction,
  startBaseballSeason,
  takeBaseballYouth,
} from "./actions";

const button =
  "rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

const ACTIONS = {
  start: startBaseballSeason,
  play: playBaseballWeekAction,
  end: endBaseballSeason,
} as const;

/** One season step: start, play the week, or wrap up. */
export function SeasonButton({
  action,
  label,
}: {
  action: keyof typeof ACTIONS;
  label: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        disabled={pending}
        className={`${button} self-start`}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r: ActionResult = await ACTIONS[action]();
            if (!r.ok) setError(r.error);
          })
        }
      >
        {pending ? "Working…" : label}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

/** The youth intake (D53): tick any prospects to take them for free. */
export function YouthIntake({
  prospects,
}: {
  prospects: ScoutedBaseballPlayer[];
}) {
  const [picks, setPicks] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const toggle = (i: number) =>
    setPicks((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]));
  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Take</th>
              <th className="px-3 py-2">Prospect</th>
              <th className="px-3 py-2">Pos</th>
              <th className="px-3 py-2">B/T</th>
              <th className="px-3 py-2 text-right">Age</th>
              <th className="px-3 py-2 text-right">OVR</th>
              <th className="px-3 py-2 text-right">Potential</th>
            </tr>
          </thead>
          <tbody>
            {prospects.map((p, i) => (
              <tr
                key={`${p.displayName}-${p.age}-${p.overall}-${p.primaryPosition}`}
                className="border-t border-zinc-100 dark:border-zinc-800"
              >
                <td className="px-3 py-1.5">
                  <input
                    type="checkbox"
                    checked={picks.includes(i)}
                    onChange={() => toggle(i)}
                    aria-label={`Take ${p.displayName}`}
                  />
                </td>
                <td className="px-3 py-1.5">{p.displayName}</td>
                <td className="px-3 py-1.5">
                  {p.primaryPosition === "P"
                    ? p.pitcherRole === "reliever"
                      ? "RP"
                      : "SP"
                    : p.primaryPosition}
                </td>
                <td className="px-3 py-1.5">
                  {p.bats}/{p.throws}
                </td>
                <td className="px-3 py-1.5 text-right">{p.age}</td>
                <td className="px-3 py-1.5 text-right">{p.overall}</td>
                <td className="px-3 py-1.5 text-right">
                  {p.potentialRange[0]}–{p.potentialRange[1]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button
        type="button"
        disabled={pending}
        className={`${button} self-start`}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await takeBaseballYouth(picks);
            if (!r.ok) setError(r.error);
          })
        }
      >
        {pending
          ? "Working…"
          : picks.length === 0
            ? "Take nobody"
            : `Take ${picks.length} prospect${picks.length === 1 ? "" : "s"}`}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
