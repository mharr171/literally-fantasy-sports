"use client";

import {
  ATTRIBUTES,
  type Attributes,
  POSITION_NAMES,
  type Position,
} from "@lfs/sport-soccer";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useRef,
  useState,
} from "react";
import { chemistryColor } from "@/lib/chemistry-colors";
import { Heatmap } from "./heatmap";
import { useTemplate } from "./templates-context";

/** What a player card can show. Everything beyond the basics is optional. */
export interface CardPlayer {
  displayName: string;
  nationality: string;
  age: number;
  primaryPosition: Position;
  secondaryPosition: Position | null;
  overall: number;
  potentialRange: [number, number];
  chemistryColor: number;
  templateVariant?: string;
  attributes?: Attributes;
  fitness?: number;
  form?: number;
}

/** A chemistry colour as a swatch with its letter, for colour-blind players. */
export function ChemistryDot({
  color,
  size = "h-3 w-3",
}: {
  color: number;
  size?: string;
}) {
  const c = chemistryColor(color);
  return (
    <span
      className={`inline-flex ${size} shrink-0 items-center justify-center rounded-full text-[8px] font-bold leading-none text-white ${c.swatch}`}
      title={`Chemistry colour: ${c.name}`}
      role="img"
      aria-label={`${c.name} chemistry`}
    >
      {size === "h-3 w-3" ? "" : c.letter}
    </span>
  );
}

const ATTRIBUTE_LABELS: Record<string, string> = {
  pace: "Pace",
  shooting: "Shooting",
  passing: "Passing",
  defending: "Defending",
  physical: "Physical",
  stamina: "Stamina",
  goalkeeping: "Goalkeeping",
};

/** The card itself: colour, heatmap at the primary position, and the numbers. */
export function PlayerCardBody({ player }: { player: CardPlayer }) {
  const grid = useTemplate(player.primaryPosition, player);
  const color = chemistryColor(player.chemistryColor);
  const variant =
    player.templateVariant && player.templateVariant !== "default"
      ? player.templateVariant
      : null;
  return (
    <div className="flex w-72 flex-col gap-3 text-sm">
      <div>
        <p className="font-semibold">{player.displayName}</p>
        <p className="text-xs text-zinc-500">
          {player.nationality} · {player.age} ·{" "}
          {POSITION_NAMES[player.primaryPosition]}
          {player.secondaryPosition ? ` / ${player.secondaryPosition}` : ""}
        </p>
      </div>
      <div className="flex gap-3">
        <div className="flex flex-col items-center gap-1">
          <Heatmap
            grid={grid}
            width={78}
            label={`Where ${player.displayName} has influence as a ${player.primaryPosition}`}
          />
          <span className="text-[10px] uppercase tracking-wide text-zinc-500">
            {player.primaryPosition}
            {variant ? ` · ${variant}` : ""}
          </span>
        </div>
        <div className="flex flex-1 flex-col gap-2">
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white ${color.swatch}`}
              aria-hidden="true"
            >
              {color.letter}
            </span>
            <span>
              <span className="font-medium">{color.name}</span>{" "}
              <span className="text-xs text-zinc-500">chemistry</span>
            </span>
          </div>
          <dl className="grid grid-cols-2 gap-x-2 gap-y-0.5 text-xs">
            <dt className="text-zinc-500">Overall</dt>
            <dd className="text-right font-semibold tabular-nums">
              {player.overall}
            </dd>
            <dt className="text-zinc-500">Potential</dt>
            <dd className="text-right tabular-nums">
              {player.potentialRange[0]}–{player.potentialRange[1]}
            </dd>
            {player.fitness !== undefined && (
              <>
                <dt className="text-zinc-500">Fitness</dt>
                <dd className="text-right tabular-nums">{player.fitness}%</dd>
              </>
            )}
            {player.form !== undefined && (
              <>
                <dt className="text-zinc-500">Form</dt>
                <dd className="text-right tabular-nums">
                  {player.form > 0 ? "+" : ""}
                  {player.form.toFixed(2)}
                </dd>
              </>
            )}
          </dl>
        </div>
      </div>
      {player.attributes && (
        <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
          {ATTRIBUTES.map((a) => {
            const v = player.attributes?.[a] ?? 0;
            return (
              <li key={a} className="flex flex-col">
                <span className="flex justify-between">
                  <span className="text-zinc-500">
                    {ATTRIBUTE_LABELS[a] ?? a}
                  </span>
                  <span className="tabular-nums">{v}</span>
                </span>
                <span className="h-1 rounded bg-zinc-200 dark:bg-zinc-800">
                  <span
                    className="block h-1 rounded bg-zinc-700 dark:bg-zinc-300"
                    style={{ width: `${v}%` }}
                  />
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/**
 * A player's name that opens their card: on hover with a mouse, on tap on
 * touch screens. Escape or a click elsewhere closes it.
 */
export function PlayerCard({
  player,
  children,
  className = "",
}: {
  player: CardPlayer;
  children?: ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const card = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const id = useId();

  const place = useCallback(() => {
    const r = trigger.current?.getBoundingClientRect();
    if (!r) return;
    const width = 304;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - width - 8));
    const below = r.bottom + 6;
    const top =
      below + 320 > window.innerHeight ? Math.max(8, r.top - 326) : below;
    setPos({ top, left });
  }, []);

  const show = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    place();
    setOpen(true);
  }, [place]);
  const hideSoon = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpen(false), 200);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!card.current?.contains(t) && !trigger.current?.contains(t))
        setOpen(false);
    };
    const onScroll = () => setOpen(false);
    window.addEventListener("keydown", onKey);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  return (
    <>
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (open) setOpen(false);
          else show();
        }}
        onPointerEnter={(e) => e.pointerType === "mouse" && show()}
        onPointerLeave={(e) => e.pointerType === "mouse" && hideSoon()}
        className={`cursor-help text-left underline decoration-dotted decoration-zinc-400 underline-offset-2 hover:decoration-zinc-700 ${className}`}
      >
        {children ?? player.displayName}
      </button>
      {open && pos && (
        <div
          ref={card}
          id={id}
          role="dialog"
          aria-label={`${player.displayName}'s card`}
          onPointerEnter={(e) => e.pointerType === "mouse" && show()}
          onPointerLeave={(e) => e.pointerType === "mouse" && hideSoon()}
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-50 rounded-lg border border-zinc-200 bg-white p-3 text-zinc-900 shadow-xl dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        >
          <PlayerCardBody player={player} />
        </div>
      )}
    </>
  );
}
