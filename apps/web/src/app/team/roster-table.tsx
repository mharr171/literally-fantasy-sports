"use client";

import { resalePrice } from "@lfs/core";
import { POSITIONS, ROSTER_MIN } from "@lfs/sport-soccer";
import { useState } from "react";
import { FormLabel } from "@/components/form-label";
import { SortHeader } from "@/components/sort-header";
import { nextSort, type SortState, sortRows } from "@/lib/table-sort";
import type { RosterPlayer } from "@/lib/team";
import { ConditionBadge } from "@/sports/soccer/components/condition-badge";
import {
  ChemistryDot,
  PlayerCard,
} from "@/sports/soccer/components/player/player-card";
import { removePlayer } from "./actions";
import { useAction } from "./use-action";

const money = (n: number) => n.toLocaleString("en-US");

/** Where a player is in the saved matchday squad (D109). */
export type SquadRole = { kind: "starter"; slot: string } | { kind: "bench" };

type Column =
  | "pos"
  | "name"
  | "squad"
  | "age"
  | "overall"
  | "potential"
  | "worth"
  | "form"
  | "fitness";

const SQUAD_ORDER = { starter: 0, bench: 1 } as const;

/** Every way to sort the roster, for the "Sort by" menu. */
const SORTS: { key: Column; label: string; firstDir: "asc" | "desc" }[] = [
  { key: "pos", label: "Position", firstDir: "asc" },
  { key: "name", label: "Name", firstDir: "asc" },
  { key: "squad", label: "Matchday squad", firstDir: "asc" },
  { key: "age", label: "Age", firstDir: "asc" },
  { key: "overall", label: "Overall", firstDir: "desc" },
  { key: "potential", label: "Potential", firstDir: "desc" },
  { key: "worth", label: "Worth", firstDir: "desc" },
  { key: "form", label: "Form", firstDir: "desc" },
  { key: "fitness", label: "Fitness", firstDir: "desc" },
];

/**
 * The roster, sortable by any column (D109), with who is in the matchday
 * squad, free release and bulk resale (D49, D54).
 */
