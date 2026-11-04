"use client";

import {
  generatedVariants,
  type HarnessReport,
  type SlotSide,
  sideGrid,
} from "@lfs/sport-soccer";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  publishVersion,
  saveTemplates,
  type TestResult,
  testTemplates,
} from "./actions";
import {
  applyStroke,
  type Grid,
  MIRROR,
  POSITION_LABELS,
  POSITION_ORDER,
  type Position,
  type Templates,
  type Tool,
} from "./paint";

const ROWS = 25;
const COLS = 17;
const CELL = 20;

type Variants = Partial<Record<Position, Record<string, Grid>>>;
type Enabled = Partial<Record<Position, string[]>>;
const DEFAULT = "default";
/** Positions that formations use more than once, so have left and right slots (D112). */
const SHARED: readonly Position[] = ["CB", "DM", "CM", "AM", "ST"];

interface Props {
  version: number | null;
  status: "draft" | "published" | "defaults";
  note: string;
  templates: Templates;
  /** Named template variants per position (D82). */
  variants: Variants;
  /** Templates new players can be given (D84); "default" is the main one. */
  enabled: Enabled;
  defaults: Templates;
}

interface Snapshot {
  templates: Templates;
  variants: Variants;
}

export function TemplateEditor(props: Props) {
  const router = useRouter();
  const [templates, setTemplates] = useState<Templates>(props.templates);
  const [variants, setVariants] = useState<Variants>(props.variants);
  const [enabled, setEnabled] = useState<Enabled>(props.enabled);
  const [history, setHistory] = useState<Snapshot[]>([]);
  const [position, setPosition] = useState<Position>("ST");
  const [variant, setVariant] = useState<string>(DEFAULT);
  const [tool, setTool] = useState<Tool>("paint");
  const [size, setSize] = useState(2);
  const [strength, setStrength] = useState(0.5);
  const [mirror, setMirror] = useState(true);
  const [side, setSide] = useState<SlotSide | null>(null);
  const [note, setNote] = useState(props.note);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{
    kind: "ok" | "error";
    text: string;
  } | null>(null);
  const [test, setTest] = useState<TestResult | null>(null);
  const [pending, startTransition] = useTransition();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const painting = useRef(false);

  const gridOf = (
    t: Templates,
    v: Variants,
    p: Position,
    name: string,
  ): Grid | undefined => (name === DEFAULT ? t[p] : v[p]?.[name]);
  const grid =
    gridOf(templates, variants, position, variant) ?? templates[position];
  const pair = MIRROR[position];
  const pairGrid = pair
    ? gridOf(templates, variants, pair, variant)
    : undefined;
  const names = Object.keys(variants[position] ?? {});
  const usable = (name: string) =>
    (enabled[position] ?? [DEFAULT]).includes(name);
  const shared = SHARED.includes(position);
  const showSide = shared ? side : null;

  // Draw the pitch and the current template.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    if (showSide) drawPitch(ctx, sideGrid(grid, showSide), grid, false);
    else drawPitch(ctx, grid, pairGrid ?? grid, mirror && !!pairGrid);
  }, [grid, pairGrid, mirror, showSide]);

  const cellAt = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const col = Math.floor(((e.clientX - rect.left) / rect.width) * COLS);
    const screenRow = Math.floor(((e.clientY - rect.top) / rect.height) * ROWS);
    // Own goal at the bottom of the screen: row 0 is drawn last.
    return { row: ROWS - 1 - screenRow, col };
  }, []);

  const stroke = useCallback(
    (row: number, col: number) => {
      if (row < 0 || row >= ROWS || col < 0 || col >= COLS) return;
      const paint = (g: Grid, c: number) =>
        applyStroke(g, row, c, tool, size, strength);
      const mirrored = MIRROR[position];
      if (variant === DEFAULT) {
        setTemplates((current) => {
          const next = {
            ...current,
            [position]: paint(current[position], col),
          };
          if (mirror && mirrored)
            next[mirrored] = paint(current[mirrored], COLS - 1 - col);
          return next;
        });
      } else {
        setVariants((current) => {
          const own = current[position]?.[variant];
          if (!own) return current;
          const next: Variants = {
            ...current,
            [position]: { ...current[position], [variant]: paint(own, col) },
          };
          const other = mirrored ? current[mirrored]?.[variant] : undefined;
          if (mirror && mirrored && other)
            next[mirrored] = {
              ...current[mirrored],
              [variant]: paint(other, COLS - 1 - col),
            };
          return next;
        });
      }
      setDirty(true);
    },
    [position, variant, tool, size, strength, mirror],
  );

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (showSide) return; // Previewing a left or right slot: nothing to paint.
    e.currentTarget.setPointerCapture(e.pointerId);
    painting.current = true;
    setHistory((h) => [...h.slice(-19), { templates, variants }]);
    const { row, col } = cellAt(e);
    stroke(row, col);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!painting.current) return;
    const { row, col } = cellAt(e);
    stroke(row, col);
  };
  const endStroke = () => {
    painting.current = false;
  };

  const undo = () => {
    const previous = history.at(-1);
    if (!previous) return;
    setTemplates(previous.templates);
    setVariants(previous.variants);
    setHistory((h) => h.slice(0, -1));
    setDirty(true);
  };

  const resetPosition = () => {
    setHistory((h) => [...h.slice(-19), { templates, variants }]);
    if (variant === DEFAULT)
      setTemplates((t) => ({ ...t, [position]: props.defaults[position] }));
    else
      setVariants((v) => ({
        ...v,
        [position]: { ...v[position], [variant]: templates[position] },
      }));
    setDirty(true);
  };

  const addVariant = () => {
    const name = window
      .prompt(
        `Name the new ${position} template (lowercase letters, digits or dashes, e.g. "poacher"):`,
      )
      ?.trim()
      .toLowerCase();
    if (!name) return;
    if (!/^[a-z0-9][a-z0-9-]{0,23}$/.test(name) || name === DEFAULT) {
      setMessage({
        kind: "error",
        text: `"${name}" isn't a valid template name.`,
      });
      return;
    }
    if (variants[position]?.[name]) {
      setMessage({ kind: "error", text: `${position} already has "${name}".` });
      return;
    }
    if (names.length >= 8) {
      setMessage({ kind: "error", text: "At most 8 variants per position." });
      return;
    }
    // Start from the position's default template.
    setVariants((v) => ({
      ...v,
      [position]: { ...v[position], [name]: templates[position] },
    }));
    setVariant(name);
    setDirty(true);
  };

  // D112: three generated starting variants per position, ticked for new
  // players in place of the default, ready to adjust.
  const addGenerated = () => {
    if (
      !window.confirm(
        "Add 3 generated variants to every position (names already used are skipped) and make them the templates new players are given? Nothing changes for players until you save and publish.",
      )
    )
      return;
    const generated = generatedVariants();
    setHistory((h) => [...h.slice(-19), { templates, variants }]);
    const nextVariants: Variants = { ...variants };
    const nextEnabled: Enabled = { ...enabled };
    let added = 0;
    for (const p of POSITION_ORDER) {
      const own = { ...nextVariants[p] };
      const fresh: string[] = [];
      for (const [name, g] of Object.entries(generated[p])) {
        if (own[name] || Object.keys(own).length >= 8) continue;
        own[name] = g;
        fresh.push(name);
      }
      nextVariants[p] = own;
      added += fresh.length;
      if (fresh.length > 0) {
        const kept = (nextEnabled[p] ?? [DEFAULT]).filter((n) => n !== DEFAULT);
        nextEnabled[p] = [...new Set([...kept, ...fresh])];
      }
    }
    setVariants(nextVariants);
    setEnabled(nextEnabled);
    setDirty(true);
    setMessage({
      kind: "ok",
      text:
        added > 0
          ? `Added ${added} generated variants. Adjust them, then save and publish.`
          : "Every generated variant is already here.",
    });
  };

  const deleteVariant = () => {
    if (variant === DEFAULT) return;
    if (
      !window.confirm(
        `Delete the ${position} template "${variant}"? Players who already have it will use the default template from this version on.`,
      )
    )
      return;
    setVariants((v) => {
      const { [variant]: _gone, ...rest } = v[position] ?? {};
      return { ...v, [position]: rest };
    });
    setEnabled((e) => ({
      ...e,
      [position]: (e[position] ?? [DEFAULT]).filter((n) => n !== variant),
    }));
    setVariant(DEFAULT);
    setDirty(true);
  };

  const toggleUsable = (name: string, on: boolean) => {
    setEnabled((e) => {
      const current = e[position] ?? [DEFAULT];
      const next = on
        ? [...new Set([...current, name])]
        : current.filter((n) => n !== name);
      return { ...e, [position]: next };
    });
    setDirty(true);
  };

  const input = () => ({
    baseVersion: props.version,
    note,
    templates,
    variants,
    enabled,
  });

  const save = () =>
    startTransition(async () => {
      setMessage(null);
      const res = await saveTemplates(input());
      if (!res.ok) return setMessage({ kind: "error", text: res.error });
      setDirty(false);
      setMessage({
        kind: "ok",
        text: `Saved as draft version ${res.data.version}.`,
      });
      router.push(`/admin/templates?version=${res.data.version}`);
      router.refresh();
    });

  const runTest = () =>
    startTransition(async () => {
      setMessage(null);
      setTest(null);
      const res = await testTemplates(input());
      if (!res.ok) return setMessage({ kind: "error", text: res.error });
      setTest(res.data);
    });

  const publish = () => {
    if (props.version === null || props.status !== "draft" || dirty) return;
    const ok = window.confirm(
      `Publish version ${props.version}? New matches will use it, and it can never be changed afterwards.`,
    );
    if (!ok) return;
    startTransition(async () => {
      setMessage(null);
      const res = await publishVersion(props.version as number);
      if (!res.ok) return setMessage({ kind: "error", text: res.error });
      setMessage({
        kind: "ok",
        text: `Version ${res.data.version} is now live.`,
      });
      router.refresh();
    });
  };

  const readOnlyNote =
    props.status === "published"
      ? "This version is published and frozen. Saving creates a new draft from it."
      : props.status === "defaults"
        ? "No versions yet: you're starting from the built-in placeholders. Saving creates draft version 1."
        : null;

  return (
    <div className="flex flex-col gap-6">
      {readOnlyNote && (
        <p className="rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200">
          {readOnlyNote}
        </p>
      )}

      <div
        role="tablist"
        aria-label="Positions"
        className="flex flex-wrap gap-1"
      >
        {POSITION_ORDER.map((p) => (
          <button
            key={p}
            type="button"
            role="tab"
            aria-selected={p === position}
            title={POSITION_LABELS[p]}
            onClick={() => {
              setPosition(p);
              setVariant(DEFAULT);
            }}
            className={`rounded-md px-2.5 py-1 text-sm font-medium ${
              p === position
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            }`}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-zinc-500">{position} templates:</span>
        {[DEFAULT, ...names].map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => setVariant(name)}
            className={`rounded-md px-2 py-0.5 ${
              name === variant
                ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            }`}
          >
            {name}
            {usable(name) ? " ✓" : ""}
          </button>
        ))}
        <button type="button" onClick={addVariant} className={secondary}>
          + Add variant
        </button>
        <button type="button" onClick={addGenerated} className={secondary}>
          Add generated variants (all positions)
        </button>
      </div>
      <div className="flex flex-wrap items-center gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={usable(variant)}
            onChange={(e) => toggleUsable(variant, e.target.checked)}
          />
          New {position}s can be given &ldquo;{variant}&rdquo;
        </label>
        {variant !== DEFAULT && (
          <button type="button" onClick={deleteVariant} className={secondary}>
            Delete &ldquo;{variant}&rdquo;
          </button>
        )}
        <span className="text-zinc-500">
          Each new player gets one of the ticked (✓) templates at random and
          keeps it. Unticking only affects new players.
        </span>
      </div>

      <div className="flex flex-col gap-6 md:flex-row">
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Attacking ↑
          </p>
          <canvas
            ref={canvasRef}
            width={COLS * CELL}
            height={ROWS * CELL}
            aria-label={`Influence template for ${POSITION_LABELS[position]}`}
            className={`h-auto w-full max-w-[340px] touch-none rounded-md shadow-sm ${showSide ? "cursor-not-allowed" : ""}`}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endStroke}
            onPointerCancel={endStroke}
          />
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            Own goal
          </p>
          {shared && (
            <fieldset className="flex flex-wrap items-center justify-center gap-3 text-sm">
              <legend className="sr-only">Show the slot</legend>
              {(
                [
                  [null, position],
                  ["left", `L${position}`],
                  ["right", `R${position}`],
                ] as const
              ).map(([s, label]) => (
                <label key={label} className="flex items-center gap-1">
                  <input
                    type="radio"
                    name="side"
                    checked={showSide === s}
                    onChange={() => setSide(s)}
                  />
                  {label}
                </label>
              ))}
            </fieldset>
          )}
          {showSide && (
            <p className="max-w-[340px] text-center text-xs text-zinc-500">
              The {showSide} slot when a formation has two or three {position}s:
              the same template moved towards that touchline. Switch back to{" "}
              {position} to paint.
            </p>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-4 text-sm">
          <h2 className="text-lg font-semibold">
            {POSITION_LABELS[position]}
            {variant !== DEFAULT && (
              <span className="text-zinc-500"> · {variant}</span>
            )}
          </h2>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-medium">Tool</legend>
            <div className="flex gap-2">
              {(["paint", "erase", "smooth"] as const).map((t) => (
                <label key={t} className="flex items-center gap-1 capitalize">
                  <input
                    type="radio"
                    name="tool"
                    checked={tool === t}
                    onChange={() => setTool(t)}
                  />
                  {t}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="flex flex-col gap-1">
            <span className="font-medium">Brush size: {size}</span>
            <input
              type="range"
              min={1}
              max={5}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="font-medium">
              Strength: {Math.round(strength * 100)}%
            </span>
            <input
              type="range"
              min={0.05}
              max={1}
              step={0.05}
              value={strength}
              onChange={(e) => setStrength(Number(e.target.value))}
            />
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={mirror}
              onChange={(e) => setMirror(e.target.checked)}
            />
            Mirror left and right (LB↔RB, LM↔RM, LW↔RW)
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={undo}
              disabled={history.length === 0}
              className={secondary}
            >
              Undo
            </button>
            <button type="button" onClick={resetPosition} className={secondary}>
              {variant === DEFAULT
                ? `Reset ${position} to placeholder`
                : `Reset "${variant}" to ${position}'s default`}
            </button>
          </div>

          <p className="text-zinc-600 dark:text-zinc-400">
            Brighter cells mean more influence. Each template is scaled to the
            same total when saved, so painting a wider area spreads the player
            thinner rather than making them stronger.
          </p>

          <label className="flex flex-col gap-1">
            <span className="font-medium">Note for this version</span>
            <input
              type="text"
              maxLength={200}
              value={note}
              onChange={(e) => {
                setNote(e.target.value);
                setDirty(true);
              }}
              placeholder="e.g. Wider full-backs"
              className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 dark:border-zinc-700"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={runTest}
              disabled={pending}
              className={secondary}
            >
              {pending ? "Working…" : "Test (1,500 matches)"}
            </button>
            <button
              type="button"
              onClick={save}
              disabled={pending}
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
              className={danger}
            >
              Publish
              {props.status === "draft" ? ` version ${props.version}` : ""}
            </button>
          </div>
          {dirty && (
            <p className="text-amber-700 dark:text-amber-400">
              Unsaved changes.
            </p>
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
      </div>

      {test && <TestTable result={test} />}
    </div>
  );
}

const secondary =
  "rounded-md border border-zinc-300 px-3 py-1.5 font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900";
const primary =
  "rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900";
const danger =
  "rounded-md bg-emerald-700 px-3 py-1.5 font-medium text-white hover:bg-emerald-600 disabled:opacity-40";

export function TestTable({ result }: { result: TestResult }) {
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  const rows: [string, (r: HarnessReport) => string][] = [
    ["Goals per match (target 2.5–2.8)", (r) => r.goalsPerMatch.toFixed(2)],
    [
      "Draws, even teams (target ~25%)",
      (r) => pct(r.byGap.find((g) => g.gap === 0)?.draw ?? 0),
    ],
    ["Draws, all matches", (r) => pct(r.drawRate)],
    [
      "Stronger team wins, gap 10",
      (r) => pct(r.byGap.find((g) => g.gap === 10)?.win ?? 0),
    ],
    [
      "Stronger team wins, gap 20",
      (r) => pct(r.byGap.find((g) => g.gap === 20)?.win ?? 0),
    ],
    ["Yellow cards per match", (r) => r.yellowsPerMatch.toFixed(2)],
    ["Substitutions per match", (r) => r.subsPerMatch.toFixed(2)],
  ];
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">Test results</h2>
      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400">
            <tr>
              <th className="px-4 py-2 font-medium">1,500 matches each</th>
              <th className="px-4 py-2 font-medium">Your templates</th>
              <th className="px-4 py-2 font-medium">{result.liveLabel}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, value]) => (
              <tr
                key={label}
                className="border-t border-zinc-200 dark:border-zinc-800"
              >
                <td className="px-4 py-2">{label}</td>
                <td className="px-4 py-2 tabular-nums">
                  {value(result.draft)}
                </td>
                <td className="px-4 py-2 tabular-nums">{value(result.live)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/** Pitch markings plus the template as a heat overlay, own goal at the bottom. */
function drawPitch(
  ctx: CanvasRenderingContext2D,
  grid: Grid,
  pair: Grid,
  showPair: boolean,
) {
  const w = COLS * CELL;
  const h = ROWS * CELL;
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#2f6b3a";
  ctx.fillRect(0, 0, w, h);

  const max = Math.max(1e-9, ...grid.flat());
  const pairMax = Math.max(1e-9, ...pair.flat());
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const y = (ROWS - 1 - r) * CELL;
      const x = c * CELL;
      if (showPair) {
        const p = (pair[r]?.[c] ?? 0) / pairMax;
        if (p > 0.01) {
          ctx.fillStyle = `rgba(147, 197, 253, ${0.35 * p})`;
          ctx.fillRect(x, y, CELL, CELL);
        }
      }
      const v = (grid[r]?.[c] ?? 0) / max;
      if (v > 0.002) {
        ctx.fillStyle = `rgba(250, 204, 21, ${0.15 + 0.85 * v})`;
        ctx.fillRect(x, y, CELL, CELL);
      }
    }
  }

  // Faint cell grid.
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1;
  for (let c = 1; c < COLS; c++) line(ctx, c * CELL, 0, c * CELL, h);
  for (let r = 1; r < ROWS; r++) line(ctx, 0, r * CELL, w, r * CELL);

  // Pitch markings.
  ctx.strokeStyle = "rgba(255,255,255,0.7)";
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, w - 2, h - 2);
  line(ctx, 0, h / 2, w, h / 2);
  ctx.beginPath();
  ctx.arc(w / 2, h / 2, 2.2 * CELL, 0, Math.PI * 2);
  ctx.stroke();
  const boxW = 10 * CELL;
  const boxH = 4 * CELL;
  ctx.strokeRect((w - boxW) / 2, 0, boxW, boxH);
  ctx.strokeRect((w - boxW) / 2, h - boxH, boxW, boxH);
  const sixW = 4 * CELL;
  ctx.strokeRect((w - sixW) / 2, 0, sixW, 1.5 * CELL);
  ctx.strokeRect((w - sixW) / 2, h - 1.5 * CELL, sixW, 1.5 * CELL);
}

function line(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}
