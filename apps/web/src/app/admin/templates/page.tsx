import { defaultStoredTemplates } from "@lfs/sport-soccer";
import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { requireAdmin } from "@/lib/auth";
import { loadEditorState } from "@/lib/soccer-templates";
import { TemplateEditor } from "./template-editor";

export const metadata: Metadata = { title: "Soccer templates" };

// Testing runs 3,000 matches on the server.
export const maxDuration = 60;

export default function TemplatesPage({
  searchParams,
}: PageProps<"/admin/templates">) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Soccer position templates
        </h1>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Paint where each position has influence on the pitch (D41). The match
          engine adds up every player&apos;s template, weighted by their skill,
          to decide who controls each part of the pitch.
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
}: Pick<PageProps<"/admin/templates">, "searchParams">) {
  await requireAdmin();
  const params = await searchParams;
  const requested = Number(
    Array.isArray(params.version) ? params.version[0] : params.version,
  );
  const state = await loadEditorState(
    Number.isInteger(requested) ? requested : undefined,
  );

  return (
    <div className="flex flex-col gap-4">
      <nav
        aria-label="Versions"
        className="flex flex-wrap items-center gap-2 text-sm"
      >
        <span className="text-zinc-500">Editing:</span>
        {state.versions.length === 0 && (
          <span className="font-medium">Built-in defaults</span>
        )}
        {state.versions.map((v) => (
          <Link
            key={v.version}
            href={`/admin/templates?version=${v.version}`}
            className={`rounded px-2 py-0.5 ${
              v.version === state.version
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            }`}
          >
            v{v.version}{" "}
            {v.publishedAt
              ? v.version === state.live
                ? "· live"
                : "· past"
              : "· draft"}
          </Link>
        ))}
      </nav>
      <TemplateEditor
        key={state.version ?? "defaults"}
        version={state.version}
        status={state.status}
        note={state.note}
        templates={state.templates}
        variants={state.variants}
        enabled={state.enabled}
        liveEnabled={state.liveEnabled}
        defaults={defaultStoredTemplates()}
      />
    </div>
  );
}
