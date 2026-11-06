"use client";

import type { BaseballSquadPlayer } from "@lfs/game/baseball-squad";
import {
  autoPickSquad,
  type BaseballSquad,
  type BatterPosition,
  BENCH_ROLE_NAMES,
  BENCH_ROLES,
  type BenchRole,
  BULLPEN_MAX,
  battingRating,
  fieldingRating,
  LINEUP_SLOTS,
  LINEUP_STYLE_NAMES,
  LINEUP_STYLES,
  type LineupStyle,
  overallAt,
  PITCH_LIMIT_RANGE,
  ROTATION_SIZE,
  squadFromPicked,
  squadProblems,
} from "@lfs/sport-baseball";
import { useMemo, useState, useTransition } from "react";
import { saveBaseballSquad } from "../actions";

const box =
  "flex flex-col gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800";
const select =
  "min-w-0 rounded border border-zinc-300 bg-transparent px-1 py-0.5 text-sm dark:border-zinc-700";
const small =
  "rounded border border-zinc-300 px-1.5 text-xs hover:bg-zinc-100 disabled:opacity-30 dark:border-zinc-700 dark:hover:bg-zinc-900";

/** The rotation's five fixed places. */
const ROTATION_SLOTS = ["first", "second", "third", "fourth", "fifth"].slice(
  0,
  ROTATION_SIZE,
);

/** Moves item `i` one place up (-1) or down (+1). */
function move<T>(list: readonly T[], i: number, by: -1 | 1): T[] {
  const j = i + by;
  if (j < 0 || j >= list.length) return [...list];
  const next = [...list];
  [next[i], next[j]] = [next[j] as T, next[i] as T];
  return next;
}

/**
 * The game-day squad (ADR 0009 §8, D196, D212). Every change is checked by
 * the engine as you go; Save sends it to the server, which checks again.
 */
