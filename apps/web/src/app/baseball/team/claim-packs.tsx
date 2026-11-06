"use client";

import { useState, useTransition } from "react";
import { claimStarterPacks } from "./actions";

/** For a club made before baseball had packs: get its 16 starter packs. */
export function ClaimPacks() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  return (
    <div className="flex flex-col gap-2 rounded-md border border-zinc-200 p-4 text-sm dark:border-zinc-800">
      <p>
        Your club was made before baseball had players. Get its 16 starter packs
        to scout your first squad.
      </p>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setError(null);
            const r = await claimStarterPacks();
            if (!r.ok) setError(r.error);
          })
        }
        className="self-start rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Working…" : "Get starter packs"}
      </button>
      {error && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
