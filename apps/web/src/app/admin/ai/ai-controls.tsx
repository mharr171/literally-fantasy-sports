"use client";

import { useState, useTransition } from "react";
import type { AiSettings } from "@/lib/ai-clubs";
import { type AiResult, addClubs, runTurn, saveSettings } from "./actions";

const button =
  "rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";
const input =
  "w-24 rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700";
const card =
  "flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800";

export function AiControls({
  settings,
  clubs,
}: {
  settings: AiSettings;
  clubs: number;
}) {
  const [enabled, setEnabled] = useState(settings.enabled);
  const [poolSize, setPoolSize] = useState(settings.poolSize);
  const [runsPerDay, setRunsPerDay] = useState(settings.runsPerDay);
  const [add, setAdd] = useState(5);
  const [weeks, setWeeks] = useState(2);
  const [result, setResult] = useState<AiResult | null>(null);
  // Clubs that already had a free turn since the admin started clicking (D160).
  const [done, setDone] = useState<string[]>([]);
  const [pending, start] = useTransition();
  const run = (action: () => Promise<AiResult>) =>
    start(async () => {
      setResult(null);
      setResult(await action());
    });

  return (
    <div className="grid gap-4 md:grid-cols-3">
      <div className={card}>
        <h2 className="font-semibold">Settings</h2>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => setEnabled(e.target.checked)}
          />
          Scheduled runs play AI clubs
        </label>
        <label className="flex items-center justify-between gap-2">
          Clubs to keep
          <input
            type="number"
            min={0}
            max={1000}
            value={poolSize}
            onChange={(e) => setPoolSize(Number(e.target.value))}
            className={input}
          />
        </label>
        <label className="flex items-center justify-between gap-2">
          Runs a day
          <input
            type="number"
            min={1}
            max={48}
            value={runsPerDay}
            onChange={(e) => setRunsPerDay(Number(e.target.value))}
            className={input}
          />
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            run(() => saveSettings({ enabled, poolSize, runsPerDay }))
          }
          className={button}
        >
          Save
        </button>
        <p className="text-xs text-zinc-500">
          When on, a run every 2 hours (GitHub Actions) adds clubs up to the
          pool size, a few dozen at a time, and gives every club its turn at its
          pace. Off: nothing plays on its own.
        </p>
      </div>
      <div className={card}>
        <h2 className="font-semibold">Add clubs now</h2>
        <label className="flex items-center justify-between gap-2">
          How many (1–10)
          <input
            type="number"
            min={1}
            max={10}
            value={add}
            onChange={(e) => setAdd(Number(e.target.value))}
            className={input}
          />
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() => run(() => addClubs(add))}
          className={button}
        >
          {pending ? "Working…" : `Add ${add} AI clubs`}
        </button>
        <p className="text-xs text-zinc-500">
          Each gets 22 starter packs and picks its first squad, like a new
          manager.
        </p>
      </div>
      <div className={card}>
        <h2 className="font-semibold">Run a turn now</h2>
        <label className="flex items-center justify-between gap-2">
          Weeks each (1–6)
          <input
            type="number"
            min={1}
            max={6}
            value={weeks}
            onChange={(e) => setWeeks(Number(e.target.value))}
            className={input}
          />
        </label>
        <button
          type="button"
          disabled={pending || clubs === 0}
          onClick={() =>
            run(async () => {
              const res = await runTurn(weeks, done);
              setDone(res.finished ? [] : [...done, ...res.ranIds]);
              return res;
            })
          }
          className={button}
        >
          {pending ? "Working…" : "Run every AI club"}
        </button>
        <p className="text-xs text-zinc-500">
          For testing: clubs play these weeks now without using their energy
          (the scheduled runs every 2 hours do use it). A click runs for up to
          40 seconds; with many clubs, click again to carry on with the rest.
        </p>
      </div>
      {result && (
        <p
          role={result.ok ? "status" : "alert"}
          className={`text-sm md:col-span-3 ${result.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
        >
          {result.ok ? result.message : result.error}
        </p>
      )}
    </div>
  );
}
