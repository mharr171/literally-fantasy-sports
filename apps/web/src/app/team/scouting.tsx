"use client";

import {
  DEFAULT_ROSTER_LIMITS,
  type PackFocus,
  type RosterLimits,
} from "@lfs/sport-soccer";
import { useMemo, useState, useTransition } from "react";
import { type ScoutRow, ScoutTable } from "@/components/scout-table";
import { countByLine, FOCUS_LABELS, type ScoutedPlayer } from "@/lib/scouting";
import { confirmStarterSquad, openPacks } from "./actions";

export interface ScoutingPack {
  id: string;
  focus: PackFocus;
  /** Null while the pack is still sealed. */
  players: ScoutedPlayer[] | null;
}

type Selection = Record<string, number[]>;

const LINE_LABELS = {
  goal: "GK",
  defence: "DEF",
  midfield: "MID",
  attack: "ATT",
} as const;

/**
 * Initial scouting (D83): open all 22 starter packs, tick the players to
 * keep and confirm. Only the ticks are sent to the server.
 */
export function Scouting({
  packs,
  limits = DEFAULT_ROSTER_LIMITS,
}: {
  packs: ScoutingPack[];
  /** The sport's roster limits (D182). */
  limits?: RosterLimits;
}) {
  const ROSTER_MIN = limits.min;
  const ROSTER_MAX = limits.max;
  const [selection, setSelection] = useState<Selection>({});
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sealed = packs.filter((p) => !p.players).map((p) => p.id);
  const kept = useMemo(
    () =>
      packs.flatMap((pack) =>
        (selection[pack.id] ?? []).flatMap((i) => pack.players?.[i] ?? []),
      ),
    [packs, selection],
  );
  // Every opened player in one table (D108), labelled with their pack.
  const rows: ScoutRow[] = packs.flatMap((pack, n) =>
    (pack.players ?? []).map((player, i) => ({
      key: `${pack.id}:${i}`,
      player,
      ticked: (selection[pack.id] ?? []).includes(i),
      pack: `${n + 1} · ${FOCUS_LABELS[pack.focus]}`,
    })),
  );
  const lines = countByLine(kept);
  const countOk = kept.length >= ROSTER_MIN && kept.length <= ROSTER_MAX;
  const canConfirm = sealed.length === 0 && countOk && !pending;

  const run = (action: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });

  const toggle = (packId: string, index: number) =>
    setSelection((s) => {
      const current = s[packId] ?? [];
      return {
        ...s,
        [packId]: current.includes(index)
          ? current.filter((i) => i !== index)
          : [...current, index],
      };
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">Scout your first squad</h2>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Open all 22 starter packs, then tick the {ROSTER_MIN} to {ROSTER_MAX}{" "}
          players you want to keep. Every opened player is in one table: filter
          by position or chemistry colour and click a column to sort. Anyone you
          don&apos;t keep is released for free. Potential is a scout&apos;s
          estimate: the true value lies somewhere in the range.
        </p>
      </div>

      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-zinc-200 bg-white/95 p-3 text-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <span>
          Opened{" "}
          <strong>
            {packs.length - sealed.length}/{packs.length}
          </strong>
        </span>
        <span className={countOk ? "" : "text-amber-700 dark:text-amber-400"}>
          Kept <strong>{kept.length}</strong> ({ROSTER_MIN}–{ROSTER_MAX})
        </span>
        <span className="text-zinc-600 dark:text-zinc-400">
          {(Object.keys(LINE_LABELS) as (keyof typeof LINE_LABELS)[])
            .map((l) => `${LINE_LABELS[l]} ${lines[l]}`)
            .join(" · ")}
        </span>
        <span className="flex-1" />
        {sealed.length > 0 && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => openPacks(sealed))}
            className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Open all {sealed.length}
          </button>
        )}
        <button
          type="button"
          disabled={!canConfirm}
          onClick={() => run(() => confirmStarterSquad(selection))}
          className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Working…" : `Keep ${kept.length} players`}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {lines.goal === 0 && kept.length > 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          You haven&apos;t kept a goalkeeper yet.
        </p>
      )}

      {sealed.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {packs.map((pack, n) =>
            pack.players ? null : (
              <button
                key={pack.id}
                type="button"
                disabled={pending}
                onClick={() => run(() => openPacks([pack.id]))}
                className="rounded-md border border-dashed border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Open pack {n + 1} · {FOCUS_LABELS[pack.focus]}
              </button>
            ),
          )}
        </div>
      )}

      {rows.length > 0 && (
        <ScoutTable
          rows={rows}
          onToggle={(key) => {
            const [packId, index] = key.split(":");
            toggle(packId as string, Number(index));
          }}
        />
      )}
    </div>
  );
}
