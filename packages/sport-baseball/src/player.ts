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
