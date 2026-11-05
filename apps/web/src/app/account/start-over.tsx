"use client";

import { useState, useTransition } from "react";
import { resetAccount } from "./actions";

/** "Start over" (D141): type the club's name to delete it and begin again. */
export function StartOver({ clubName }: { clubName: string }) {
  const [typed, setTyped] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const matches = typed === clubName;
  return (
    <form
      className="flex flex-col gap-3 rounded-md border border-red-200 p-4 text-sm dark:border-red-900"
      onSubmit={(e) => {
        e.preventDefault();
        if (!matches) return;
        start(async () => {
          setError(null);
          const res = await resetAccount(typed);
          if (!res.ok) setError(res.error);
        });
      }}
    >
      <p>
        This deletes <strong>{clubName}</strong> and everything that belongs to
        it: every player, pack, season, season record, retired player&apos;s
        career and your ghost. It can&apos;t be undone. You keep your account
        and start again by naming a new club.
      </p>
      <label className="flex flex-col gap-1">
        <span>
          Type <strong>{clubName}</strong> to confirm
        </span>
        <input
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          autoComplete="off"
          spellCheck={false}
          className="rounded-md border border-zinc-300 bg-[var(--background)] px-2 py-1 text-[var(--foreground)] dark:border-zinc-700"
        />
      </label>
      <button
        type="submit"
        disabled={!matches || pending}
        className="self-start rounded-md bg-red-700 px-3 py-1.5 font-medium text-white hover:bg-red-600 disabled:opacity-40"
      >
        {pending ? "Deleting…" : "Delete my club and start over"}
      </button>
      {error && (
        <p role="alert" className="text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </form>
  );
}
