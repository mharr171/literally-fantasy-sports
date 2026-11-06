"use client";

import type { Limit, SettingGroup } from "@lfs/core";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  type BaseballTest,
  publishBaseballBalance,
  saveBaseballBalance,
  testBaseballBalance,
} from "./actions";

type Values = Record<string, number>;

/**
 * Baseball's balance settings (ADR 0008 §9), drawn from its setting groups:
 * edit, test against the live version, save a draft, publish.
 */
export function SettingsEditor(props: {
  version: number | null;
  status: "draft" | "published" | "defaults";
  note: string;
  values: Values;
  live: Values;
  defaults: Values;
  groups: readonly SettingGroup[];
}) {
  const router = useRouter();
  const [fields, setFields] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(props.values).map(([k, v]) => [k, String(v)]),
    ),
  );
  const [note, setNote] = useState(props.note);
  const [dirty, setDirty] = useState(false);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const [test, setTest] = useState<BaseballTest | null>(null);

  const limits = useMemo(
    () =>
      new Map(
        props.groups.flatMap((g) =>
          g.fields.map((f) => [f.path, f.limit] as const),
        ),
      ),
    [props.groups],
  );
  const errors = useMemo(() => {
    const out: string[] = [];
    for (const [path, text] of Object.entries(fields)) {
      const limit = limits.get(path);
      if (!limit) continue;
      const v = Number(text);
      if (text.trim() === "" || !Number.isFinite(v))
        out.push(`${limit.label}: not a number.`);
      else if (v < limit.min || v > limit.max)
        out.push(`${limit.label}: ${limit.min}–${limit.max}.`);
      else if (limit.integer && !Number.isInteger(v))
        out.push(`${limit.label}: a whole number.`);
    }
    return out;
  }, [fields, limits]);
  const input = () => ({
    baseVersion: props.version,
    note,
    values: Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, Number(v)]),
    ),
  });

  const save = () =>
    start(async () => {
      const r = await saveBaseballBalance(input());
      if (!r.ok) return setMessage({ kind: "error", text: r.error });
      setDirty(false);
      setMessage({ kind: "ok", text: `Saved as draft ${r.data.version}.` });
      router.push(`/admin/balance/baseball?version=${r.data.version}`);
    });
  const publish = () =>
    start(async () => {
      if (props.version === null) return;
      const r = await publishBaseballBalance(props.version);
      if (!r.ok) return setMessage({ kind: "error", text: r.error });
      setMessage({
        kind: "ok",
        text: `Version ${r.data.version} is live for baseball.`,
      });
      router.refresh();
    });
  const runTest = () =>
    start(async () => {
      setMessage(null);
      const r = await testBaseballBalance(input());
      if (!r.ok) return setMessage({ kind: "error", text: r.error });
      setTest(r.data);
    });

  return (
    <div className="flex flex-col gap-6">
      <p className="text-xs text-zinc-500">
        Under each box: the live value, and the built-in default. Boxes that
        differ from the live version are highlighted.
      </p>
      {props.groups.map((g) => (
        <fieldset key={g.id} className="flex flex-col gap-3">
          <legend className="mb-2 text-lg font-semibold">{g.title}</legend>
          <div
            className={`grid gap-3 sm:grid-cols-2 ${g.columns === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3"}`}
          >
            {g.fields.map((f) => (
              <NumberField
                key={f.path}
                path={f.path}
                limit={f.limit}
                value={fields[f.path] ?? ""}
                live={String(props.live[f.path] ?? "")}
                fallback={String(props.defaults[f.path] ?? "")}
                onChange={(v) => {
                  setFields((prev) => ({ ...prev, [f.path]: v }));
                  setDirty(true);
                }}
              />
            ))}
          </div>
          {g.note && <p className="text-xs text-zinc-500">{g.note}</p>}
        </fieldset>
      ))}

      <div className="sticky bottom-0 flex flex-col gap-2 border-t border-zinc-200 bg-white py-3 text-sm dark:border-zinc-800 dark:bg-zinc-950">
        {errors.length > 0 && (
          <ul role="alert" className="text-red-600 dark:text-red-400">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex flex-1 items-center gap-2">
            Note
            <input
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setDirty(true);
              }}
              maxLength={200}
              placeholder="e.g. More stolen bases"
              className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
            />
          </label>
          <button
            type="button"
            onClick={runTest}
            disabled={pending || errors.length > 0}
            className={secondary}
          >
            {pending ? "Working…" : "Test (600 games)"}
          </button>
          <button
            type="button"
            onClick={save}
            disabled={pending || errors.length > 0}
            className={primary}
          >
            {props.status === "draft"
              ? `Save draft ${props.version}`
              : "Save as new draft"}
          </button>
          <button
            type="button"
            onClick={publish}
            disabled={pending || props.status !== "draft" || dirty}
            title={dirty ? "Save first" : undefined}
            className={publishStyle}
          >
            Publish{props.status === "draft" ? ` version ${props.version}` : ""}
          </button>
        </div>
        {dirty && (
          <p className="text-amber-700 dark:text-amber-400">Unsaved changes.</p>
        )}
        {message && (
          <p
            role={message.kind === "error" ? "alert" : "status"}
            className={
              message.kind === "error"
                ? "text-red-600 dark:text-red-400"
                : "text-emerald-700 dark:text-emerald-400"
            }
          >
            {message.text}
          </p>
        )}
      </div>

      {test && (
        <div className="grid gap-4 lg:grid-cols-2">
          <Report title="These settings" text={test.text.draft} />
          <Report title={test.liveLabel} text={test.text.live} />
        </div>
      )}
    </div>
  );
}

function Report({ title, text }: { title: string; text: string }) {
  return (
    <div className="flex flex-col gap-1">
      <h3 className="font-semibold">{title}</h3>
      <pre className="overflow-x-auto rounded-md bg-zinc-100 p-3 text-xs leading-5 dark:bg-zinc-900">
        {text}
      </pre>
    </div>
  );
}

function NumberField({
  path,
  limit,
  value,
  live,
  fallback,
  onChange,
}: {
  path: string;
  limit: Limit;
  value: string;
  live: string;
  fallback: string;
  onChange: (value: string) => void;
}) {
  const changed = Number(value) !== Number(live);
  const id = `baseball-${path}`;
  return (
    <div className="flex flex-col gap-1 text-sm">
      <label htmlFor={id} className="font-medium">
        {limit.label}
      </label>
      <input
        id={id}
        type="number"
        inputMode="decimal"
        min={limit.min}
        max={limit.max}
        step={limit.integer ? 1 : "any"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`rounded-md border bg-transparent px-2 py-1 tabular-nums ${changed ? "border-amber-500 bg-amber-50 dark:bg-amber-950/40" : "border-zinc-300 dark:border-zinc-700"}`}
      />
      <span className="text-xs text-zinc-500">
        {limit.help && <span className="block">{limit.help}</span>}
        Live {live} · default {fallback} · {limit.min}–{limit.max}
      </span>
    </div>
  );
}

const secondary =
  "rounded-md border border-zinc-300 px-3 py-1.5 font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900";
const primary =
  "rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";
const publishStyle =
  "rounded-md bg-emerald-700 px-3 py-1.5 font-medium text-white hover:bg-emerald-600 disabled:opacity-40";
