"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAction } from "../team/use-action";
import { playNextWeek, setSkipIdleWeeks, startSeason } from "./actions";

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

/** Energy as the page shows it: points now, the maximum, and when the next one comes. */
export interface EnergyView {
  energy: number;
  max: number;
  /** ISO time of the next point, or null when full. */
  nextAt: string | null;
}

function useCountdown(target: string | null): number | null {
  const [left, setLeft] = useState<number | null>(() =>
    target ? Math.max(0, Date.parse(target) - Date.now()) : null,
  );
  useEffect(() => {
    if (!target) {
      setLeft(null);
      return;
    }
    const tick = () => setLeft(Math.max(0, Date.parse(target) - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [target]);
  return left;
}

const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

export function PlayWeekButton({
  label,
  energy,
  free = false,
}: {
  label: string;
  /** Null when energy is switched off for this sport. */
  energy: EnergyView | null;
  /** A week without the club's own match: costs no energy (D134). */
  free?: boolean;
}) {
  const { error, pending, run } = useAction();
  const router = useRouter();
  const left = useCountdown(energy?.nextAt ?? null);
  // When the next point arrives, reload so the server's count shows.
  useEffect(() => {
    if (left === 0) router.refresh();
  }, [left, router]);
  const empty = !free && energy !== null && energy.energy < 1;
  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      <button
        type="button"
        disabled={pending || empty}
        onClick={() => run(playNextWeek)}
        className={primary}
      >
        {pending ? "Playing…" : label}
      </button>
      {energy && (
        <p className="text-xs text-zinc-600 dark:text-zinc-400">
          <span aria-hidden="true">
            {"⚡".repeat(energy.energy)}
            <span className="opacity-30">
              {"⚡".repeat(Math.max(0, energy.max - energy.energy))}
            </span>
          </span>{" "}
          Energy {energy.energy}/{energy.max}
          {left !== null && left > 0 && ` · next in ${clock(left)}`}
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}

/** The setting to play weeks without your own match by themselves (D134). */
export function SkipIdleToggle({ on }: { on: boolean }) {
  const { error, pending, run } = useAction();
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={on}
          disabled={pending}
          onChange={(e) => {
            const next = e.target.checked;
            run(() => setSkipIdleWeeks(next));
          }}
        />
        Skip weeks without my match (they play by themselves, and the squad
        rests)
      </label>
      {error && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
