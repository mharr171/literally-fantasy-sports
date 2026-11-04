"use client";

import {
  BOUGHT_TIERS,
  PACK_FOCUSES,
  type PackFocus,
  packPrice,
} from "@lfs/sport-soccer";
import { useState } from "react";
import { FOCUS_LABELS } from "@/lib/scouting";
import { buyPack } from "./actions";
import { useAction } from "./use-action";

const money = (n: number) => n.toLocaleString("en-US");

/** Packs for sale with their published odds (D47). */
export function Shop({
  funds,
  hasOpenPack,
}: {
  funds: number;
  hasOpenPack: boolean;
}) {
  const [focus, setFocus] = useState<PackFocus>("any");
  const { error, pending, run } = useAction();

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Buy a pack</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            5 players per pack. Keep the ones you want; the rest sell for 25% of
            their worth. Focused packs cost 20% more.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm">
          Positions
          <select
            value={focus}
            onChange={(e) => setFocus(e.target.value as PackFocus)}
            className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
          >
            {PACK_FOCUSES.map((f) => (
              <option key={f} value={f}>
                {f === "goal" ? "Goalkeepers" : FOCUS_LABELS[f]}
              </option>
            ))}
          </select>
        </label>
      </div>
      {hasOpenPack && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          Keep or sell the players in your open pack before buying another.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        {BOUGHT_TIERS.map((tier) => {
          const price = packPrice(tier.id, focus);
          const short = funds < price;
          return (
            <div
              key={tier.id}
              className="flex flex-col gap-3 rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
            >
              <div className="flex items-baseline justify-between">
                <h3 className="font-semibold">{tier.name}</h3>
                <span className="tabular-nums">{money(price)}</span>
              </div>
              <table className="text-sm">
                <caption className="sr-only">
                  Chance of each overall rating
                </caption>
                <tbody>
                  {tier.bands?.map((b) => (
                    <tr key={b.min}>
                      <td className="text-zinc-600 dark:text-zinc-400">
                        Overall {b.min}–{b.max}
                      </td>
                      <td className="text-right tabular-nums">{b.weight}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button
                type="button"
                disabled={pending || hasOpenPack || short}
                onClick={() => run(() => buyPack({ tier: tier.id, focus }))}
                className="mt-auto rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
              >
                {short ? "Not enough funds" : `Buy for ${money(price)}`}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
