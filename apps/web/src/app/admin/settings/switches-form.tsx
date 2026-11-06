"use client";

import type { SportId } from "@lfs/core";
import { useState, useTransition } from "react";
import { saveSportSwitches } from "./actions";

/** A sport's Public and AI world switches (D207). */
export function SwitchesForm({
  sport,
  name,
  initial,
}: {
  sport: SportId;
  name: string;
  initial: { public: boolean; aiEnabled: boolean };
}) {
  const [isPublic, setPublic] = useState(initial.public);
  const [aiEnabled, setAi] = useState(initial.aiEnabled);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null,
  );
  const [pending, startTransition] = useTransition();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await saveSportSwitches({
            sport,
            public: isPublic,
            aiEnabled,
          });
          setMessage(
            result.ok
              ? { ok: true, text: "Saved. It applies straight away." }
              : { ok: false, text: result.error },
          );
        });
      }}
      className="flex flex-wrap items-center gap-4 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800"
    >
      <span className="w-full font-semibold">{name}</span>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={isPublic}
          onChange={(e) => setPublic(e.target.checked)}
        />
        Public: players see it
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={aiEnabled}
          onChange={(e) => setAi(e.target.checked)}
        />
        AI world: scheduled AI runs play it
      </label>
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Saving…" : "Save"}
      </button>
      {message && (
        <p
          className={
            message.ok
              ? "w-full text-emerald-700 dark:text-emerald-400"
              : "w-full text-red-600 dark:text-red-400"
          }
        >
          {message.text}
        </p>
      )}
    </form>
  );
}
