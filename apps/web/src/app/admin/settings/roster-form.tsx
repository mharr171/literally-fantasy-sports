"use client";

import type { SportId } from "@lfs/core";
import { ROSTER_LIMIT_BOUNDS, type RosterLimits } from "@lfs/sport-soccer";
import { useState, useTransition } from "react";
import { saveRosterLimits } from "./actions";

/** One sport's roster limits (D182). */
export function RosterForm({
  sport,
  initial,
}: {
  sport: SportId;
  initial: RosterLimits;
}) {
  const [limits, setLimits] = useState(initial);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const fields: [keyof RosterLimits, string][] = [
    ["min", "Fewest players"],
    ["max", "Most players"],
    ["benchMax", "Substitutes on the bench"],
  ];
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await saveRosterLimits({ sport, ...limits });
          setMessage(
            result.ok
              ? {
                  ok: true,
                  text: "Saved. Clubs over the most must trim before their next match.",
                }
              : { ok: false, text: result.error },
          );
        });
      }}
      className="flex flex-wrap items-end gap-4 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800"
    >
      <span className="w-full font-semibold capitalize">
        {sport} roster limits
      </span>
      {fields.map(([key, label]) => (
        <label key={key} className="flex flex-col gap-1">
          <span className="text-zinc-600 dark:text-zinc-400">
            {label} ({ROSTER_LIMIT_BOUNDS[key][0]}–{ROSTER_LIMIT_BOUNDS[key][1]}
            )
          </span>
          <input
            type="number"
            min={ROSTER_LIMIT_BOUNDS[key][0]}
            max={ROSTER_LIMIT_BOUNDS[key][1]}
            value={limits[key]}
            onChange={(e) =>
              setLimits((l) => ({ ...l, [key]: Number(e.target.value) }))
            }
            className="w-20 rounded-md border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
          />
        </label>
      ))}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={`w-full ${message.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
