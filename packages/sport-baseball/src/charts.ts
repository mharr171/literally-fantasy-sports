/**
 * A player's charts (ADR 0009 §9, D201): his strike zone (a batter's hot
 * and cold zones, a pitcher's locations) and his spray chart, from his
 * presets, mirrored for left-handers as the engine plays them (D224); and
 * the pitches and batted balls from his recent games, replayed. Every zone
 * is from the catcher's view: column 0 is the inside edge to a right-handed
 * batter.
 */
import type { BaseballEvent, BattedKind, PitchCall, PlayResult } from "./game";
import { type BaseballPlayer, battingSide } from "./player";
import {
  LOCATION_PRESETS,
  mirrorGrid,
  mirrorSpray,
  SPRAY_PRESETS,
  ZONE_PRESETS,
  type ZoneGrid,
} from "./profiles";

/** The side a batter's charts are drawn for: against a right-handed pitcher, as most of his at-bats are. */
export function chartSide(player: Pick<BaseballPlayer, "bats">): "R" | "L" {
  return battingSide(player.bats, "R");
}

/** A batter's hot and cold zones (1 average, above hot, below cold). */
export function batterZoneGrid(
  player: Pick<BaseballPlayer, "bats" | "zoneProfile">,
): number[][] {
  const grid: ZoneGrid = ZONE_PRESETS[player.zoneProfile ?? "even"];
  return chartSide(player) === "L" ? mirrorGrid(grid) : grid.map((r) => [...r]);
}

/** Where a pitcher likes to aim, as weights. */
export function pitcherLocationGrid(
  player: Pick<BaseballPlayer, "throws" | "locationProfile">,
): number[][] {
  const grid: ZoneGrid = LOCATION_PRESETS[player.locationProfile ?? "attacks"];
  return (player.throws ?? "R") === "L"
    ? mirrorGrid(grid)
    : grid.map((r) => [...r]);
}

/** How a batter's balls in play spread over the 12 directions, left-field line to right. */
export function batterSpray(
  player: Pick<BaseballPlayer, "bats" | "sprayProfile">,
): number[] {
  const w = SPRAY_PRESETS[player.sprayProfile ?? "spray"];
  return chartSide(player) === "L" ? mirrorSpray(w) : [...w];
}

export interface ChartPitch {
  row: number;
  col: number;
  call: PitchCall;
}

export interface ChartBattedBall {
  kind: BattedKind;
  direction: number;
  depth: number;
  result: PlayResult;
}

/**
 * The pitches a player saw (as a batter) or threw (as a pitcher), and his
 * batted balls, from a game's events.
 */
export function playerChartEvents(
  events: readonly BaseballEvent[],
  playerId: string,
): { faced: ChartPitch[]; thrown: ChartPitch[]; batted: ChartBattedBall[] } {
  const faced: ChartPitch[] = [];
  const thrown: ChartPitch[] = [];
  const batted: ChartBattedBall[] = [];
  for (const e of events) {
    if (e.type === "pitch") {
      const p = { row: e.row, col: e.col, call: e.call };
      if (e.batter === playerId) faced.push(p);
      if (e.pitcher === playerId) thrown.push(p);
    } else if (e.type === "play" && e.batter === playerId && e.batted)
      batted.push({ ...e.batted, result: e.result });
  }
  return { faced, thrown, batted };
}
