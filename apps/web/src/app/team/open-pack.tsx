"use client";

import { resalePrice } from "@lfs/core";
import { useState } from "react";
import { ScoutTable } from "@/components/scout-table";
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
      <ScoutTable
        rows={players.map((player, i) => ({
          key: String(i),
          player,
          ticked: kept.includes(i),
          note: kept.includes(i)
            ? "keep"
            : `sell ${money(resalePrice(player.worth))}`,
        }))}
        onToggle={(key) => toggle(Number(key))}
      />
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
