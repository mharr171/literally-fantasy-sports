"use client";

import { POSITIONS, type Position } from "@lfs/sport-soccer";
import { type ReactNode, useState } from "react";
import { ChemistryDot, PlayerCard } from "@/components/player/player-card";
import { SortHeader } from "@/components/sort-header";
import { CHEMISTRY_COLORS } from "@/lib/chemistry-colors";
import { matchesFilter, NO_FILTER, type ScoutFilter } from "@/lib/scout-filter";
import type { ScoutedPlayer } from "@/lib/scouting";
import { nextSort, type SortState, sortRows } from "@/lib/table-sort";

export interface ScoutRow {
  /** Unique per row, e.g. "<pack id>:<index>". */
  key: string;
  player: ScoutedPlayer;
  ticked: boolean;
  /** Which pack the player came from, when there are several. */
  pack?: string;
  /** Anything extra at the end of the row, e.g. "sell 300". */
  note?: ReactNode;
}

type Column =
  | "pos"
  | "second"
  | "color"
  | "name"
  | "age"
  | "overall"
  | "potLow"
  | "potHigh"
  | "pack";

const posIndex = (p: Position | null) =>
  p === null ? null : POSITIONS.indexOf(p);

/**
 * Every opened player in one table (D108): tick to keep, filter by position
 * (primary or secondary), chemistry colour or ticks, and sort by any column.
 * Potential is the scout's shown range, never the hidden value.
 */
export function ScoutTable({
  rows,
  onToggle,
  tickLabel = "Keep",
}: {
  rows: ScoutRow[];
  onToggle: (key: string) => void;
  tickLabel?: string;
}) {
  const [filter, setFilter] = useState<ScoutFilter>(NO_FILTER);
  const [sort, setSort] = useState<SortState<Column>>({
    key: "overall",
    dir: "desc",
  });
  const onSort = (column: Column, firstDir: "asc" | "desc") =>
    setSort((s) => nextSort(s, column, firstDir));
  const showPack = rows.some((r) => r.pack);
  const visible = sortRows(
    rows.filter((r) => matchesFilter(r.player, r.ticked, filter)),
    sort,
    {
      pos: (r) => posIndex(r.player.primaryPosition),
      second: (r) => posIndex(r.player.secondaryPosition),
      color: (r) => r.player.chemistryColor,
      name: (r) => r.player.displayName,
      age: (r) => r.player.age,
      overall: (r) => r.player.overall,
      potLow: (r) => r.player.potentialRange[0],
      potHigh: (r) => r.player.potentialRange[1],
      pack: (r) => r.pack ?? null,
    },
  );
  const filtered =
    filter.position !== null || filter.color !== null || filter.tickedOnly;
  const select =
    "rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700";

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <label className="flex items-center gap-1.5">
          Position
          <select
            value={filter.position ?? ""}
            onChange={(e) =>
              setFilter((f) => ({
                ...f,
                position: (e.target.value || null) as Position | null,
              }))
            }
            className={select}
          >
            <option value="">Any</option>
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          Colour
          <select
            value={filter.color ?? ""}
            onChange={(e) =>
              setFilter((f) => ({
                ...f,
                color: e.target.value === "" ? null : Number(e.target.value),
              }))
            }
            className={select}
          >
            <option value="">Any</option>
            {CHEMISTRY_COLORS.map((c, i) => (
              <option key={c.name} value={i}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-1.5">
          <input
            type="checkbox"
            checked={filter.tickedOnly}
            onChange={(e) =>
              setFilter((f) => ({ ...f, tickedOnly: e.target.checked }))
            }
          />
          Ticked only
        </label>
        <span className="text-zinc-500 tabular-nums">
          {visible.length === rows.length
            ? `${rows.length} players`
            : `${visible.length} of ${rows.length} players`}
        </span>
        {filtered && (
          <button
            type="button"
            onClick={() => setFilter(NO_FILTER)}
            className="text-sm underline"
          >
            Clear filters
          </button>
        )}
      </div>
      <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[48rem] text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">{tickLabel}</th>
              <SortHeader
                label="Pos"
                column="pos"
                sort={sort}
                onSort={onSort}
                firstDir="asc"
              />
              <SortHeader
                label="2nd"
                column="second"
                sort={sort}
                onSort={onSort}
                firstDir="asc"
                title="Sort by secondary position"
              />
              <SortHeader
                label="Colour"
                column="color"
                sort={sort}
                onSort={onSort}
                firstDir="asc"
                title="Sort by chemistry colour"
              />
              <SortHeader
                label="Name"
                column="name"
                sort={sort}
                onSort={onSort}
                firstDir="asc"
              />
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
                label="Pot low"
                column="potLow"
                sort={sort}
                onSort={onSort}
                align="right"
                title="Sort by the bottom of the potential range"
              />
              <SortHeader
                label="Pot high"
                column="potHigh"
                sort={sort}
                onSort={onSort}
                align="right"
                title="Sort by the top of the potential range"
              />
              {showPack && (
                <SortHeader
                  label="Pack"
                  column="pack"
                  sort={sort}
                  onSort={onSort}
                  firstDir="asc"
                />
              )}
              {rows.some((r) => r.note) && (
                <th className="px-3 py-2">
                  <span className="sr-only">Note</span>
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {visible.map((r) => {
              const id = `scout-${r.key}`;
              const p = r.player;
              return (
                <tr
                  key={r.key}
                  className={`border-t border-zinc-200 dark:border-zinc-800 ${r.ticked ? "bg-emerald-50 dark:bg-emerald-950/30" : ""}`}
                >
                  <td className="px-3 py-1.5">
                    <input
                      id={id}
                      type="checkbox"
                      checked={r.ticked}
                      onChange={() => onToggle(r.key)}
                      aria-label={`${tickLabel} ${p.displayName}`}
                    />
                  </td>
                  <td className="px-3 py-1.5 font-medium">
                    {p.primaryPosition}
                  </td>
                  <td className="px-3 py-1.5 text-zinc-500">
                    {p.secondaryPosition ?? "—"}
                  </td>
                  <td className="px-3 py-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <ChemistryDot color={p.chemistryColor} />
                      <span className="text-xs text-zinc-600 dark:text-zinc-400">
                        {CHEMISTRY_COLORS[p.chemistryColor]?.name}
                      </span>
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-3 py-1.5">
                    <PlayerCard player={p} />{" "}
                    <span className="text-xs text-zinc-500">
                      {p.nationality}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {p.age}
                  </td>
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums">
                    {p.overall}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {p.potentialRange[0]}
                  </td>
                  <td className="px-3 py-1.5 text-right tabular-nums">
                    {p.potentialRange[1]}
                  </td>
                  {showPack && (
                    <td className="whitespace-nowrap px-3 py-1.5 text-xs text-zinc-500">
                      {r.pack}
                    </td>
                  )}
                  {rows.some((x) => x.note) && (
                    <td className="whitespace-nowrap px-3 py-1.5 text-right text-xs text-zinc-500">
                      {r.note}
                    </td>
                  )}
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td
                  colSpan={11}
                  className="px-3 py-6 text-center text-sm text-zinc-500"
                >
                  No players match these filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