export function RosterTable({
  players,
  squad,
  rosterMin = ROSTER_MIN,
}: {
  /** The sport's minimum roster (D182): nobody can leave at or below it. */
  rosterMin?: number;
  players: RosterPlayer[];
  /** Matchday squad roles by player id; empty when no squad is saved. */
  squad: Record<string, SquadRole>;
}) {
  const { error, pending, run } = useAction();
  const [sort, setSort] = useState<SortState<Column>>({
    key: "pos",
    dir: "asc",
  });
  const onSort = (column: Column, firstDir: "asc" | "desc") =>
    setSort((s) => nextSort(s, column, firstDir));
  const rows = sortRows(players, sort, {
    // Keepers first, strikers last; best players first within a position.
    pos: (p) => POSITIONS.indexOf(p.primaryPosition) * 1000 - p.overall,
    name: (p) => p.displayName,
    squad: (p) => {
      const role = squad[p.id];
      return role ? SQUAD_ORDER[role.kind] : null;
    },
    age: (p) => p.age,
    overall: (p) => p.overall,
    potential: (p) => p.potentialRange[1],
    worth: (p) => p.worth,
    form: (p) => p.form,
    fitness: (p) => p.condition.fitness,
  });
  const canRemove = players.length > rosterMin;

  const remove = (p: RosterPlayer, mode: "release" | "sell") => {
    const question =
      mode === "sell"
        ? `Sell ${p.displayName} for ${money(resalePrice(p.worth))}? This can't be undone.`
        : `Release ${p.displayName} for free? This can't be undone.`;
    if (window.confirm(question))
      run(() => removePlayer({ playerId: p.id, mode }));
  };

  const button =
    "rounded border border-zinc-300 px-1.5 py-0.5 text-xs hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-900";

  const actions = (p: RosterPlayer) => (
    <div className="flex justify-end gap-1 whitespace-nowrap">
      {!p.fromStarterPack && (
        <button
          type="button"
          disabled={pending || !canRemove}
          onClick={() => remove(p, "sell")}
          className={button}
          title={`Sell for ${money(resalePrice(p.worth))}`}
        >
          Sell {money(resalePrice(p.worth))}
        </button>
      )}
      <button
        type="button"
        disabled={pending || !canRemove}
        onClick={() => remove(p, "release")}
        className={button}
        title="Release for free"
      >
        Release
      </button>
    </div>
  );
  const positions = (p: RosterPlayer) => (
    <>
      {p.primaryPosition}
      {p.secondaryPosition && (
        <span className="text-zinc-500"> / {p.secondaryPosition}</span>
      )}
    </>
  );
  const name = (p: RosterPlayer) => (
    <span className="inline-flex items-center gap-1.5">
      <ChemistryDot color={p.chemistryColor} />
      <PlayerCard player={{ ...p, fitness: p.condition.fitness }} />
    </span>
  );
  const sub = "block text-xs font-normal text-zinc-500";

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {/* Every column can be sorted from here, on any screen (D156). */}
      <label className="flex items-center gap-2 self-end text-sm">
        <span className="text-zinc-600 dark:text-zinc-400">Sort by</span>
        <select
          value={sort.key}
          onChange={(e) => {
            const c = SORTS.find((x) => x.key === e.target.value);
            if (c) setSort({ key: c.key, dir: c.firstDir });
          }}
          className="rounded-md border border-zinc-300 bg-[var(--background)] px-2 py-1 text-sm text-[var(--foreground)] dark:border-zinc-700"
        >
          {SORTS.map((c) => (
            <option key={c.key} value={c.key}>
              {c.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() =>
            setSort((s) => ({ ...s, dir: s.dir === "asc" ? "desc" : "asc" }))
          }
          className="rounded-md border border-zinc-300 px-2 py-1 dark:border-zinc-700"
          aria-label={
            sort.dir === "asc"
              ? "Ascending: switch to descending"
              : "Descending: switch to ascending"
          }
        >
          {sort.dir === "asc" ? "▲" : "▼"}
        </button>
      </label>

      {/* Laptops and up: a table that fits without scrolling sideways. */}
      <div className="hidden rounded-md border border-zinc-200 lg:block dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
            <tr>
              <SortHeader
                label="Pos"
                column="pos"
                sort={sort}
                onSort={onSort}
                firstDir="asc"
              />
              <SortHeader
                label="Player"
                column="name"
                sort={sort}
                onSort={onSort}
                firstDir="asc"
                title="Sort by name (nationality and age underneath)"
              />
              <SortHeader
                label="Squad"
                column="squad"
                sort={sort}
                onSort={onSort}
                firstDir="asc"
                title="Sort by matchday squad: starters, then the bench"
              />
              <SortHeader
                label="Overall"
                column="overall"
                sort={sort}
                onSort={onSort}
                align="right"
                title="Sort by overall (potential underneath)"
              />
              <SortHeader
                label="Worth"
                column="worth"
                sort={sort}
                onSort={onSort}
                align="right"
              />
              <SortHeader
                label="Form"
                column="form"
                sort={sort}
                onSort={onSort}
                align="right"
              />
              <SortHeader
                label="Condition"
                column="fitness"
                sort={sort}
                onSort={onSort}
                align="right"
                title="Sort by fitness"
              />
              <th className="px-3 py-2 text-right">Sell or release</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.id}
                className="border-t border-zinc-200 align-top dark:border-zinc-800"
              >
                <td className="whitespace-nowrap px-3 py-2 font-medium">
                  {positions(p)}
                </td>
                <td className="px-3 py-2">
                  {name(p)}
                  <span className={sub}>
                    {p.nationality} · {p.age}
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <SquadBadge role={squad[p.id]} />
                </td>
                <td className="px-3 py-2 text-right font-semibold tabular-nums">
                  {p.overall}
                  <span className={sub} title="Potential range">
                    {p.potentialRange[0]}–{p.potentialRange[1]}
                  </span>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {money(p.worth)}
                </td>
                <td className="whitespace-nowrap px-3 py-2 text-right">
                  <FormLabel form={p.form} />
                </td>
                <td className="px-3 py-2 text-right">
                  <ConditionBadge condition={p.condition} compact />
                </td>
                <td className="px-3 py-2">{actions(p)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Phones and tablets: one card per player (D156). */}
      <ul className="flex flex-col gap-2 lg:hidden">
        {rows.map((p) => (
          <li
            key={p.id}
            className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <span className="font-medium">{name(p)}</span>
                <span className={sub}>
                  {positions(p)} · {p.nationality} · {p.age}
                </span>
              </div>
              <SquadBadge role={squad[p.id]} />
            </div>
            <dl className="grid grid-cols-3 gap-x-3 gap-y-1 sm:grid-cols-5">
              <div>
                <dt className="text-xs text-zinc-500">Overall</dt>
                <dd className="font-semibold tabular-nums">{p.overall}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Potential</dt>
                <dd className="tabular-nums">
                  {p.potentialRange[0]}–{p.potentialRange[1]}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Worth</dt>
                <dd className="tabular-nums">{money(p.worth)}</dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Form</dt>
                <dd>
                  <FormLabel form={p.form} />
                </dd>
              </div>
              <div>
                <dt className="text-xs text-zinc-500">Condition</dt>
                <dd>
                  <ConditionBadge condition={p.condition} compact />
                </dd>
              </div>
            </dl>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-zinc-500">Sell or release</span>
              {actions(p)}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SquadBadge({ role }: { role: SquadRole | undefined }) {
  if (!role) return <span className="text-xs text-zinc-400">—</span>;
  return role.kind === "starter" ? (
    <span
      className="rounded bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200"
      title={`Starting at ${role.slot}`}
    >
      XI · {role.slot}
    </span>
  ) : (
    <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
      Bench
    </span>
  );
}
