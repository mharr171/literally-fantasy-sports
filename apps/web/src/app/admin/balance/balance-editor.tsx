"use client";

import type { PayoutSettings } from "@lfs/core";
import {
  type BalanceSettings,
  BOUGHT_TIERS,
  balanceErrors,
  FOCUS_SURCHARGE_LIMIT,
  type Limit,
  type MatchTuning,
  PACK_PRICE_LIMIT,
  PAYOUT_LIMITS,
  TUNING_LIMITS,
} from "@lfs/sport-soccer";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import type { TestResult } from "../templates/actions";
import { TestTable } from "../templates/template-editor";
import { publishBalance, saveBalance, testBalance } from "./actions";

const TUNING_GROUPS: [string, (keyof MatchTuning)[]][] = [
  [
    "Match flow",
    [
      "phases",
      "extraTimePhases",
      "possessionSharpness",
      "chanceRate",
      "chanceSharpness",
      "shotRate",
      "goalRate",
      "penaltyRate",
      "thirdRows",
    ],
  ],
  [
    "Tiredness and substitutions",
    [
      "fatiguePerPhase",
      "keeperFatigueFactor",
      "fatiguePenalty",
      "autoSubEnergy",
      "autoSubFromMinute",
      "maxSubs",
      "maxSubWindows",
    ],
  ],
  ["Cards and injuries", ["injuryRate", "yellowRate", "redRate"]],
  [
    "Color matchups (Red → Yellow → Green → Blue → Purple; each beats the next two)",
    ["teamMatchup", "teamMatchupSecond", "playerMatchup"],
  ],
];

/** Every field as a path, e.g. "tuning.phases" or "packs.tiers.basic". */
type Fields = Record<string, string>;

function toFields(s: BalanceSettings): Fields {
  const f: Fields = {};
  for (const [k, v] of Object.entries(s.tuning)) f[`tuning.${k}`] = String(v);
  for (const [k, v] of Object.entries(s.payouts)) f[`payouts.${k}`] = String(v);
  for (const t of BOUGHT_TIERS)
    f[`packs.tiers.${t.id}`] = String(s.packs.tiers[t.id] ?? t.price);
  f["packs.focusSurcharge"] = String(s.packs.focusSurcharge);
  return f;
}

function fromFields(f: Fields): BalanceSettings {
  const n = (path: string) =>
    f[path]?.trim() === "" ? Number.NaN : Number(f[path]);
  const pick = <T,>(prefix: string, keys: string[]) =>
    Object.fromEntries(keys.map((k) => [k, n(`${prefix}.${k}`)])) as T;
  return {
    tuning: pick<MatchTuning>("tuning", Object.keys(TUNING_LIMITS)),
    payouts: pick<PayoutSettings>("payouts", Object.keys(PAYOUT_LIMITS)),
    packs: {
      tiers: Object.fromEntries(
        BOUGHT_TIERS.map((t) => [t.id, n(`packs.tiers.${t.id}`)]),
      ),
      focusSurcharge: n("packs.focusSurcharge"),
    },
  };
}

