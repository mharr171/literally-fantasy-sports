"use client";

import type { ScoutedBaseballPlayer } from "@lfs/game/sports/baseball-players";
import {
  PACK_FOCUS_NAMES,
  type PackFocus,
  STARTER_MIN_BATTERS,
  STARTER_MIN_PITCHERS,
} from "@lfs/sport-baseball";
import { useMemo, useState, useTransition } from "react";
import { chemistryColor } from "@/lib/chemistry-colors";
import { confirmBaseballStarters, openBaseballPacks } from "./actions";

export interface BaseballScoutingPack {
  id: string;
  focus: PackFocus;
  /** Null while the pack is still sealed. */
  players: ScoutedBaseballPlayer[] | null;
}

type Filter = "all" | "starters" | "relievers" | "batters";
type SortKey = "overall" | "bat" | "field" | "age" | "potential";

const FILTERS: { id: Filter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "starters", label: "Starting pitchers" },
  { id: "relievers", label: "Relievers" },
  { id: "batters", label: "Batters" },
];
const SORTS: { id: SortKey; label: string }[] = [
  { id: "overall", label: "Overall" },
  { id: "bat", label: "Bat" },
  { id: "field", label: "Field" },
  { id: "potential", label: "Potential" },
  { id: "age", label: "Youngest" },
];

const isPitcher = (p: ScoutedBaseballPlayer) => p.primaryPosition === "P";
const positionLabel = (p: ScoutedBaseballPlayer) =>
  isPitcher(p)
    ? p.pitcherRole === "reliever"
      ? "RP"
      : "SP"
    : p.secondaryPosition
      ? `${p.primaryPosition}/${p.secondaryPosition}`
      : p.primaryPosition;

function ColorDot({ color }: { color: number }) {
  const c = chemistryColor(color);
  return (
    <span
      className={`inline-flex h-3 w-3 items-center justify-center rounded-full text-[8px] font-bold text-white ${c.swatch}`}
      title={`Chemistry colour: ${c.name}`}
      role="img"
      aria-label={c.name}
    >
      {c.letter}
    </span>
  );
}

/**
 * Initial scouting (D221): open the 16 starter packs, tick the 14 to 30
 * players to keep (at least 9 pitchers and 9 batters) and confirm. Only the
 * ticks go to the server.
 */
