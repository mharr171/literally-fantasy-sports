"use client";

import { useActionState } from "react";
import { type EmailSignInState, signInWithEmail } from "@/app/auth/actions";

const initialState: EmailSignInState = { status: "idle" };

export function EmailSignInForm() {
  const [state, formAction, pending] = useActionState(
    signInWithEmail,
    initialState,
  );

  if (state.status === "sent") {
    return (
      <output className="block rounded-md border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        Check <strong>{state.email}</strong> for a sign-in link. It expires in
        an hour.
      </output>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label htmlFor="email" className="text-sm font-medium">
        Email
      </label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        defaultValue={state.status === "error" ? state.email : undefined}
        placeholder="you@example.com"
        className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-zinc-900 dark:border-zinc-700 dark:focus:border-zinc-100"
      />
      {state.status === "error" && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
    </form>
  );
}
