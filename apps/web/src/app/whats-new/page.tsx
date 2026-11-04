import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import { parseChangelog } from "@/lib/changelog";

export const metadata: Metadata = { title: "What's new" };

/** Read at build time, so each release shows up with its deploy. */
function releases() {
  const file = path.join(process.cwd(), "..", "..", "CHANGELOG.md");
  return parseChangelog(readFileSync(file, "utf-8"));
}

const formatDate = (iso: string) =>
  new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });

export default function WhatsNewPage() {
  const list = releases();
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          What&apos;s new
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Every update to the game, newest first.
        </p>
      </div>
      <ol className="flex flex-col gap-6">
        {list.map((r) => (
          <li
            key={r.version}
            className="border-l-2 border-zinc-200 pl-4 dark:border-zinc-800"
          >
            <h2 className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-lg font-semibold">Version {r.version}</span>
              <time dateTime={r.date} className="text-sm text-zinc-500">
                {formatDate(r.date)}
              </time>
            </h2>
            {r.features.length === 0 && r.fixes.length === 0 && (
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                Behind-the-scenes improvements.
              </p>
            )}
            {r.features.length > 0 && (
              <>
                <h3 className="mt-2 text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                  New
                </h3>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {r.features.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </>
            )}
            {r.fixes.length > 0 && (
              <>
                <h3 className="mt-2 text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-400">
                  Fixed
                </h3>
                <ul className="mt-1 list-disc pl-5 text-sm">
                  {r.fixes.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              </>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}
