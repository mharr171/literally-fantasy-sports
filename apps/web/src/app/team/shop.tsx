"use client";

import {
  BOUGHT_TIERS,
  PACK_FOCUSES,
  type PackFocus,
  type PackPrices,
  packPrice,
  shiftedTier,
} from "@lfs/sport-soccer";
import { useState } from "react";
import { ChemistryDot } from "@/components/player/player-card";
import { CHEMISTRY_COLORS } from "@/lib/chemistry-colors";
import { FOCUS_LABELS } from "@/lib/scouting";
import { buyPack } from "./actions";
import { useAction } from "./use-action";

const money = (n: number) => n.toLocaleString("en-US");

const pct = (x: number) => `${Math.round(x * 100)}%`;

/**
 * Packs for sale with their published odds (D47), moved for the club's Elo
 * (D179), and an option to leave out up to 3 chemistry colors (D180).
 */
export function Shop({
  funds,
  hasOpenPack,
  prices,
  eloShift,
}: {
  funds: number;
  hasOpenPack: boolean;
  /** Today's prices, from the live settings version. */
  prices: PackPrices;
  /** How many overall points the odds move for the club's Elo now. */
  eloShift: number;
}) {
  const [focus, setFocus] = useState<PackFocus>("any");
  const [excluded, setExcluded] = useState<number[]>([]);
  const { error, pending, run } = useAction();
  const toggle = (c: number) =>
    setExcluded((xs) =>
      xs.includes(c)
        ? xs.filter((x) => x !== c)
        : xs.length < 3
          ? [...xs, c].sort()
          : xs,
    );
  const surcharges = [
    prices.excludeOne ?? 0.25,
    prices.excludeTwo ?? 0.6,
    prices.excludeThree ?? 1.2,
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-semibold">Buy a pack</h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            5 players per pack. Keep the ones you want; the rest sell for 25% of
            their worth. Focused packs cost{" "}
            {Math.round(prices.focusSurcharge * 100)}% more.
          </p>
          {eloShift !== 0 && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Odds and prices follow your club&apos;s Elo: every rating below is{" "}
              {Math.abs(eloShift)} {eloShift > 0 ? "higher" : "lower"} than at
              the starting Elo of 1500.
            </p>
          )}
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
      <fieldset className="flex flex-col gap-1 text-sm">
        <legend className="font-medium">Leave out colors (optional)</legend>
        <p className="text-zinc-600 dark:text-zinc-400">
          Players come only in the colors you keep. Leaving out 1, 2 or 3 colors
          costs {surcharges.map(pct).join(", ")} more.
        </p>
        <div className="flex flex-wrap gap-2">
          {CHEMISTRY_COLORS.map((c, i) => {
            const off = excluded.includes(i);
            return (
              <button
                key={c.name}
                type="button"
                aria-pressed={off}
                disabled={!off && excluded.length >= 3}
                onClick={() => toggle(i)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 disabled:opacity-40 ${
                  off
                    ? "border-zinc-900 line-through opacity-60 dark:border-zinc-100"
                    : "border-zinc-300 dark:border-zinc-700"
                }`}
              >
                <ChemistryDot color={i} /> {c.name}
                <span className="sr-only">{off ? " (left out)" : ""}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
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
        {BOUGHT_TIERS.map((base) => {
          const tier = shiftedTier(base, eloShift);
          const price = packPrice(tier.id, focus, prices, {
            eloShift,
            excludedColors: excluded,
          });
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
              {tier.blurb && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  {tier.blurb}
                </p>
              )}
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
                onClick={() =>
                  run(() => buyPack({ tier: tier.id, focus, excluded }))
                }
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
