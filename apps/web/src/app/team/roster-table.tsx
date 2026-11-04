"use client";

import { resalePrice } from "@lfs/core";
import { POSITIONS, ROSTER_MIN } from "@lfs/sport-soccer";
import { useState } from "react";
import { ConditionBadge } from "@/components/condition-badge";
import { FormLabel } from "@/components/form-label";
import { ChemistryDot, PlayerCard } from "@/components/player/player-card";
import { SortHeader } from "@/components/sort-header";
import { nextSort, type SortState, sortRows } from "@/lib/table-sort";
import type { RosterPlayer } from "@/lib/team";
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

/**
 * The roster, sortable by any column (D109), with who is in the matchday
 * squad, free release and bulk resale (D49, D54).
 */
export function RosterTable({
  players,
  squad,
}: {
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
  const canRemove = players.length > ROSTER_MIN;

  const remove = (p: RosterPlayer, mode: "release" | "sell") => {
    const question =
      mode === "sell"
        ? `Sell ${p.displayName} for ${money(resalePrice(p.worth))}? This can't be undone.`
        : `Release ${p.displayName} for free? This can't be undone.`;
    if (window.confirm(question))
      run(() => removePlayer({ playerId: p.id, mode }));
  };

  const button =
    "rounded border border-zinc-300 px-2 py-0.5 text-xs hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-900";

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[60rem] text-left text-sm">
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
                label="Name"
                column="name"
                sort={sort}
                onSort={onSort}
                firstDir="asc"
              />
              <SortHeader
                label="Squad"
                column="squad"
                sort={sort}
                onSort={onSort}
                firstDir="asc"
                title="Sort by matchday squad: starters, then the bench"
              />
              <th className="px-3 py-2">Nat</th>
              <SortHeader
                label="Age"
                column="age"
                sort={sort}
                onSort={onSort}
                firstDir="asc"
                align="right"
              />
              <SortHeader
                label="Overall"
                column="overall"
                sort={sort}
                onSort={onSort}
                align="right"
              />
              <SortHeader
                label="Potential"
                column="potential"
                sort={sort}
                onSort={onSort}
                align="right"
                title="Sort by the top of the potential range"
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
              <th className="px-3 py-2">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr
                key={p.id}
                className="border-t border-zinc-200 dark:border-zinc-800"
              >
                <td className="px-3 py-2 font-medium">
                  {p.primaryPosition}
                  {p.secondaryPosition && (
                    <span className="text-zinc-500">
                      {" "}
                      / {p.secondaryPosition}
                    </span>
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <span className="inline-flex items-center gap-1.5">
                    <ChemistryDot color={p.chemistryColor} />
                    <PlayerCard
                      player={{
                        ...p,
                        fitness: p.condition.fitness,
                      }}
                    />
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <SquadBadge role={squad[p.id]} />
                </td>
                <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                  {p.nationality}
                </td>
                <td className="px-3 py-2 text-right">{p.age}</td>
                <td className="px-3 py-2 text-right font-semibold">
                  {p.overall}
                </td>
                <td className="px-3 py-2 text-right">
                  {p.potentialRange[0]}–{p.potentialRange[1]}
                </td>
                <td className="px-3 py-2 text-right">{money(p.worth)}</td>
                <td className="px-3 py-2 text-right">
                  <FormLabel form={p.form} />
                </td>
                <td className="px-3 py-2 text-right">
                  <ConditionBadge condition={p.condition} compact />
                </td>
                <td className="px-3 py-2">
                  <div className="flex justify-end gap-1 whitespace-nowrap">
                    {!p.fromStarterPack && (
                      <button
                        type="button"
                        disabled={pending || !canRemove}
                        onClick={() => remove(p, "sell")}
                        className={button}
                      >
                        Sell {money(resalePrice(p.worth))}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={pending || !canRemove}
                      onClick={() => remove(p, "release")}
                      className={button}
                    >
                      Release
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
