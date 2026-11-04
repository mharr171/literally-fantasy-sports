/**
 * What managers may see of a generated player. The true potential (D48)
 * never leaves the server: only the shown range does.
 */
import { playerWorth } from "@lfs/core";
import {
  type GeneratedPlayer,
  PACK_FOCUSES,
  type PackFocus,
  POSITION_LINE,
  type Position,
} from "@lfs/sport-soccer";

export interface ScoutedPlayer {
  displayName: string;
  nationality: string;
  age: number;
  primaryPosition: Position;
  secondaryPosition: Position | null;
  overall: number;
  potentialRange: [number, number];
  worth: number;
  chemistryColor: number;
}

export function scoutPlayer(p: GeneratedPlayer): ScoutedPlayer {
  return {
    displayName: p.displayName,
    nationality: p.nationality,
    age: p.age,
    primaryPosition: p.primaryPosition,
    secondaryPosition: p.secondaryPosition,
    overall: p.overall,
    potentialRange: p.potentialRange,
    worth: playerWorth(p),
    chemistryColor: p.chemistryColor,
  };
}

/** The row saved for a kept starter-pack player (see resolve_starter_packs). */
export function starterPlayerRow(p: GeneratedPlayer) {
  return {
    first_name: p.firstName,
    last_name: p.lastName,
    display_name: p.displayName,
    nationality: p.nationality,
    age: p.age,
    primary_position: p.primaryPosition,
    secondary_position: p.secondaryPosition,
    attributes: p.attributes,
    overall: p.overall,
    potential: p.potential,
    potential_low: p.potentialRange[0],
    potential_high: p.potentialRange[1],
    worth: playerWorth(p),
    chemistry_color: p.chemistryColor,
    template_variant: p.templateVariant,
  };
}

export const FOCUS_LABELS: Record<PackFocus, string> = {
  attack: "Attackers",
  midfield: "Midfielders",
  defence: "Defenders",
  goal: "Goalkeeper",
  any: "All positions",
};

/** Packs in the order managers see them: by focus, then a stable id order. */
export function sortPacks<T extends { id: string; focus: string }>(
  packs: readonly T[],
): T[] {
  const rank = (f: string) => {
    const i = PACK_FOCUSES.indexOf(f as PackFocus);
    return i === -1 ? PACK_FOCUSES.length : i;
  };
  return [...packs].sort(
    (a, b) => rank(a.focus) - rank(b.focus) || a.id.localeCompare(b.id),
  );
}

export const LINES = ["goal", "defence", "midfield", "attack"] as const;
export type Line = (typeof LINES)[number];

/** How many players sit in each line of the pitch. */
export function countByLine(
  players: readonly { primaryPosition: Position }[],
): Record<Line, number> {
  const counts: Record<Line, number> = {
    goal: 0,
    defence: 0,
    midfield: 0,
    attack: 0,
  };
  for (const p of players) counts[POSITION_LINE[p.primaryPosition]]++;
  return counts;
}
