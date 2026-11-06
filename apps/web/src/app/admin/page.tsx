import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { loadVariantCoverage } from "@/lib/variant-coverage";

export default function AdminHome() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const admin = await requireAdmin();
  const coverage = await loadVariantCoverage();
  const share = (n: number, of: number) =>
    of === 0 ? "" : ` (${Math.round((n / of) * 100)}%)`;
  return (
    <section className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Signed in as {admin.displayName}. Changes here affect every player.
        </p>
      </div>
      <ul className="grid gap-4 sm:grid-cols-2">
        <li className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <Link href="/admin/settings" className="font-medium hover:underline">
            Sports →
          </Link>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Each sport&apos;s Public and AI world switches, energy and roster
            limits, and its settings versions.
          </p>
        </li>
        <li className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <Link href="/admin/templates" className="font-medium hover:underline">
            Soccer templates →
          </Link>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Paint each position&apos;s influence on the pitch, test it, and
            publish.
          </p>
        </li>
        <li className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <Link href="/admin/balance" className="font-medium hover:underline">
            Soccer balance →
          </Link>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Match tuning, season payouts and pack prices: change, test and
            publish without a deploy.
          </p>
        </li>
        <li className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <Link
            href="/admin/formations"
            className="font-medium hover:underline"
          >
            Formations →
          </Link>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Turn formations on or off for every club, or create new ones.
          </p>
        </li>
        <li className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <Link href="/admin/ai" className="font-medium hover:underline">
            AI clubs →
          </Link>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            The AI world: how many clubs, how often they play, and each
            club&apos;s style. Add clubs or run a turn for testing.
          </p>
        </li>
      </ul>
      <div className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
        <h2 className="font-medium">Heatmaps in use</h2>
        <p className="mt-1 text-zinc-600 dark:text-zinc-400">
          Players on the default template, at real and AI clubs (D132). New
          players get one of the live version&apos;s ticked templates for each
          of their positions.
        </p>
        <dl className="mt-3 grid max-w-md grid-cols-[1fr_auto] gap-x-4 gap-y-1">
          <dt>Primary position</dt>
          <dd className="text-right tabular-nums">
            {coverage.defaultPrimary.toLocaleString()} of{" "}
            {coverage.players.toLocaleString()}
            {share(coverage.defaultPrimary, coverage.players)}
          </dd>
          <dt>Secondary position</dt>
          <dd className="text-right tabular-nums">
            {coverage.defaultSecondary.toLocaleString()} of{" "}
            {coverage.withSecondary.toLocaleString()}
            {share(coverage.defaultSecondary, coverage.withSecondary)}
          </dd>
        </dl>
      </div>
    </section>
  );
}
