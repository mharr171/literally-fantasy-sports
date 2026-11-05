"use client";

import { useState, useTransition } from "react";
import { softReset, softResetPreview } from "./actions";

type Scope = "ai" | "real" | "all";
const LABELS: Record<Scope, string> = {
  ai: "AI clubs",
  real: "Real clubs",
  all: "All clubs",
};
const PHRASE: Record<Scope, string> = {
  ai: "RESET AI",
  real: "RESET REAL",
  all: "RESET ALL",
};
type Counts = {
  clubs: number;
  players: number;
  seasons: number;
  season_records: number;
  ghosts: number;
  careers: number;
};

/**
 * Admin soft reset (D142, ADR 0004): pick a scope, see exactly what it
 * touches, type the phrase, run it.
 */
export function SoftReset({ backupUrl }: { backupUrl: string }) {
  const [scope, setScope] = useState<Scope>("ai");
  const [counts, setCounts] = useState<Counts | null>(null);
  const [typed, setTyped] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [pending, start] = useTransition();

  const preview = (next: Scope) =>
    start(async () => {
      setMessage(null);
      setCounts(null);
      setTyped("");
      const res = await softResetPreview(next);
      if (res.ok) setCounts(res.counts);
      else setMessage({ ok: false, text: res.error });
    });

  return (
    <div className="flex flex-col gap-3 rounded-md border border-red-200 p-4 text-sm dark:border-red-900">
      <h2 className="text-lg font-semibold">Soft reset</h2>
      <p className="text-zinc-600 dark:text-zinc-400">
        Every club in scope goes back to Elo 1500 and 10,000 funds with full
        energy and neutral morale, and starts again at season 1. Every player is
        kept, fully healed with form 0. All seasons, season records, ghosts,
        retired players&apos; careers and player stats are deleted. It
        can&apos;t be undone.{" "}
        <a
          href={backupUrl}
          className="underline"
          target="_blank"
          rel="noreferrer"
        >
          Back up now
        </a>{" "}
        first (the nightly backup runs at 10:41 UTC).
      </p>
      <fieldset className="flex flex-wrap gap-3">
        <legend className="sr-only">Scope</legend>
        {(Object.keys(LABELS) as Scope[]).map((s) => (
          <label key={s} className="flex items-center gap-1.5">
            <input
              type="radio"
              name="scope"
              checked={scope === s}
              onChange={() => {
                setScope(s);
                setCounts(null);
                setTyped("");
              }}
            />
            {LABELS[s]}
          </label>
        ))}
        <button
          type="button"
          disabled={pending}
          onClick={() => preview(scope)}
          className="rounded-md border border-zinc-300 px-3 py-1 hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Preview
        </button>
      </fieldset>
      {counts && (
        <>
          <p>
            {LABELS[scope]}: <strong>{counts.clubs}</strong> clubs and{" "}
            <strong>{counts.players}</strong> players are kept.{" "}
            <strong>{counts.seasons}</strong> seasons,{" "}
            <strong>{counts.season_records}</strong> season records,{" "}
            <strong>{counts.ghosts}</strong> ghosts and{" "}
            <strong>{counts.careers}</strong> careers will be deleted.
          </p>
          <label className="flex flex-col gap-1">
            <span>
              Type <strong>{PHRASE[scope]}</strong> to confirm
            </span>
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoComplete="off"
              spellCheck={false}
              className="max-w-xs rounded-md border border-zinc-300 bg-[var(--background)] px-2 py-1 text-[var(--foreground)] dark:border-zinc-700"
            />
          </label>
          <button
            type="button"
            disabled={pending || typed !== PHRASE[scope]}
            onClick={() =>
              start(async () => {
                const res = await softReset(scope, typed);
                setMessage(
                  res.ok
                    ? { ok: true, text: res.message }
                    : { ok: false, text: res.error },
                );
                if (res.ok) {
                  setCounts(null);
                  setTyped("");
                }
              })
            }
            className="self-start rounded-md bg-red-700 px-3 py-1.5 font-medium text-white hover:bg-red-600 disabled:opacity-40"
          >
            {pending
              ? "Resetting…"
              : `Soft reset ${LABELS[scope].toLowerCase()}`}
          </button>
        </>
      )}
      {message && (
        <p
          role={message.ok ? "status" : "alert"}
          className={
            message.ok
              ? "text-emerald-700 dark:text-emerald-400"
              : "text-red-600 dark:text-red-400"
          }
        >
          {message.text}
        </p>
      )}
    </div>
  );
}
