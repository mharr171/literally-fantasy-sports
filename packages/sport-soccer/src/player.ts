import type { Attributes } from "./attributes";
import {
  DEFAULT_OVERALL_WEIGHTS,
  type OverallWeights,
  overallAt,
} from "./overall";
import type { Position } from "./positions";

/** The parts of a player the match engine needs. */
export interface SoccerPlayer {
  id: string;
  attributes: Attributes;
  primaryPosition: Position;
  /** A second position the player is comfortable in, if any. */
  secondaryPosition: Position | null;
  /** Permanent chemistry colour, 0–4 for soccer (D42). */
  chemistryColor: number;
}

/** The headline overall shown on a player card: the rating at the primary position. */
export function playerOverall(
  player: SoccerPlayer,
  weights: OverallWeights = DEFAULT_OVERALL_WEIGHTS,
): number {
  return overallAt(player.attributes, player.primaryPosition, weights);
}
