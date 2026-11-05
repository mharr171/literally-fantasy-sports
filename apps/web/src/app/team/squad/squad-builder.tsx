"use client";

import {
  autoPickSquad,
  BENCH_SIZE,
  type Formation,
  formation as findFormation,
  LATEST_PLAN_MINUTE,
  lineupChemistry,
  type MatchdaySquad,
  MIN_PLAYERS,
  type PlannedSub,
  type Position,
  positionFit,
  registerFormations,
  type SlotSide,
  sideGrid,
  slotLabel,
  slotRating,
  squadProblems,
  squadScore,
  variantAt,
} from "@lfs/sport-soccer";
import { type DragEvent, useMemo, useState } from "react";
import { ChemistryShares } from "@/components/chemistry-shares";
import { ConditionBadge } from "@/components/condition-badge";
import { Heatmap } from "@/components/player/heatmap";
import { ChemistryDot, PlayerCardBody } from "@/components/player/player-card";
import { useTemplates } from "@/components/player/templates-context";
import { Popover } from "@/components/popover";
import { pickOptions } from "@/lib/pick-options";
import type { RosterPlayer } from "@/lib/team";
import { saveSquad } from "../actions";
import { useAction } from "../use-action";

type Slot = string | null;
type Loc =
  | { area: "lineup"; index: number }
  | { area: "bench"; index: number }
  | { area: "reserve"; id: string };

const CHEMISTRY_COLORS = [
  "bg-red-500",
  "bg-sky-500",
  "bg-emerald-500",
  "bg-amber-400",
  "bg-violet-500",
];
const FIT_STYLE = {
  primary: "text-emerald-700 dark:text-emerald-400",
  secondary: "text-amber-700 dark:text-amber-400",
  other: "text-red-700 dark:text-red-400",
} as const;
const MAX_PLAN = 5;

const pad = (ids: readonly string[], size: number): Slot[] =>
  Array.from({ length: size }, (_, i) => ids[i] ?? null);
const sameLoc = (a: Loc | null, b: Loc) =>
  a !== null &&
  a.area === b.area &&
  (a.area === "reserve"
    ? a.id === (b as { id: string }).id
    : a.index === (b as { index: number }).index);

function lastName(name: string) {
  const parts = name.split(" ");
  return parts.length > 1 ? parts.slice(1).join(" ") : name;
}