export function BaseballScouting({
  packs,
  min,
  max,
}: {
  packs: BaseballScoutingPack[];
  min: number;
  max: number;
}) {
  const [selection, setSelection] = useState<Record<string, number[]>>({});
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<SortKey>("overall");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const sealed = packs.filter((p) => !p.players).map((p) => p.id);
  const kept = useMemo(
    () =>
      packs.flatMap((pack) =>
        (selection[pack.id] ?? []).flatMap((i) => pack.players?.[i] ?? []),
      ),
    [packs, selection],
  );
  const pitchers = kept.filter(isPitcher).length;
  const batters = kept.length - pitchers;
  const countOk = kept.length >= min && kept.length <= max;
  const mixOk =
    pitchers >= STARTER_MIN_PITCHERS && batters >= STARTER_MIN_BATTERS;
  const canConfirm = sealed.length === 0 && countOk && mixOk && !pending;

  const rows = packs
    .flatMap((pack, n) =>
      (pack.players ?? []).map((player, i) => ({
        key: `${pack.id}:${i}`,
        packId: pack.id,
        index: i,
        player,
        pack: `${n + 1} · ${PACK_FOCUS_NAMES[pack.focus]}`,
      })),
    )
    .filter(({ player: p }) =>
      filter === "all"
        ? true
        : filter === "batters"
          ? !isPitcher(p)
          : isPitcher(p) &&
            (p.pitcherRole === "reliever") === (filter === "relievers"),
    )
    .sort((a, b) => {
      const v = (p: ScoutedBaseballPlayer) =>
        sort === "age"
          ? -p.age
          : sort === "potential"
            ? p.potentialRange[1]
            : sort === "overall"
              ? p.overall
              : (p[sort] ?? -1);
      return v(b.player) - v(a.player);
    });

  const run = (action: () => Promise<{ ok: boolean; error?: string }>) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) setError(result.error ?? "Something went wrong.");
    });
  const toggle = (packId: string, index: number) =>
    setSelection((s) => {
      const current = s[packId] ?? [];
      return {
        ...s,
        [packId]: current.includes(index)
          ? current.filter((i) => i !== index)
          : [...current, index],
      };
    });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">Scout your first squad</h2>
        <p className="max-w-2xl text-sm text-zinc-600 dark:text-zinc-400">
          Open all {packs.length} starter packs, then tick the {min} to {max}{" "}
          players you want to keep: at least {STARTER_MIN_PITCHERS} pitchers and{" "}
          {STARTER_MIN_BATTERS} batters, so you can set a rotation of 5 and a
          lineup of 9. Anyone you don&apos;t keep is released for free. Bat and
          Field show how a batter hits and fields at his position; potential is
          a scout&apos;s estimate.
        </p>
      </div>

      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-md border border-zinc-200 bg-white/95 p-3 text-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <span>
          Opened{" "}
          <strong>
            {packs.length - sealed.length}/{packs.length}
          </strong>
        </span>
        <span className={countOk ? "" : "text-amber-700 dark:text-amber-400"}>
          Kept <strong>{kept.length}</strong> ({min}–{max})
        </span>
        <span
          className={
            pitchers >= STARTER_MIN_PITCHERS
              ? "text-zinc-600 dark:text-zinc-400"
              : "text-amber-700 dark:text-amber-400"
          }
        >
          Pitchers {pitchers}
        </span>
        <span
          className={
            batters >= STARTER_MIN_BATTERS
              ? "text-zinc-600 dark:text-zinc-400"
              : "text-amber-700 dark:text-amber-400"
          }
        >
          Batters {batters}
        </span>
        <span className="flex-1" />
        {sealed.length > 0 && (
          <button
            type="button"
            disabled={pending}
            onClick={() => run(() => openBaseballPacks(sealed))}
            className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Open all {sealed.length}
          </button>
        )}
        <button
          type="button"
          disabled={!canConfirm}
          onClick={() => run(() => confirmBaseballStarters(selection))}
          className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Working…" : `Keep ${kept.length} players`}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      {sealed.length === 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded px-2 py-0.5 ${filter === f.id ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"}`}
            >
              {f.label}
            </button>
          ))}
          <label className="ml-auto flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
            Sort by
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortKey)}
              className="rounded border border-zinc-300 bg-transparent px-1 py-0.5 dark:border-zinc-700"
            >
              {SORTS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {sealed.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {packs.map((pack, n) =>
            pack.players ? null : (
              <button
                key={pack.id}
                type="button"
                disabled={pending}
                onClick={() => run(() => openBaseballPacks([pack.id]))}
                className="rounded-md border border-dashed border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 disabled:opacity-60 dark:border-zinc-700 dark:hover:bg-zinc-900"
              >
                Open pack {n + 1} · {PACK_FOCUS_NAMES[pack.focus]}
              </button>
            ),
          )}
        </div>
      )}

      {rows.length > 0 && (
        <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-sm">
            <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900">
              <tr>
                <th className="px-3 py-2">Keep</th>
                <th className="px-3 py-2">Player</th>
                <th className="px-3 py-2">Pos</th>
                <th className="px-3 py-2" title="Bats · Throws">
                  B/T
                </th>
                <th className="px-3 py-2 text-right">Age</th>
                <th className="px-3 py-2 text-right">OVR</th>
                <th className="px-3 py-2 text-right">Bat</th>
                <th className="px-3 py-2 text-right">Field</th>
                <th className="px-3 py-2 text-right">Potential</th>
                <th className="px-3 py-2">Pack</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ key, packId, index, player: p, pack }) => {
                const ticked = (selection[packId] ?? []).includes(index);
                return (
                  <tr
                    key={key}
                    className={`border-t border-zinc-100 dark:border-zinc-800 ${ticked ? "bg-emerald-50 dark:bg-emerald-950/40" : ""}`}
                  >
                    <td className="px-3 py-1.5">
                      <input
                        type="checkbox"
                        checked={ticked}
                        onChange={() => toggle(packId, index)}
                        aria-label={`Keep ${p.displayName}`}
                      />
                    </td>
                    <td className="px-3 py-1.5">
                      <span className="flex items-center gap-2">
                        <ColorDot color={p.chemistryColor} />
                        {p.displayName}
                        <span className="text-xs text-zinc-500">
                          {p.nationality}
                        </span>
                      </span>
                    </td>
                    <td className="px-3 py-1.5">{positionLabel(p)}</td>
                    <td className="px-3 py-1.5">
                      {p.bats}/{p.throws}
                    </td>
                    <td className="px-3 py-1.5 text-right">{p.age}</td>
                    <td className="px-3 py-1.5 text-right font-medium">
                      {p.overall}
                    </td>
                    <td className="px-3 py-1.5 text-right">{p.bat ?? "–"}</td>
                    <td className="px-3 py-1.5 text-right">{p.field ?? "–"}</td>
                    <td className="px-3 py-1.5 text-right">
                      {p.potentialRange[0]}–{p.potentialRange[1]}
                    </td>
                    <td className="px-3 py-1.5 text-xs text-zinc-500">
                      {pack}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
