"use client";

import { TEAM_NAME_MAX, TEAM_NAME_MIN } from "@lfs/core";
import { useActionState, useState } from "react";
import { ClubColorPicker } from "@/components/club-color-picker";

/** What creating a club returns: nothing, or what to show and keep. */
export type CreateClubState =
  | { status: "idle" }
  | { status: "error"; name: string; colors: string[]; message: string };

const initialState: CreateClubState = { status: "idle" };

/**
 * Starting a club in a sport (D192): its name and colors, with an option to
 * copy them from the manager's club in another sport.
 */
export function CreateClubForm({
  action,
  intro,
  submitLabel,
  copyFrom,
}: {
  action: (prev: CreateClubState, data: FormData) => Promise<CreateClubState>;
  intro: string;
  submitLabel: string;
  /** The manager's club in another sport, to copy (D192). */
  copyFrom?: { sportName: string; name: string; colors: string[] };
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const [colors, setColors] = useState<string[]>(
    state.status === "error" ? state.colors : [],
  );
  const [name, setName] = useState(state.status === "error" ? state.name : "");

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 py-8">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Start your club
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{intro}</p>
      </div>
      {copyFrom && (
        <button
          type="button"
          onClick={() => {
            setName(copyFrom.name);
            setColors(copyFrom.colors);
          }}
          className="self-start rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Copy name and colors from my {copyFrom.sportName} club
        </button>
      )}
      <form action={formAction} className="flex flex-col gap-3">
        <label htmlFor="name" className="text-sm font-medium">
          Team name
        </label>
        <input
          id="name"
          name="name"
          required
          minLength={TEAM_NAME_MIN}
          maxLength={TEAM_NAME_MAX}
          autoComplete="off"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Riverside Rovers"
          className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
        />
        <p className="text-xs text-zinc-500">
          {TEAM_NAME_MIN}–{TEAM_NAME_MAX} characters: letters, numbers, spaces
          and . &apos; &amp; -
        </p>
        <ClubColorPicker value={colors} onChange={setColors} name={name} />
        {state.status === "error" && (
          <p role="alert" className="text-sm text-red-600 dark:text-red-400">
            {state.message}
          </p>
        )}
        <button
          type="submit"
          disabled={pending || colors.length < 2}
          className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Creating…" : submitLabel}
        </button>
      </form>
    </div>
  );
}
