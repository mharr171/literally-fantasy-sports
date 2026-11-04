"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Shown when a page fails to load (M6). The real error stays in the
 * server logs; players get a reference code to quote instead.
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest =
    error instanceof Error && "digest" in error
      ? String((error as Error & { digest?: string }).digest ?? "")
      : "";
  return (
    <section className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-4 py-16 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">
        Something went wrong.
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        This page didn&apos;t load. Try again in a moment. If it keeps
        happening, use Contact at the bottom of the page and include the code
        below.
      </p>
      {digest && (
        <p className="text-xs text-zinc-500">
          Reference: <code className="font-mono">{digest}</code>
        </p>
      )}
      <div className="flex flex-wrap gap-3 text-sm">
        <button
          type="button"
          onClick={() => retry()}
          className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Try again
        </button>
        <Link
          href="/"
          className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Home
        </Link>
      </div>
    </section>
  );
}