/** Drag-and-drop matchday squad builder with a sub plan (D88). */
export function SquadBuilder({
  roster,
  initial,
  saved,
  outOfPosition = 0,
  morale = 0,
  formations,
  benchMax = BENCH_SIZE,
}: {
  /** The sport's bench size (D182): up to this many substitutes. */
  benchMax?: number;
  /** Formations that are on, plus the saved one if it's off (D140). */
  formations: (Formation & { enabled: boolean })[];
  roster: RosterPlayer[];
  initial: MatchdaySquad;
  saved: boolean;
  /** The season's penalty for playing out of position (D135), 0 when off. */
  outOfPosition?: number;
  /** Team morale, −1 to 1, for today's score (D162). */
  morale?: number;
}) {
  // Admin-made formations (D140): the engine's checks run here too.
  registerFormations(formations);
  const byId = useMemo(() => new Map(roster.map((p) => [p.id, p])), [roster]);
  const rosterIds = useMemo(() => new Set(byId.keys()), [byId]);
  const keep = (ids: readonly string[]) => ids.filter((id) => byId.has(id));

  const [formationId, setFormationId] = useState(initial.formation);
  const [lineup, setLineup] = useState<Slot[]>(() =>
    // Slot by slot: an empty slot (D183) or a player who left stays empty.
    pad(
      initial.lineup.map((id) => (byId.has(id) ? id : "")),
      11,
    ).map((id) => id || null),
  );
  const [bench, setBench] = useState<Slot[]>(() =>
    pad(keep(initial.bench).slice(0, benchMax), benchMax),
  );
  const [plan, setPlan] = useState<PlannedSub[]>(initial.subPlan);
  const [selected, setSelected] = useState<Loc | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  const [coverage, setCoverage] = useState(false);
  const templates = useTemplates();
  const [dirty, setDirty] = useState(!saved);
  const { error, pending, run } = useAction();

  const shape = findFormation(formationId) ?? formations[0];
  const slots = shape?.slots ?? [];
  const picked = new Set([...lineup, ...bench].filter(Boolean) as string[]);
  const reserves = roster
    .filter((p) => !picked.has(p.id))
    .sort((a, b) => b.overall - a.overall);

  const squad: MatchdaySquad = {
    formation: formationId,
    // Empty starter slots are kept: the club plays a man down (D183).
    lineup: lineup.map((id) => id ?? ""),
    bench: bench.filter(Boolean) as string[],
    subPlan: plan,
  };
  const problems = squadProblems(squad, rosterIds, undefined, benchMax);
  const emptySlots = lineup.filter((id) => !id).length;

  const starters = lineup.map((id) => (id ? byId.get(id) : undefined));
  const present = starters.filter(Boolean) as RosterPlayer[];
  // Heatmaps (M5): the highlighted player's template in their slot, or the
  // whole starting 11 weighted by rating.
  const gridFor = (
    player: RosterPlayer,
    position: Position,
    side: SlotSide | undefined,
  ) => {
    if (!templates) return null;
    const own = variantAt(player, position);
    const variant = own ? templates.variants[position]?.[own] : undefined;
    // A left or right slot of a shared position uses that version (D112).
    return sideGrid(variant ?? templates.templates[position], side);
  };
  const focus = hover ?? (selected?.area === "lineup" ? selected.index : null);
  let overlayGrid: number[][] | null = null;
  if (coverage && templates) {
    const sum = Array.from({ length: 25 }, () => Array(17).fill(0) as number[]);
    slots.forEach((slot, i) => {
      const p = starters[i];
      const g = p ? gridFor(p, slot.position, slot.side) : null;
      if (!p || !g) return;
      const weight = slotRating(p, slot.position, outOfPosition);
      for (let r = 0; r < g.length; r++) {
        const row = g[r] as number[];
        const out = sum[r] as number[];
        for (let c = 0; c < row.length; c++)
          out[c] = (out[c] as number) + (row[c] as number) * weight;
      }
    });
    overlayGrid = sum;
  } else if (focus !== null) {
    const p = starters[focus];
    const slot = slots[focus];
    overlayGrid = p && slot ? gridFor(p, slot.position, slot.side) : null;
  }
  const selectedId = !selected
    ? null
    : selected.area === "lineup"
      ? (lineup[selected.index] ?? null)
      : selected.area === "bench"
        ? (bench[selected.index] ?? null)
        : selected.id || null;
  const selectedPlayer = selectedId ? byId.get(selectedId) : undefined;
  // Squad score (D110): the starting 11 in their slots, with chemistry;
  // "today" also counts this week's fitness, form and morale (D162).
  const weights = pickOptions(roster).weight ?? (() => 1);
  const score = squadScore(
    slots.flatMap((slot, i) => {
      const p = starters[i];
      return p
        ? [{ player: p, slot: slot.position, weight: weights(p.id) }]
        : [];
    }),
    undefined,
    undefined,
    { outOfPosition, morale },
  );
  const boosts = lineupChemistry(present);
  const chemistry = new Map(present.map((p, i) => [p.id, boosts[i] ?? 0]));

  const idAt = (loc: Loc): string | null =>
    loc.area === "lineup"
      ? (lineup[loc.index] ?? null)
      : loc.area === "bench"
        ? (bench[loc.index] ?? null)
        : loc.id || null;

  /** Swaps whoever is at `a` with whoever is at `b`; reserves fill or empty a place. */
  function swap(a: Loc, b: Loc) {
    if (sameLoc(a, b) || (a.area === "reserve" && b.area === "reserve")) return;
    const idA = idAt(a);
    const idB = idAt(b);
    const nextLineup = [...lineup];
    const nextBench = [...bench];
    const put = (loc: Loc, id: string | null) => {
      if (loc.area === "lineup") nextLineup[loc.index] = id;
      if (loc.area === "bench") nextBench[loc.index] = id;
    };
    // A reserve dropped on a place swaps in; the place's player goes to reserves.
    put(a, idB);
    put(b, idA);
    setLineup(nextLineup);
    setBench(nextBench);
    // Plan lines whose players moved out of the matchday 22 no longer apply.
    const onBench = new Set(nextBench);
    const inSquad = new Set([...nextLineup, ...nextBench]);
    setPlan((p) =>
      p.filter((s) => onBench.has(s.inId) && inSquad.has(s.outId)),
    );
    setDirty(true);
  }

  function choose(loc: Loc) {
    if (selected === null) {
      if (idAt(loc) || loc.area !== "reserve") setSelected(loc);
      return;
    }
    swap(selected, loc);
    setSelected(null);
  }

  const dragProps = (loc: Loc) => ({
    draggable: idAt(loc) !== null,
    onDragStart: (e: DragEvent) => {
      e.dataTransfer.setData("text/plain", JSON.stringify(loc));
      e.dataTransfer.effectAllowed = "move";
    },
    onDragOver: (e: DragEvent) => e.preventDefault(),
    onDrop: (e: DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      try {
        swap(JSON.parse(e.dataTransfer.getData("text/plain")) as Loc, loc);
        setSelected(null);
      } catch {
        // Not one of ours.
      }
    },
    onClick: () => choose(loc),
  });

  function autoPick(rotate = false) {
    const squad = autoPickSquad(roster, formationId, {
      ...pickOptions(roster, { rotate }),
      benchSize: benchMax,
    });
    setLineup(pad(squad.lineup, 11).map((id) => id || null));
    setBench(pad(squad.bench.slice(0, benchMax), benchMax));
    setPlan([]);
    setSelected(null);
    setDirty(true);
  }

  const name = (id: string | null) =>
    id ? (byId.get(id)?.displayName ?? "?") : "";
  const ring = (loc: Loc) =>
    sameLoc(selected, loc) ? "ring-2 ring-sky-500" : "";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3 rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
        <label className="flex items-center gap-2">
          Formation
          <select
            value={formationId}
            onChange={(e) => {
              setFormationId(e.target.value);
              setDirty(true);
            }}
            className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
          >
            {formations.map((f) => (
              <option key={f.id} value={f.id}>
                {f.enabled ? f.id : `${f.id} (turned off)`}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => autoPick()}
          className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Auto-pick best
        </button>
        <button
          type="button"
          onClick={() => autoPick(true)}
          title="Picks a fresh 22, resting tired starters when someone fitter is close"
          className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Rotated squad
        </button>
        <span className="inline-flex items-center gap-1 tabular-nums">
          Squad score <strong>{score.base.toFixed(1)}</strong>
          <span className="text-zinc-500">
            {" "}
            · today{" "}
            <strong
              className={
                score.today < score.base - 3
                  ? "text-amber-700 dark:text-amber-400"
                  : ""
              }
            >
              {score.today.toFixed(1)}
            </strong>
          </span>
          <Popover
            label="What the squad scores mean"
            width={288}
            trigger={<span aria-hidden="true">ⓘ</span>}
            triggerClassName="ml-0.5 rounded-full px-1 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
          >
            <div className="flex w-64 flex-col gap-2 text-sm">
              <p>
                <strong>Squad score</strong> is the average rating of your
                starting 11 in the slots you put them in: their overall there,
                plus +25% in their main position and +10% in their second
                {outOfPosition
                  ? `, ${Math.round(outOfPosition * 100)}% anywhere else`
                  : ""}
                , plus chemistry.
              </p>
              <p>
                <strong>Today</strong> is the same score counting this
                week&apos;s fitness, form and team morale, as the next match
                will. Fresh players in good form and a happy squad lift it above
                the squad score; tired or out-of-form players pull it down (it
                turns amber when it&apos;s more than 3 lower).
              </p>
            </div>
          </Popover>
        </span>
        <span className="flex-1" />
        <span className="text-zinc-600 dark:text-zinc-400">
          {problems.length > 0
            ? "Not ready"
            : dirty
              ? "Unsaved changes"
              : "Saved ✓"}
        </span>
        <button
          type="button"
          disabled={pending || problems.length > 0 || !dirty}
          onClick={() =>
            run(async () => {
              const result = await saveSquad(squad);
              if (result.ok) setDirty(false);
              return result;
            })
          }
          className="rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {pending ? "Saving…" : "Save squad"}
        </button>
      </div>
      {problems.length === 0 && emptySlots > 0 && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {emptySlots === 1
            ? "1 starting place is"
            : `${emptySlots} starting places are`}{" "}
          empty, so you&apos;ll play{" "}
          {emptySlots === 1 ? "a man" : `${emptySlots} men`} down
          {11 - emptySlots < MIN_PLAYERS
            ? ", and with fewer than 7 the match is forfeited 3–0"
            : ""}
          . Fill them from the bench or your reserves if you can.
        </p>
      )}
      {(problems.length > 0 || error) && (
        <ul
          role="alert"
          className="list-inside list-disc text-sm text-red-600 dark:text-red-400"
        >
          {error && <li>{error}</li>}
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,26rem)_1fr]">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={coverage}
                onChange={(e) => setCoverage(e.target.checked)}
              />
              Team coverage
            </label>
            <span className="text-xs text-zinc-500">
              {coverage
                ? "Where your starting 11 has influence, weighted by rating."
                : "Hover or tap a player on the pitch to see their heatmap."}
            </span>
          </div>
          {/* The pitch, attacking upwards. */}
          <div className="relative mx-auto aspect-[68/105] w-full max-w-md overflow-hidden rounded-md border-2 border-emerald-800 bg-emerald-700 dark:bg-emerald-900">
            <Heatmap
              grid={overlayGrid}
              overlay
              className="pointer-events-none absolute inset-0 h-full w-full"
              label={
                coverage
                  ? "Team coverage heatmap"
                  : "Heatmap of the highlighted player"
              }
            />
            <div className="absolute inset-x-0 top-1/2 h-px bg-white/40" />
            <div className="absolute left-1/2 top-1/2 h-1/5 w-1/3 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/40" />
            <div className="absolute bottom-0 left-1/2 h-[15%] w-1/2 -translate-x-1/2 border border-b-0 border-white/40" />
            <div className="absolute left-1/2 top-0 h-[15%] w-1/2 -translate-x-1/2 border border-t-0 border-white/40" />
            {slots.map((s, i) => {
              const loc: Loc = { area: "lineup", index: i };
              const player = starters[i];
              const boost = player ? (chemistry.get(player.id) ?? 0) : 0;
              return (
                <button
                  // biome-ignore lint/suspicious/noArrayIndexKey: slots are fixed by the formation
                  key={i}
                  type="button"
                  {...dragProps(loc)}
                  onPointerEnter={(e) =>
                    e.pointerType === "mouse" && setHover(i)
                  }
                  onPointerLeave={(e) =>
                    e.pointerType === "mouse" && setHover(null)
                  }
                  style={{ left: `${s.x}%`, bottom: `${s.y}%` }}
                  className={`absolute flex w-[22%] -translate-x-1/2 translate-y-1/2 cursor-pointer flex-col items-center rounded-md bg-white/95 px-1 py-0.5 text-center text-[11px] leading-tight text-zinc-900 shadow ${ring(loc)}`}
                >
                  <span className="font-semibold text-zinc-500">
                    {slotLabel(s)}
                  </span>
                  {player ? (
                    <>
                      <span className="flex w-full items-center justify-center gap-1 truncate font-medium">
                        <span
                          className={`inline-block h-2 w-2 shrink-0 rounded-full ${CHEMISTRY_COLORS[player.chemistryColor] ?? "bg-zinc-400"}`}
                        />
                        <span className="truncate">
                          {lastName(player.displayName)}
                        </span>
                      </span>
                      <ConditionBadge condition={player.condition} compact />
                      <span
                        className={FIT_STYLE[positionFit(player, s.position)]}
                      >
                        {slotRating(player, s.position, outOfPosition)}
                        {boost > 0 && (
                          <span className="text-sky-700">
                            {" "}
                            +{Math.round(boost * 100)}%
                          </span>
                        )}
                      </span>
                    </>
                  ) : (
                    <span className="text-zinc-400">empty</span>
                  )}
                </button>
              );
            })}
          </div>
          {selectedPlayer && (
            <div className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
              <PlayerCardBody
                player={{
                  ...selectedPlayer,
                  fitness: selectedPlayer.condition.fitness,
                }}
              />
              <p className="mt-2 text-xs text-zinc-500">
                Tap another player to swap them, or tap this one again to
                deselect.
              </p>
            </div>
          )}
        </div>

        <div className="flex flex-col gap-4">
          {/* Chemistry colors of the starting 11 and the roster (D139). */}
          <div className="grid gap-3 sm:grid-cols-2">
            <ChemistryShares title="Starting 11" players={present} />
            <ChemistryShares title="Whole roster" players={roster} />
          </div>
          <PlayerList
            title={`Bench (${squad.bench.length}/${benchMax})`}
            rows={bench.map((id, i) => ({
              loc: { area: "bench", index: i } as Loc,
              label: `S${i + 1}`,
              player: id ? byId.get(id) : undefined,
            }))}
            dragProps={dragProps}
            ring={ring}
          />
          <PlayerList
            title={`Not in the squad (${reserves.length})`}
            empty="Everyone is in the squad. Drop a player here to leave them out."
            rows={reserves.map((p) => ({
              loc: { area: "reserve", id: p.id } as Loc,
              label: "",
              player: p,
            }))}
            dragProps={dragProps}
            ring={ring}
            dropTarget={{ area: "reserve", id: "" }}
          />
          <SubPlan
            plan={plan}
            starters={squad.lineup}
            bench={squad.bench}
            name={name}
            onChange={(next) => {
              setPlan(next);
              setDirty(true);
            }}
          />
        </div>
      </div>
      <p className="text-xs text-zinc-500">
        Ratings show how good each player is in that slot:{" "}
        <span className={FIT_STYLE.primary}>green</span> in their main position
        (+25%), <span className={FIT_STYLE.secondary}>amber</span> in their
        second (+10%), <span className={FIT_STYLE.other}>red</span> out of
        position. Coloured dots are chemistry colours; blue numbers are the
        chemistry boost for starters who share a colour. Fitness carries over
        between weeks (+20 a week); injured (✚) and suspended (⛔) players are
        swapped out automatically when the match is played.
      </p>
    </div>
  );
}

