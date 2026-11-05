"use client";

import {
  buildFormation,
  type FormationSlot,
  formationProblems,
  POSITIONS,
  type Position,
  slotLabel,
} from "@lfs/sport-soccer";
import { useState, useTransition } from "react";
import { addFormation, switchFormation } from "./actions";

type Message = { ok: boolean; text: string } | null;

/** A small pitch with each slot's label where it plays (own goal at the bottom). */
function Pitch({
  slots,
  selected,
  onPlace,
  size = "w-40",
}: {
  slots: readonly FormationSlot[];
  selected?: number;
  onPlace?: (x: number, y: number) => void;
  size?: string;
}) {
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: the slot table is the keyboard way to place slots
    // biome-ignore lint/a11y/useKeyWithClickEvents: as above
    <div
      onClick={(e) => {
        if (!onPlace) return;
        const r = e.currentTarget.getBoundingClientRect();
        onPlace(
          Math.round(((e.clientX - r.left) / r.width) * 100),
          Math.round(((r.bottom - e.clientY) / r.height) * 100),
        );
      }}
      className={`relative aspect-[2/3] ${size} shrink-0 rounded-md border border-emerald-700/40 bg-emerald-600/15 ${onPlace ? "cursor-crosshair" : ""}`}
    >
      <div className="absolute inset-x-0 top-1/2 border-t border-emerald-700/30" />
      {slots.map((s, i) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: slots have no id
          key={i}
          style={{ left: `${s.x}%`, bottom: `${s.y}%` }}
          className={`absolute -translate-x-1/2 translate-y-1/2 rounded px-1 text-[0.6rem] font-semibold ${i === selected ? "bg-violet-600 text-white" : "bg-white/90 text-zinc-900 dark:bg-zinc-900/90 dark:text-zinc-100"}`}
        >
          {slotLabel(s)}
        </span>
      ))}
    </div>
  );
}

