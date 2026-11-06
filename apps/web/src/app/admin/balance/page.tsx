import { balanceFromValues, DEFAULT_BALANCE } from "@lfs/sport-soccer";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import {
  listSoccerVersions,
  liveVersion,
  loadVersionValues,
} from "@/lib/soccer-templates";
import { SOCCER, sportModule } from "@/lib/sports";
import { BalanceEditor } from "./balance-editor";
import { SportTabs } from "./sport-tabs";

export const metadata: Metadata = { title: "Balance" };

// Testing runs 3,000 matches on the server.
export const maxDuration = 60;

export default function BalancePage({
  searchParams,
}: PageProps<"/admin/balance">) {
  return (
    <section className="flex flex-col gap-4">
      <SportTabs current="soccer" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Soccer balance
        </h1>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Match tuning, what seasons pay and what packs cost. These live in the
          numbered settings versions with the templates: save a draft, test it,
          then publish. New seasons play and pay by the live version; seasons
          already under way keep the version they started with. Pack prices
          change for everyone as soon as you publish.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Editor searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function Editor({
  searchParams,
}: Pick<PageProps<"/admin/balance">, "searchParams">) {
  await requireAdmin();
  const params = await searchParams;
  const requested = Number(
    Array.isArray(params.version) ? params.version[0] : params.version,
  );
  const versions = await listSoccerVersions();
  const live = liveVersion(versions);
  const chosen =
    versions.find((v) => v.version === requested) ??
    versions.find((v) => !v.publishedAt) ??
    versions.find((v) => v.version === live);
  const [values, liveValues] = await Promise.all([
    chosen ? loadVersionValues(chosen.version) : {},
    live ? loadVersionValues(live) : {},
  ]);

  return (
    <div className="flex flex-col gap-4">
      <nav
        aria-label="Versions"
        className="flex flex-wrap items-center gap-2 text-sm"
      >
        <span className="text-zinc-500">Editing:</span>
        {versions.length === 0 && (
          <span className="font-medium">Built-in defaults</span>
        )}
        {versions.map((v) => (
          <Link
            key={v.version}
            href={`/admin/balance?version=${v.version}`}
            className={`rounded px-2 py-0.5 ${
              v.version === chosen?.version
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            }`}
          >
            v{v.version}{" "}
            {v.publishedAt
              ? v.version === live
                ? "· live"
                : "· past"
              : "· draft"}
          </Link>
        ))}
      </nav>
      <BalanceEditor
        key={chosen?.version ?? "defaults"}
        version={chosen?.version ?? null}
        status={
          !chosen ? "defaults" : chosen.publishedAt ? "published" : "draft"
        }
        note={chosen?.note ?? ""}
        settings={balanceFromValues(values)}
        live={live ? balanceFromValues(liveValues) : DEFAULT_BALANCE}
        defaults={DEFAULT_BALANCE}
        groups={sportModule(SOCCER).settings}
      />
    </div>
  );
}
