"use client";

import { useAction } from "../team/use-action";
import { playNextWeek, startSeason } from "./actions";

const primary =
  "rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300";

export function StartSeasonButton({ number }: { number: number }) {
  const { error, pending, run } = useAction();
  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(startSeason)}
        className={primary}
      >
        {pending ? "Building your league…" : `Start season ${number}`}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

export function PlayWeekButton({ label }: { label: string }) {
  const { error, pending, run } = useAction();
  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => run(playNextWeek)}
        className={primary}
      >
        {pending ? "Playing…" : label}
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
