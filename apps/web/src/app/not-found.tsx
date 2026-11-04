import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

/** Unknown pages (and pages a player isn't allowed to see) end up here. */
export default function NotFound() {
  return (
    <section className="mx-auto flex w-full max-w-xl flex-1 flex-col justify-center gap-4 px-4 py-16 sm:px-6">
      <p className="text-sm font-semibold uppercase tracking-wide text-zinc-500">
        404
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">
        That page isn&apos;t on the team sheet.
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        The link may be old, or the page may have moved. Head back to your club
        or the season.
      </p>
      <div className="flex flex-wrap gap-3 text-sm">
        <Link
          href="/team"
          className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          My team
        </Link>
        <Link
          href="/season"
          className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Season
        </Link>
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
