"use client";

import { resalePrice } from "@lfs/core";
import { ROSTER_MIN } from "@lfs/sport-soccer";
import type { RosterPlayer } from "@/lib/team";
import { removePlayer } from "./actions";
import { useAction } from "./use-action";

const money = (n: number) => n.toLocaleString("en-US");

/** The roster, with free release and bulk resale (D49, D54). */
export function RosterTable({ players }: { players: RosterPlayer[] }) {
  const { error, pending, run } = useAction();
  const canRemove = players.length > ROSTER_MIN;

  const remove = (p: RosterPlayer, mode: "release" | "sell") => {
    const question =
      mode === "sell"
        ? `Sell ${p.displayName} for ${money(resalePrice(p.worth))}? This can't be undone.`
        : `Release ${p.displayName} for free? This can't be undone.`;
    if (window.confirm(question))
      run(() => removePlayer({ playerId: p.id, mode }));
  };

  const button =
    "rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-900";

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[42rem] text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Pos</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2">Nat</th>
              <th className="px-3 py-2 text-right">Age</th>
              <th className="px-3 py-2 text-right">Overall</th>
              <th className="px-3 py-2 text-right">Potential</th>
              <th className="px-3 py-2 text-right">Worth</th>
              <th className="px-3 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {players.map((p) => (
              <tr
                key={p.id}
                className="border-t border-zinc-200 dark:border-zinc-800"
              >
                <td className="px-3 py-2 font-medium">
                  {p.primaryPosition}
                  {p.secondaryPosition && (
                    <span className="text-zinc-500">
                      {" "}
                      / {p.secondaryPosition}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2">{p.displayName}</td>
                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                  {p.nationality}
                </td>
                <td className="px-3 py-2 text-right">{p.age}</td>
                <td className="px-3 py-2 text-right font-semibold">
                  {p.overall}
                </td>
                <td className="px-3 py-2 text-right">
                  {p.potentialRange[0]}–{p.potentialRange[1]}
                </td>
                <td className="px-3 py-2 text-right">{money(p.worth)}</td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1">
                    {!p.fromStarterPack && (
                      <button
                        type="button"
                        disabled={pending || !canRemove}
                        onClick={() => remove(p, "sell")}
                        className={button}
                      >
                        Sell {money(resalePrice(p.worth))}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={pending || !canRemove}
                      onClick={() => remove(p, "release")}
                      className={button}
                    >
                      Release
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
