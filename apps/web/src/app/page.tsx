import Link from "next/link";
import { Suspense } from "react";
import { ContinueLink } from "@/components/getting-started";
import { SPORT_UI, type SportUi } from "@/sports/registry";

export default function Home() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-6 px-4 py-16 sm:px-6">
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
        It&apos;s literally fantasy sports.
      </h1>
      <p className="text-lg text-zinc-600 dark:text-zinc-400">
        Collect generated players, build your matchday squad and play seasons
        against AI teams and the ghosts of other managers&apos; finished
        seasons. Soccer comes first.
      </p>
      {/* Pick a sport (D191): one card per sport the site shows. */}
      <ul aria-label="Sports" className="grid gap-3 sm:grid-cols-2">
        {(Object.values(SPORT_UI) as SportUi[]).map((s) => (
          <li key={s.id}>
            <Link
              href={`${s.basePath}/team`}
              className="flex items-center gap-3 rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              <span aria-hidden="true" className="text-3xl">
                {s.icon}
              </span>
              <span className="font-semibold">{s.name}</span>
            </Link>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-3">
        <Suspense fallback={<BuildLink />}>
          <MainAction />
        </Suspense>
        <Link
          href="/soccer/leaderboard"
          className="inline-block rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Leaderboard
        </Link>
      </div>
    </section>
  );
}

/** A new manager's next step (M6), else the way to their team. */
async function MainAction() {
  return (await ContinueLink()) ?? <BuildLink />;
}

function BuildLink() {
  return (
    <Link
      href="/soccer/team"
      className="inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
    >
      Build your team
    </Link>
  );
}
