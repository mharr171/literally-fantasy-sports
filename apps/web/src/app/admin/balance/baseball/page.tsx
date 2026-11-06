import {
  BASEBALL_SETTING_PATHS,
  baseballConfigFromValues,
  baseballConfigToRows,
  defaultBaseballConfig,
} from "@lfs/sport-baseball";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import {
  listSoccerVersions as listVersions,
  liveVersion,
  loadVersionValues,
} from "@/lib/soccer-templates";
import { sportModule } from "@/lib/sports";
import { SportTabs } from "../sport-tabs";
import { SettingsEditor } from "./settings-editor";

export const metadata: Metadata = { title: "Baseball balance" };

// Testing plays 1,200 games on the server.
export const maxDuration = 60;

const BASEBALL = "baseball";

export default function BaseballBalancePage({
  searchParams,
}: PageProps<"/admin/balance/baseball">) {
  return (
    <section className="flex flex-col gap-4">
      <SportTabs current="baseball" />
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Baseball balance
        </h1>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          The pitch-by-pitch engine&apos;s tuning (ADR 0008): pitches, balls in
          play, running, pitchers and rest, the bench, home advantage and color
          matchups. Then the season&apos;s balance (ADR 0009): payouts and Elo,
          pack prices, pitchers&apos; rest days, form and morale, and new
          players. Baseball has its own numbered settings versions: save a
          draft, test it against the live version, then publish. Until a version
          is published the built-in defaults apply. Baseball is still hidden
          from players.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Editor searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

/** A config's values, path by path. */
const asValues = (values: Record<string, unknown>) =>
  Object.fromEntries(
    baseballConfigToRows(baseballConfigFromValues(values)).map((r) => [
      r.key,
      r.value,
    ]),
  );

async function Editor({
  searchParams,
}: Pick<PageProps<"/admin/balance/baseball">, "searchParams">) {
  await requireAdmin();
  const params = await searchParams;
  const requested = Number(
    Array.isArray(params.version) ? params.version[0] : params.version,
  );
  const versions = await listVersions(BASEBALL);
  const live = liveVersion(versions);
  const chosen =
    versions.find((v) => v.version === requested) ??
    versions.find((v) => !v.publishedAt) ??
    versions.find((v) => v.version === live);
  const [values, liveValues] = await Promise.all([
    chosen ? loadVersionValues(chosen.version, BASEBALL) : {},
    live ? loadVersionValues(live, BASEBALL) : {},
  ]);
  const defaults = Object.fromEntries(
    baseballConfigToRows(defaultBaseballConfig()).map((r) => [r.key, r.value]),
  );
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
            href={`/admin/balance/baseball?version=${v.version}`}
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
      <SettingsEditor
        key={chosen?.version ?? "defaults"}
        version={chosen?.version ?? null}
        status={
          !chosen ? "defaults" : chosen.publishedAt ? "published" : "draft"
        }
        note={chosen?.note ?? ""}
        values={asValues(values)}
        live={asValues(liveValues)}
        defaults={defaults}
        groups={sportModule(BASEBALL).settings}
      />
      <p className="text-xs text-zinc-500">
        {BASEBALL_SETTING_PATHS.length} settings.
      </p>
    </div>
  );
}
