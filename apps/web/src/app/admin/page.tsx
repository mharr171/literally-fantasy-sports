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
        <li className="rounded-lg border border-dashed border-zinc-300 p-4 text-zinc-500 dark:border-zinc-700">
          <span className="font-medium">Template editor</span>
          <p className="mt-1 text-sm">
            Coming next: paint each position&apos;s influence grid.
          </p>
        </li>
      </ul>
    </section>
  );
}
