import Link from "next/link";

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
      <div>
        <Link
          href="/team"
          className="inline-block rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Build your team
        </Link>
      </div>
    </section>
  );
}
