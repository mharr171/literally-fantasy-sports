"use client";

import {
  ATTRIBUTES,
  type Attributes,
  type PlayerStats,
  POSITION_NAMES,
  type Position,
  variantAt,
  winPercent,
} from "@lfs/sport-soccer";
import type { ReactNode } from "react";
import { Popover } from "@/components/popover";
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
  secondaryTemplateVariant?: string;
  attributes?: Attributes;
  /** Career totals (D143), for the club's own players. */
  stats?: PlayerStats;
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

/** The card itself: colour, heatmaps at both positions, and the numbers. */
export function PlayerCardBody({ player }: { player: CardPlayer }) {
  const grid = useTemplate(player.primaryPosition, player);
  const second = player.secondaryPosition;
  const secondGrid = useTemplate(second ?? player.primaryPosition, player);
  const color = chemistryColor(player.chemistryColor);
  const variant = variantAt(player, player.primaryPosition);
  const secondVariant = second ? variantAt(player, second) : undefined;
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
          {second && (
            <>
              <Heatmap
                grid={secondGrid}
                width={78}
                label={`Where ${player.displayName} has influence as a ${second}`}
              />
              <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                {second}
                {secondVariant ? ` · ${secondVariant}` : ""}
              </span>
            </>
          )}
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
      {player.stats && (
        <CareerStats
          stats={player.stats}
          keeper={player.primaryPosition === "GK"}
        />
      )}
    </div>
  );
}

/** Career totals (D143): games, win %, and what the player does best. */
function CareerStats({
  stats,
  keeper,
}: {
  stats: PlayerStats;
  keeper: boolean;
}) {
  const win = winPercent(stats);
  const items: [string, string][] = [
    ["Games", String(stats.games)],
    ["Win %", win === null ? "–" : `${win}%`],
    ["Goals", String(stats.goals)],
    ["Assists", String(stats.assists)],
    keeper
      ? ["Saves", String(stats.saves)]
      : ["Tackles", String(stats.tackles)],
    ["W-D-L", `${stats.wins}-${stats.draws}-${stats.losses}`],
  ];
  return (
    <div className="flex flex-col gap-1 border-t border-zinc-200 pt-2 dark:border-zinc-800">
      <p className="text-[10px] uppercase tracking-wide text-zinc-500">
        Career
      </p>
      <dl className="grid grid-cols-3 gap-x-2 gap-y-1 text-xs">
        {items.map(([label, value]) => (
          <div key={label} className="flex flex-col">
            <dt className="text-zinc-500">{label}</dt>
            <dd className="tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
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
  return (
    <Popover
      label={`${player.displayName}'s card`}
      trigger={children ?? player.displayName}
      triggerClassName={`cursor-help text-left underline decoration-dotted decoration-zinc-400 underline-offset-2 hover:decoration-zinc-700 ${className}`}
    >
      <PlayerCardBody player={player} />
    </Popover>
  );
}
