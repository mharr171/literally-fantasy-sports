"use client";

import { TEAM_NAME_MAX, TEAM_NAME_MIN } from "@lfs/core";
import { useActionState, useState } from "react";
import { ClubColorPicker } from "@/components/club-color-picker";
import { type CreateTeamState, createTeam } from "./actions";

const initialState: CreateTeamState = { status: "idle" };

export function CreateTeamForm() {
  const [state, formAction, pending] = useActionState(createTeam, initialState);
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
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Name your soccer team and pick its colors. You&apos;ll get 22 free
          starter packs of 5 players each: open them all, then keep the 11 to 33
          players you want. Everyone else is released.
        </p>
      </div>
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
          {pending ? "Creating…" : "Create team and get 22 packs"}
        </button>
      </form>
    </div>
  );
}
