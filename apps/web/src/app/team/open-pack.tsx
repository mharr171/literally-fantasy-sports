"use client";

import { resalePrice } from "@lfs/core";
import { useState } from "react";
import type { ScoutedPlayer } from "@/lib/scouting";
import { resolvePack } from "./actions";
import { useAction } from "./use-action";

const money = (n: number) => n.toLocaleString("en-US");

/** A bought pack: keep players or bulk-sell them (D49). */
export function OpenPack({
  packId,
  title,
  players,
  rosterSize,
}: {
  packId: string;
  title: string;
  players: ScoutedPlayer[];
  rosterSize: number;
}) {
  const [kept, setKept] = useState<number[]>([]);
  const { error, pending, run } = useAction();
  const sale = players
    .filter((_, i) => !kept.includes(i))
    .reduce((t, p) => t + resalePrice(p.worth), 0);
  const toggle = (i: number) =>
    setKept((k) => (k.includes(i) ? k.filter((x) => x !== i) : [...k, i]));

  return (
    <fieldset className="flex flex-col gap-3 rounded-md border-2 border-zinc-900 p-3 dark:border-zinc-100">
      <legend className="px-1 font-semibold">{title}</legend>
      <ul className="flex flex-col">
        {players.map((p, i) => {
          const id = `open-${i}`;
          return (
            // biome-ignore lint/suspicious/noArrayIndexKey: a pack's players never change order
            <li key={i}>
              <label
                htmlFor={id}
                className="grid cursor-pointer grid-cols-[auto_3.5rem_1fr_auto] items-center gap-2 rounded px-1 py-1 text-sm hover:bg-zinc-50 dark:hover:bg-zinc-900"
              >
                <input
                  id={id}
                  type="checkbox"
                  checked={kept.includes(i)}
                  onChange={() => toggle(i)}
                />
                <span className="font-medium">
                  {p.primaryPosition}
                  {p.secondaryPosition && (
                    <span className="text-xs text-zinc-500">
                      /{p.secondaryPosition}
                    </span>
                  )}
                </span>
                <span className="truncate">
                  {p.displayName}{" "}
                  <span className="text-xs text-zinc-500">
                    {p.nationality} · {p.age} · pot {p.potentialRange[0]}–
                    {p.potentialRange[1]}
                  </span>
                </span>
                <span className="text-right tabular-nums">
                  <strong>{p.overall}</strong>
                  <span className="text-xs text-zinc-500">
                    {" "}
                    {kept.includes(i)
                      ? "keep"
                      : `sell ${money(resalePrice(p.worth))}`}
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
      {rosterSize + kept.length > 30 && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          That takes you to {rosterSize + kept.length} players: you&apos;ll need
          to get back to 30 before your next match.
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
        onClick={() => run(() => resolvePack({ packId, kept }))}
        className="self-start rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending
          ? "Working…"
          : `Keep ${kept.length}, sell ${players.length - kept.length} for ${money(sale)}`}
      </button>
    </fieldset>
  );
}
