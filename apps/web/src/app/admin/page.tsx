import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";

export default function AdminHome() {
  return (
    <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
      <Overview />
    </Suspense>
  );
}

async function Overview() {
  const admin = await requireAdmin();
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
            Game settings →
          </Link>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Versions of each sport&apos;s tuning values and templates, and which
            one is live.
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
      </ul>
    </section>
  );
}
