/**
 * Filters for the scouting table (D108): every opened player in one list,
 * narrowed by position (primary or secondary), chemistry colour and ticks.
 */
import type { Position } from "@lfs/sport-soccer";

export interface ScoutFilter {
  /** Matches a player's primary or secondary position; null for any. */
  position: Position | null;
  /** Chemistry colour index; null for any. */
  color: number | null;
  /** Only the players ticked so far. */
  tickedOnly: boolean;
}

export const NO_FILTER: ScoutFilter = {
  position: null,
  color: null,
  tickedOnly: false,
};

export function matchesFilter(
  player: {
    primaryPosition: Position;
    secondaryPosition: Position | null;
    chemistryColor: number;
  },
  ticked: boolean,
  f: ScoutFilter,
): boolean {
  if (
    f.position &&
    player.primaryPosition !== f.position &&
    player.secondaryPosition !== f.position
  )
    return false;
  if (f.color !== null && player.chemistryColor !== f.color) return false;
  if (f.tickedOnly && !ticked) return false;
  return true;
}