export function BalanceEditor(props: {
  version: number | null;
  status: "draft" | "published" | "defaults";
  note: string;
  settings: BalanceSettings;
  live: BalanceSettings;
  defaults: BalanceSettings;
}) {
  const router = useRouter();
  const [fields, setFields] = useState(() => toFields(props.settings));
  const [note, setNote] = useState(props.note);
  const [dirty, setDirty] = useState(false);
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const [test, setTest] = useState<TestResult | null>(null);
  const liveFields = useMemo(() => toFields(props.live), [props.live]);
  const defaultFields = useMemo(
    () => toFields(props.defaults),
    [props.defaults],
  );

  const settings = fromFields(fields);
  const errors = balanceErrors(settings);
  const input = () => ({ baseVersion: props.version, note, settings });
  const set = (path: string, value: string) => {
    setFields((f) => ({ ...f, [path]: value }));
    setDirty(true);
  };

  const save = () =>
    startTransition(async () => {
      setMessage(null);
      const res = await saveBalance(input());
      if (!res.ok) return setMessage({ kind: "error", text: res.error });
      setDirty(false);
      setMessage({
        kind: "ok",
        text: `Saved as draft version ${res.data.version}.`,
      });
      router.push(`/admin/balance?version=${res.data.version}`);
      router.refresh();
    });

  const runTest = () =>
    startTransition(async () => {
      setMessage(null);
      setTest(null);
      const res = await testBalance(input());
      if (!res.ok) return setMessage({ kind: "error", text: res.error });
      setTest(res.data);
    });

  const publish = () => {
    if (props.version === null || props.status !== "draft" || dirty) return;
    const ok = window.confirm(
      `Publish version ${props.version}? New seasons will play and pay by it, pack prices change straight away, and it can never be changed afterwards.`,
    );
    if (!ok) return;
    startTransition(async () => {
      setMessage(null);
      const res = await publishBalance(props.version as number);
      if (!res.ok) return setMessage({ kind: "error", text: res.error });
      setMessage({
        kind: "ok",
        text: `Version ${res.data.version} is now live.`,
      });
      router.refresh();
    });
  };

  const field = (path: string, limit: Limit) => (
    <NumberField
      key={path}
      path={path}
      limit={limit}
      value={fields[path] ?? ""}
      live={liveFields[path] ?? ""}
      fallback={defaultFields[path] ?? ""}
      onChange={(v) => set(path, v)}
    />
  );

  const { payouts } = settings;
  // A middling season: 22 league matches, about 36% wins and 27% draws.
  const typicalSeason =
    22 * payouts.perMatch +
    Math.round(22 * 0.36) * payouts.win +
    Math.round(22 * 0.27) * payouts.draw;

  return (
    <div className="flex flex-col gap-6">
      {props.status !== "draft" && (
        <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200">
          {props.status === "published"
            ? "This version is published and frozen. Saving creates a new draft from it."
            : "No versions yet: these are the built-in defaults. Saving creates draft version 1."}
        </p>
      )}

      <p className="text-xs text-zinc-500">
        Under each box: the live value, and the built-in default. Boxes that
        differ from the live version are highlighted.
      </p>

      {TUNING_GROUPS.map(([title, keys]) => (
        <fieldset key={title} className="flex flex-col gap-3">
          <legend className="mb-2 text-lg font-semibold">{title}</legend>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {keys.map((k) => field(`tuning.${k}`, TUNING_LIMITS[k]))}
          </div>
        </fieldset>
      ))}

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-lg font-semibold">Season payouts</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(Object.keys(PAYOUT_LIMITS) as (keyof PayoutSettings)[]).map((k) =>
            field(`payouts.${k}`, PAYOUT_LIMITS[k]),
          )}
        </div>
        {errors.length === 0 && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            A middling 22-match season (about 8 wins and 6 draws) pays{" "}
            <strong className="tabular-nums">
              {typicalSeason.toLocaleString("en-US")}
            </strong>
            , before playoff bonuses.
          </p>
        )}
      </fieldset>

      <fieldset className="flex flex-col gap-3">
        <legend className="mb-2 text-lg font-semibold">Pack prices</legend>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {BOUGHT_TIERS.map((t) =>
            field(`packs.tiers.${t.id}`, {
              ...PACK_PRICE_LIMIT,
              label: `${t.name} pack`,
            }),
          )}
          {field("packs.focusSurcharge", FOCUS_SURCHARGE_LIMIT)}
        </div>
        <p className="text-xs text-zinc-500">
          Odds of player skill stay as published in the shop.
        </p>
      </fieldset>

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
              placeholder="e.g. Bigger win bonus"
              className="min-w-0 flex-1 rounded-md border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
            />
          </label>
          <button
            type="button"
            onClick={runTest}
            disabled={pending || errors.length > 0}
            className={secondary}
          >
            {pending ? "Working…" : "Test (1,500 matches)"}
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
            Publish
            {props.status === "draft" ? ` version ${props.version}` : ""}
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

      {test && <TestTable result={test} />}
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
  const id = `balance-${path}`;
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
