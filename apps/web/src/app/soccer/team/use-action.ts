"use client";

import { useState, useTransition } from "react";
import type { ActionResult } from "./actions";

/** Runs a server action in a transition and keeps its error message. */
export function useAction() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const run = (action: () => Promise<ActionResult>) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) setError(result.error);
    });
  return { error, pending, run };
}
