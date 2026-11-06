"use client";

import { openRewardPack } from "./actions";
import { useAction } from "./use-action";

const TIER_NAMES: Record<string, string> = {
  basic: "Basic",
  silver: "Silver",
  gold: "Gold",
};

/** Reward packs from the playoffs waiting to be opened (D181). */
export function RewardPacks({
  packs,
  hasOpenPack,
}: {
  packs: { id: string; tier: string }[];
  hasOpenPack: boolean;
}) {
  const { error, pending, run } = useAction();
  if (packs.length === 0) return null;
  return (
    <div className="flex flex-col gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
      <h2 className="font-semibold">
        Reward {packs.length === 1 ? "pack" : "packs"} from the playoffs
      </h2>
      <p className="text-zinc-700 dark:text-zinc-300">
        Free for how far you went. Open one, then keep or sell its players like
        any other pack.
        {hasOpenPack && " Sort your open pack first."}
      </p>
      {error && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <ul className="flex flex-wrap gap-2">
        {packs.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              disabled={pending || hasOpenPack}
              onClick={() => run(() => openRewardPack({ packId: p.id }))}
              className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
            >
              Open {TIER_NAMES[p.tier] ?? p.tier} pack
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
