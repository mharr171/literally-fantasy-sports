import type { Attributes } from "./attributes";
import {
  DEFAULT_OVERALL_WEIGHTS,
  type OverallWeights,
  overallAt,
} from "./overall";
import {
  type BatterPosition,
  type PitcherRole,
  type Position,
  ratingSlot,
} from "./positions";
import type { LocationPreset, SprayPreset, ZonePreset } from "./profiles";

/** The parts of a player the baseball engine needs. */
export interface BaseballPlayer {
  id: string;
  attributes: Attributes;
  primaryPosition: Position;
  /** A second position a batter is comfortable in (D195); null for pitchers. */
  secondaryPosition: BatterPosition | null;
  /** A pitcher's preferred role (ADR 0008 §2); null for batters. */
  pitcherRole: PitcherRole | null;
  /** Permanent chemistry color, 0–3 for baseball (D200). */
  chemistryColor: number;
  /** A batter's hot and cold zones (D211); even when left out. */
  zoneProfile?: ZonePreset | null;
  /** Where a batter tends to hit the ball; spray when left out. */
  sprayProfile?: SprayPreset | null;
  /** Where a pitcher likes to aim; attacks when left out. */
  locationProfile?: LocationPreset | null;
  /** How he bats (D224): right, left or switch; right when left out. */
  bats?: Bats;
  /** How he throws: right or left; right when left out. */
  throws?: Throws;
}

export type Bats = "R" | "L" | "S";
export type Throws = "R" | "L";

/** The side a batter hits from against this pitcher: a switch hitter takes the other side. */
export function battingSide(
  bats: Bats | undefined,
  pitcherThrows: Throws | undefined,
): Throws {
  if (bats === "S") return (pitcherThrows ?? "R") === "R" ? "L" : "R";
  return bats ?? "R";
}

/** How a player bats and throws, as cards show it: "Bats L · Throws R". */
export function handednessLabel(
  p: Pick<BaseballPlayer, "bats" | "throws">,
): string {
  const side = { R: "R", L: "L", S: "S" } as const;
  return `Bats ${side[p.bats ?? "R"]} · Throws ${side[p.throws ?? "R"]}`;
}

/** The headline overall on a player card: at the primary position (and role). */
export function playerOverall(
  player: Pick<
    BaseballPlayer,
    "attributes" | "primaryPosition" | "pitcherRole"
  >,
  weights: OverallWeights = DEFAULT_OVERALL_WEIGHTS,
): number {
  return overallAt(
    player.attributes,
    ratingSlot(player.primaryPosition, player.pitcherRole ?? "starter"),
    weights,
  );
}