export function SquadBuilder({
  players,
  initial,
  saved,
  benchMax,
}: {
  players: BaseballSquadPlayer[];
  initial: BaseballSquad;
  saved: boolean;
  benchMax: number;
}) {
  const [squad, setSquad] = useState<BaseballSquad>(initial);
  const [dirty, setDirty] = useState(!saved);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const byId = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  const batters = players.filter((p) => p.primaryPosition !== "P");
  const pitchers = players.filter((p) => p.primaryPosition === "P");
  const problems = squadProblems(squad, players, benchMax);
  const used = new Set([
    ...squad.order.map((b) => b.id),
    ...squad.rotation,
    ...squad.bullpen,
    ...squad.bench.map((b) => b.id),
  ]);

  const update = (next: Partial<BaseballSquad>) => {
    setSquad((s) => ({ ...s, ...next }));
    setDirty(true);
    setMessage(null);
  };
  const autoPick = (style: LineupStyle) =>
    update(
      squadFromPicked(
        autoPickSquad(players, {
          style,
          available: (id) => (byId.get(id)?.injuredDays ?? 0) === 0,
        }),
        style,
      ),
    );
  const save = () =>
    startTransition(async () => {
      setError(null);
      const r = await saveBaseballSquad(squad);
      if (r.ok) {
        setDirty(false);
        setMessage("Squad saved.");
      } else setError(r.error);
    });

  const name = (id: string | null) =>
    id ? (byId.get(id)?.displayName ?? "?") : "—";
  const flags = (p: BaseballSquadPlayer | undefined) =>
    !p
      ? ""
      : `${p.injuredDays > 0 ? ` · injured ${p.injuredDays}d` : ""}${p.restDays > 0 ? ` · rests ${p.restDays}d` : ""}`;
  const batterLabel = (p: BaseballSquadPlayer) =>
    `${p.displayName} (${p.primaryPosition}${p.secondaryPosition ? `/${p.secondaryPosition}` : ""} · ${p.bats}/${p.throws} · ${p.overall})${flags(p)}`;
  const pitcherLabel = (p: BaseballSquadPlayer) =>
    `${p.displayName} (${p.pitcherRole === "reliever" ? "RP" : "SP"} · T${p.throws} · SP ${overallAt(p.attributes, "SP")} / RP ${overallAt(p.attributes, "RP")})${flags(p)}`;
  /** A player the slot can take: unused, or the one already there. */
  const options = (
    list: BaseballSquadPlayer[],
    current: string | null,
    label: (p: BaseballSquadPlayer) => string,
  ) =>
    list
      .filter((p) => p.id === current || !used.has(p.id))
      .map((p) => (
        <option key={p.id} value={p.id}>
          {label(p)}
        </option>
      ));

  return (
    <div className="flex flex-col gap-4">
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-2 rounded-md border border-zinc-200 bg-white/95 p-3 text-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95">
        <label className="flex items-center gap-1">
          Lineup style
          <select
            className={select}
            value={squad.style}
            onChange={(e) => update({ style: e.target.value as LineupStyle })}
          >
            {LINEUP_STYLES.map((s) => (
              <option key={s} value={s}>
                {LINEUP_STYLE_NAMES[s]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => autoPick(squad.style)}
          className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          title="Bat first leans to hitters, Glove first to fielders"
        >
          Auto-pick
        </button>
        <span className="flex-1" />
        {problems.length === 0 ? (
          <span className="text-emerald-700 dark:text-emerald-400">
            Ready to play
          </span>
        ) : (
          <span className="text-amber-700 dark:text-amber-400">
            {problems.length} to fix
          </span>
        )}
        <button
          type="button"
          disabled={pending || problems.length > 0 || !dirty}
          onClick={save}
          className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Saving…" : dirty ? "Save squad" : "Saved"}
        </button>
      </div>
      {problems.length > 0 && (
        <ul className="list-disc pl-5 text-sm text-amber-700 dark:text-amber-400">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {message && (
        <p className="text-sm text-emerald-700 dark:text-emerald-400">
          {message}
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className={box}>
          <h2 className="font-semibold">Batting order</h2>
          <p className="text-xs text-zinc-500">
            Bat and Field are at the position he plays (D212).
          </p>
          <table className="w-full text-sm">
            <thead className="text-left text-xs text-zinc-500">
              <tr>
                <th className="py-1">#</th>
                <th>Batter</th>
                <th>Pos</th>
                <th className="text-right">Bat</th>
                <th className="text-right">Field</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {squad.order.map((b, i) => {
                const p = byId.get(b.id);
                const field = p
                  ? fieldingRating(p.attributes, b.slot as BatterPosition)
                  : null;
                return (
                  <tr key={`${i}-${b.id}`}>
                    <td className="py-1 pr-1 text-zinc-500">{i + 1}</td>
                    <td className="pr-1">
                      <select
                        className={`${select} w-full`}
                        value={b.id}
                        onChange={(e) =>
                          update({
                            order: squad.order.map((x, j) =>
                              j === i ? { ...x, id: e.target.value } : x,
                            ),
                          })
                        }
                        aria-label={`Batter ${i + 1}`}
                      >
                        {options(batters, b.id, batterLabel)}
                      </select>
                    </td>
                    <td className="pr-1">
                      <select
                        className={select}
                        value={b.slot}
                        onChange={(e) =>
                          update({
                            order: squad.order.map((x, j) =>
                              j === i
                                ? {
                                    ...x,
                                    slot: e.target.value as BatterPosition,
                                  }
                                : x,
                            ),
                          })
                        }
                        aria-label={`Position of batter ${i + 1}`}
                      >
                        {LINEUP_SLOTS.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="text-right">
                      {p ? battingRating(p.attributes) : "–"}
                    </td>
                    <td className="text-right">{field ?? "–"}</td>
                    <td className="whitespace-nowrap pl-1 text-right">
                      <button
                        type="button"
                        className={small}
                        disabled={i === 0}
                        onClick={() =>
                          update({ order: move(squad.order, i, -1) })
                        }
                        aria-label="Bat earlier"
                      >
                        ↑
                      </button>{" "}
                      <button
                        type="button"
                        className={small}
                        disabled={i === squad.order.length - 1}
                        onClick={() =>
                          update({ order: move(squad.order, i, 1) })
                        }
                        aria-label="Bat later"
                      >
                        ↓
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col gap-4">
          <div className={box}>
            <h2 className="font-semibold">Rotation</h2>
            <p className="text-xs text-zinc-500">
              {ROTATION_SIZE} starters take turns, in this order.
            </p>
            <ol className="flex flex-col gap-1 text-sm">
              {ROTATION_SLOTS.map((slot, i) => {
                const current = squad.rotation[i] ?? "";
                return (
                  <li key={slot} className="flex items-center gap-2">
                    <span className="w-4 text-zinc-500">{i + 1}</span>
                    <select
                      className={`${select} flex-1`}
                      value={current}
                      onChange={(e) => {
                        const next = [...squad.rotation];
                        next[i] = e.target.value;
                        update({ rotation: next.filter(Boolean) });
                      }}
                      aria-label={`Starter ${i + 1}`}
                    >
                      <option value="">—</option>
                      {options(pitchers, current || null, pitcherLabel)}
                    </select>
                    <button
                      type="button"
                      className={small}
                      disabled={i === 0 || !current}
                      onClick={() =>
                        update({ rotation: move(squad.rotation, i, -1) })
                      }
                      aria-label="Earlier in the rotation"
                    >
                      ↑
                    </button>
                  </li>
                );
              })}
            </ol>
          </div>

          <div className={box}>
            <h2 className="font-semibold">Bullpen</h2>
            <div className="flex flex-wrap gap-3 text-sm">
              <label className="flex items-center gap-1">
                Closer
                <select
                  className={select}
                  value={squad.closer ?? ""}
                  onChange={(e) => update({ closer: e.target.value || null })}
                >
                  <option value="">None</option>
                  {squad.bullpen.map((id) => (
                    <option key={id} value={id}>
                      {name(id)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1">
                Setup
                <select
                  className={select}
                  value={squad.setup ?? ""}
                  onChange={(e) => update({ setup: e.target.value || null })}
                >
                  <option value="">None</option>
                  {squad.bullpen.map((id) => (
                    <option key={id} value={id}>
                      {name(id)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1">
                Starter's pitch limit
                <input
                  type="number"
                  min={PITCH_LIMIT_RANGE[0]}
                  max={PITCH_LIMIT_RANGE[1]}
                  value={squad.starterPitchLimit}
                  onChange={(e) =>
                    update({ starterPitchLimit: Number(e.target.value) })
                  }
                  className={`${select} w-16`}
                />
              </label>
            </div>
            <p className="text-xs text-zinc-500">
              Up to {BULLPEN_MAX} relievers, in the order they come in. The
              closer takes the 9th and the setup man the 8th with a lead of 3 or
              fewer.
            </p>
            <ol className="flex flex-col gap-1 text-sm">
              {[...squad.bullpen, ""]
                .slice(0, BULLPEN_MAX)
                .map((current, i) => (
                  <li
                    key={`b${i}-${current}`}
                    className="flex items-center gap-2"
                  >
                    <span className="w-4 text-zinc-500">{i + 1}</span>
                    <select
                      className={`${select} flex-1`}
                      value={current}
                      onChange={(e) => {
                        const next = [...squad.bullpen];
                        next[i] = e.target.value;
                        const bullpen = next.filter(Boolean);
                        update({
                          bullpen,
                          closer:
                            squad.closer && bullpen.includes(squad.closer)
                              ? squad.closer
                              : null,
                          setup:
                            squad.setup && bullpen.includes(squad.setup)
                              ? squad.setup
                              : null,
                        });
                      }}
                      aria-label={`Reliever ${i + 1}`}
                    >
                      <option value="">
                        {current ? "Remove" : "Add a reliever"}
                      </option>
                      {options(pitchers, current || null, pitcherLabel)}
                    </select>
                    {current && (
                      <span className="text-xs text-zinc-500">
                        {current === squad.closer
                          ? "CL"
                          : current === squad.setup
                            ? "SU"
                            : ""}
                      </span>
                    )}
                  </li>
                ))}
            </ol>
          </div>
        </div>
      </div>

      <div className={box}>
        <h2 className="font-semibold">Bench</h2>
        <p className="text-xs text-zinc-500">
          Up to {benchMax}, each with a role. A role can name the starter it
          replaces; otherwise the game picks who needs it most.
        </p>
        <ul className="flex flex-col gap-1 text-sm">
          {[...squad.bench, null].slice(0, benchMax).map((b, i) => (
            <li
              key={`bench${i}-${b?.id ?? "new"}`}
              className="flex flex-wrap items-center gap-2"
            >
              <select
                className={`${select} min-w-48 flex-1`}
                value={b?.id ?? ""}
                onChange={(e) => {
                  const next = [...squad.bench];
                  if (!e.target.value) next.splice(i, 1);
                  else
                    next[i] = {
                      id: e.target.value,
                      role: b?.role ?? "injury",
                      ...(b?.replaces ? { replaces: b.replaces } : {}),
                    };
                  update({ bench: next });
                }}
                aria-label={`Bench player ${i + 1}`}
              >
                <option value="">{b ? "Remove" : "Add a bench player"}</option>
                {options(batters, b?.id ?? null, batterLabel)}
              </select>
              {b && (
                <>
                  <select
                    className={select}
                    value={b.role}
                    onChange={(e) =>
                      update({
                        bench: squad.bench.map((x, j) =>
                          j === i
                            ? { ...x, role: e.target.value as BenchRole }
                            : x,
                        ),
                      })
                    }
                    aria-label="Role"
                  >
                    {BENCH_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {BENCH_ROLE_NAMES[r]}
                      </option>
                    ))}
                  </select>
                  <select
                    className={select}
                    value={b.replaces ?? ""}
                    onChange={(e) =>
                      update({
                        bench: squad.bench.map((x, j) =>
                          j === i
                            ? e.target.value
                              ? {
                                  id: x.id,
                                  role: x.role,
                                  replaces: e.target.value,
                                }
                              : { id: x.id, role: x.role }
                            : x,
                        ),
                      })
                    }
                    aria-label="Replaces"
                  >
                    <option value="">For anyone</option>
                    {squad.order.map((o) => (
                      <option key={o.id} value={o.id}>
                        For {name(o.id)} ({o.slot})
                      </option>
                    ))}
                  </select>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