function Note({ message }: { message: Message }) {
  if (!message) return null;
  return (
    <p
      role={message.ok ? "status" : "alert"}
      className={`text-sm ${message.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}
    >
      {message.text}
    </p>
  );
}

/** Every formation with its shape, how many squads use it, and its switch (D140). */
export function FormationList({
  formations,
}: {
  formations: {
    id: string;
    builtIn: boolean;
    enabled: boolean;
    slots: FormationSlot[];
    used: number;
  }[];
}) {
  const [message, setMessage] = useState<Message>(null);
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-col gap-3">
      <Note message={message} />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {formations.map((f) => (
          <li
            key={f.id}
            className={`flex gap-3 rounded-lg border p-3 text-sm ${f.enabled ? "border-zinc-200 dark:border-zinc-800" : "border-dashed border-zinc-300 opacity-70 dark:border-zinc-700"}`}
          >
            <Pitch slots={f.slots} size="w-28" />
            <div className="flex flex-col gap-1">
              <p className="text-base font-semibold">{f.id}</p>
              <p className="text-zinc-500">
                {f.builtIn ? "Built in" : "Admin-made"} · {f.used} saved{" "}
                {f.used === 1 ? "squad" : "squads"}
              </p>
              <label className="mt-auto flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={f.enabled}
                  disabled={pending}
                  onChange={(e) => {
                    const on = e.target.checked;
                    start(async () => {
                      const res = await switchFormation(f.id, on);
                      setMessage(
                        res.ok
                          ? { ok: true, text: res.message }
                          : { ok: false, text: res.error },
                      );
                    });
                  }}
                />
                {f.enabled ? "On" : "Off"}
              </label>
            </div>
          </li>
        ))}
      </ul>
      <p className="text-xs text-zinc-500">
        Turning a formation off stops managers and the AI picking it. Squads
        already saved in it keep it for now.
      </p>
    </div>
  );
}

type Draft = { position: Position; x: number; y: number };

/** Create a formation: start from one, set each slot's position, click the pitch to place it. */
export function FormationEditor({
  presets,
}: {
  presets: { id: string; slots: FormationSlot[] }[];
}) {
  const copy = (id: string): Draft[] =>
    (presets.find((p) => p.id === id)?.slots ?? []).map(
      ({ position, x, y }) => ({ position, x, y }),
    );
  const [from, setFrom] = useState(presets[0]?.id ?? "");
  const [id, setId] = useState("");
  const [slots, setSlots] = useState<Draft[]>(() => copy(from));
  const [selected, setSelected] = useState(1);
  const [message, setMessage] = useState<Message>(null);
  const [pending, start] = useTransition();

  const shape = buildFormation(id || "new", slots);
  const problems = formationProblems(
    id.trim(),
    slots,
    presets.map((p) => p.id),
  );
  const set = (i: number, change: Partial<Draft>) =>
    setSlots((all) => all.map((s, j) => (j === i ? { ...s, ...change } : s)));

  return (
    <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="text-lg font-semibold">Create a formation</h2>
      <div className="flex flex-wrap items-end gap-3 text-sm">
        <label className="flex flex-col gap-1">
          Start from
          <select
            value={from}
            onChange={(e) => {
              setFrom(e.target.value);
              setSlots(copy(e.target.value));
            }}
            className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
          >
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.id}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          Name
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="4-5-1"
            className="w-32 rounded-md border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
          />
        </label>
      </div>
      <div className="flex flex-col gap-4 md:flex-row">
        <div className="flex flex-col gap-1">
          <Pitch
            slots={shape.slots}
            selected={shape.slots.findIndex(
              (s) =>
                s.x === slots[selected]?.x &&
                s.y === slots[selected]?.y &&
                s.position === slots[selected]?.position,
            )}
            onPlace={(x, y) => set(selected, { x, y })}
            size="w-56"
          />
          <p className="max-w-56 text-xs text-zinc-500">
            Pick a row, then click the pitch to move that slot. Your own goal is
            at the bottom.
          </p>
        </div>
        <table className="text-sm">
          <thead className="text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-2 py-1 text-left">Slot</th>
              <th className="px-2 py-1 text-left">Position</th>
              <th className="px-2 py-1 text-right">Across</th>
              <th className="px-2 py-1 text-right">Up</th>
            </tr>
          </thead>
          <tbody>
            {slots.map((s, i) => (
              <tr
                // biome-ignore lint/suspicious/noArrayIndexKey: slots have no id
                key={i}
                onClick={() => setSelected(i)}
                className={
                  i === selected ? "bg-violet-50 dark:bg-violet-950/40" : ""
                }
              >
                <td className="px-2 py-0.5">
                  <button
                    type="button"
                    onClick={() => setSelected(i)}
                    className="tabular-nums text-zinc-500 hover:underline"
                  >
                    {i + 1}
                  </button>
                </td>
                <td className="px-2 py-0.5">
                  <select
                    value={s.position}
                    onChange={(e) =>
                      set(i, { position: e.target.value as Position })
                    }
                    className="rounded border border-zinc-300 bg-transparent px-1 dark:border-zinc-700"
                  >
                    {POSITIONS.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </td>
                {(["x", "y"] as const).map((k) => (
                  <td key={k} className="px-2 py-0.5 text-right">
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={s[k]}
                      onChange={(e) =>
                        set(i, { [k]: Math.round(Number(e.target.value)) })
                      }
                      className="w-16 rounded border border-zinc-300 bg-transparent px-1 text-right tabular-nums dark:border-zinc-700"
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {problems.length > 0 && id.trim() !== "" && (
        <ul className="list-disc pl-5 text-sm text-amber-700 dark:text-amber-400">
          {problems.map((p) => (
            <li key={p}>{p}</li>
          ))}
        </ul>
      )}
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Shared positions get left and right heatmaps automatically (
        {shape.slots
          .filter((s) => s.side)
          .map(slotLabel)
          .join(", ") || "none here"}
        ). Once created it can&apos;t be changed.
      </p>
      <button
        type="button"
        disabled={pending || problems.length > 0}
        onClick={() =>
          start(async () => {
            const res = await addFormation(id.trim(), slots);
            setMessage(
              res.ok
                ? { ok: true, text: res.message }
                : { ok: false, text: res.error },
            );
            if (res.ok) setId("");
          })
        }
        className="self-start rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {pending ? "Creating…" : "Create formation"}
      </button>
      <Note message={message} />
    </div>
  );
}
