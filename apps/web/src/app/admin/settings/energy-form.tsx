"use client";

import type { EnergySettings, SportId } from "@lfs/core";
import { useState, useTransition } from "react";
import { saveEnergySettings } from "./actions";

/** One sport's energy switches (D93). */
export function EnergyForm({
  sport,
  initial,
}: {
  sport: SportId;
  initial: EnergySettings;
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [refillMinutes, setRefill] = useState(initial.refillMinutes);
  const [max, setMax] = useState(initial.max);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  const input =
    "w-20 rounded-md border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700";

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await saveEnergySettings({
            sport,
            enabled,
            refillMinutes,
            max,
          });
          setMessage(
            result.ok
              ? {
                  ok: true,
                  text: "Saved. It applies to every manager straight away.",
                }
              : { ok: false, text: result.error },
          );
        });
      }}
      className="flex flex-wrap items-end gap-4 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800"
    >
      <span className="w-full font-semibold capitalize">{sport}</span>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
        />
        Matches need energy
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-zinc-600 dark:text-zinc-400">
          Minutes per point
        </span>
        <input
          type="number"
          min={1}
          max={1440}
          value={refillMinutes}
          onChange={(e) => setRefill(Number(e.target.value))}
          className={input}
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-zinc-600 dark:text-zinc-400">Maximum</span>
        <input
          type="number"
          min={1}
          max={20}
          value={max}
          onChange={(e) => setMax(Number(e.target.value))}
          className={input}
        />
      </label>
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
