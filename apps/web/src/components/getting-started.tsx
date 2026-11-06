import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { nextStep } from "@/lib/onboarding";
import { loadOnboarding } from "@/lib/onboarding-state";

/**
 * The getting-started checklist (M6), shown until a manager has played
 * their first week. Renders nothing for signed-out visitors and old hands.
 */
export async function GettingStarted() {
  const user = await getCurrentUser();
  if (!user) return null;
  const steps = await loadOnboarding(user.id);
  const next = nextStep(steps);
  if (!next) return null;
  const done = steps.filter((s) => s.done).length;
  return (
    <aside
      aria-label="Getting started"
      className="rounded-md border border-sky-200 bg-sky-50 p-4 text-sm dark:border-sky-900 dark:bg-sky-950/40"
    >
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="font-semibold">Getting started</h2>
        <span className="text-xs text-zinc-500 tabular-nums">
          {done} of {steps.length} done
        </span>
      </div>
      <ol className="flex flex-col gap-1.5">
        {steps.map((s, i) => {
          const current = s.id === next.id;
          return (
            <li
              key={s.id}
              aria-current={current ? "step" : undefined}
              className="grid grid-cols-[1.5rem_1fr] gap-x-2"
            >
              <span
                aria-hidden="true"
                className={`flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${
                  s.done
                    ? "bg-emerald-600 text-white"
                    : current
                      ? "bg-sky-600 text-white"
                      : "border border-zinc-300 text-zinc-500 dark:border-zinc-700"
                }`}
              >
                {s.done ? "✓" : i + 1}
              </span>
              <span>
                <span
                  className={
                    s.done
                      ? "text-zinc-500 line-through"
                      : current
                        ? "font-medium"
                        : "text-zinc-600 dark:text-zinc-400"
                  }
                >
                  {s.title}
                </span>
                <span className="sr-only">{s.done ? " (done)" : ""}</span>
                {current && (
                  <span className="mt-0.5 block text-zinc-600 dark:text-zinc-400">
                    {s.help}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ol>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        <Link
          href={next.href}
          className="inline-block rounded-md bg-sky-700 px-3 py-1.5 font-medium text-white hover:bg-sky-600"
        >
          {next.action} →
        </Link>
        <Link
          href="/soccer/guide"
          className="text-sky-800 underline dark:text-sky-300"
        >
          New here? Read the game guide
        </Link>
      </div>
    </aside>
  );
}

/** For the home page: the next step's button, or null when there's none. */
export async function ContinueLink() {
  const user = await getCurrentUser();
  if (!user) return null;
  const next = nextStep(await loadOnboarding(user.id));
  if (!next) return null;
  return (
    <Link
      href={next.href}
      className="inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
    >
      Continue: {next.action}
    </Link>
  );
}