function PlayerList({
  title,
  rows,
  dragProps,
  ring,
  empty,
  dropTarget,
}: {
  title: string;
  rows: { loc: Loc; label: string; player: RosterPlayer | undefined }[];
  dragProps: (loc: Loc) => object;
  ring: (loc: Loc) => string;
  empty?: string;
  dropTarget?: Loc;
}) {
  return (
    <div
      className="flex flex-col gap-1"
      {...(dropTarget
        ? {
            onDragOver: (e: DragEvent) => e.preventDefault(),
            onDrop: (
              dragProps(dropTarget) as { onDrop: (e: DragEvent) => void }
            ).onDrop,
          }
        : {})}
    >
      <h2 className="text-sm font-semibold">{title}</h2>
      {rows.length === 0 && empty && (
        <p className="rounded-md border border-dashed border-zinc-300 p-3 text-sm text-zinc-500 dark:border-zinc-700">
          {empty}
        </p>
      )}
      <ul className="grid gap-1 sm:grid-cols-2">
        {rows.map(({ loc, label, player }) => (
          <li
            key={loc.area === "reserve" ? loc.id : `${loc.area}-${loc.index}`}
          >
            <button
              type="button"
              {...dragProps(loc)}
              className={`grid w-full cursor-pointer grid-cols-[2rem_3rem_1fr_2rem_3rem] items-center gap-1 rounded border border-zinc-200 px-2 py-1 text-left text-sm hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900 ${ring(loc)}`}
            >
              <span className="text-xs text-zinc-500">{label}</span>
              <span className="font-medium">
                {player?.primaryPosition ?? ""}
              </span>
              <span className="flex items-center gap-1.5 truncate">
                {player && <ChemistryDot color={player.chemistryColor} />}
                {player?.displayName ?? (
                  <span className="text-zinc-400">empty</span>
                )}
              </span>
              <span className="text-right font-semibold tabular-nums">
                {player?.overall ?? ""}
              </span>
              <span className="text-right">
                {player && (
                  <ConditionBadge condition={player.condition} compact />
                )}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SubPlan({
  plan,
  starters,
  bench,
  name,
  onChange,
}: {
  plan: PlannedSub[];
  starters: string[];
  bench: string[];
  name: (id: string | null) => string;
  onChange: (plan: PlannedSub[]) => void;
}) {
  const update = (i: number, change: Partial<PlannedSub>) =>
    onChange(plan.map((s, j) => (j === i ? { ...s, ...change } : s)));
  const select =
    "min-w-0 rounded-md border border-zinc-300 bg-transparent px-1 py-1 text-sm dark:border-zinc-700";
  return (
    <div className="flex flex-col gap-2">
      <div>
        <h2 className="text-sm font-semibold">Sub plan</h2>
        <p className="text-xs text-zinc-500">
          Planned changes happen first; the engine also subs for injuries and
          tiredness. Up to 5 subs in up to 3 different minutes.
        </p>
      </div>
      {plan.map((s, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: plan lines have no id
          key={i}
          className="grid grid-cols-[4.5rem_1fr_1fr_auto] items-center gap-2"
        >
          <label className="flex items-center gap-1 text-sm">
            <input
              type="number"
              min={1}
              max={LATEST_PLAN_MINUTE}
              value={s.minute}
              onChange={(e) => update(i, { minute: Number(e.target.value) })}
              className="w-12 rounded-md border border-zinc-300 bg-transparent px-1 py-1 dark:border-zinc-700"
              aria-label="Minute"
            />
            &apos;
          </label>
          <select
            aria-label="Player off"
            value={s.outId}
            onChange={(e) => update(i, { outId: e.target.value })}
            className={select}
          >
            {[...starters, ...bench].map((id) => (
              <option key={id} value={id}>
                Off: {name(id)}
              </option>
            ))}
          </select>
          <select
            aria-label="Player on"
            value={s.inId}
            onChange={(e) => update(i, { inId: e.target.value })}
            className={select}
          >
            {bench.map((id) => (
              <option key={id} value={id}>
                On: {name(id)}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => onChange(plan.filter((_, j) => j !== i))}
            className="rounded border border-zinc-300 px-2 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            aria-label="Remove this substitution"
          >
            ✕
          </button>
        </div>
      ))}
      {plan.length < MAX_PLAN && starters.length > 0 && bench.length > 0 && (
        <button
          type="button"
          onClick={() => {
            const used = new Set(plan.map((s) => s.inId));
            const offUsed = new Set(plan.map((s) => s.outId));
            onChange([
              ...plan,
              {
                minute: 60,
                outId:
                  starters.find((id) => !offUsed.has(id)) ?? starters[0] ?? "",
                inId: bench.find((id) => !used.has(id)) ?? bench[0] ?? "",
              },
            ]);
          }}
          className="self-start rounded-md border border-zinc-300 px-3 py-1 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Add substitution
        </button>
      )}
    </div>
  );
}
