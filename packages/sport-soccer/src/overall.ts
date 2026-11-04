/**
 * Overall rating (D34, D78): a position-weighted average of the attributes.
 * A player's headline overall is the rating at their primary position.
 * Weights are starting values, to be tuned in the admin panel.
 */
import {
  type Attribute,
  type Attributes,
  assertValidAttributes,
} from "./attributes";
import { POSITIONS, type Position } from "./positions";

export type OverallWeights = Record<
  Position,
  Partial<Record<Attribute, number>>
>;

export const DEFAULT_OVERALL_WEIGHTS: OverallWeights = {
  GK: { goalkeeping: 0.75, passing: 0.1, physical: 0.1, pace: 0.05 },
  CB: {
    defending: 0.45,
    physical: 0.25,
    pace: 0.1,
    passing: 0.1,
    stamina: 0.1,
  },
  LB: {
    defending: 0.3,
    pace: 0.25,
    stamina: 0.2,
    passing: 0.15,
    physical: 0.1,
  },
  RB: {
    defending: 0.3,
    pace: 0.25,
    stamina: 0.2,
    passing: 0.15,
    physical: 0.1,
  },
  DM: {
    defending: 0.3,
    passing: 0.3,
    physical: 0.15,
    stamina: 0.15,
    pace: 0.1,
  },
  CM: {
    passing: 0.35,
    stamina: 0.2,
    defending: 0.15,
    shooting: 0.1,
    physical: 0.1,
    pace: 0.1,
  },
  AM: { passing: 0.35, shooting: 0.3, pace: 0.2, stamina: 0.15 },
  LM: { pace: 0.3, passing: 0.3, stamina: 0.2, shooting: 0.1, defending: 0.1 },
  RM: { pace: 0.3, passing: 0.3, stamina: 0.2, shooting: 0.1, defending: 0.1 },
  LW: { pace: 0.35, shooting: 0.25, passing: 0.25, stamina: 0.15 },
  RW: { pace: 0.35, shooting: 0.25, passing: 0.25, stamina: 0.15 },
  ST: { shooting: 0.45, pace: 0.25, physical: 0.15, passing: 0.15 },
};

/** Throws unless every position's weights are non-negative and sum to 1. */
export function assertValidWeights(weights: OverallWeights): void {
  for (const position of POSITIONS) {
    let total = 0;
    for (const [key, w] of Object.entries(weights[position] ?? {})) {
      if (!(w >= 0) || !Number.isFinite(w)) {
        throw new RangeError(`Invalid weight for ${position}.${key}: ${w}`);
      }
      total += w;
    }
    if (Math.abs(total - 1) > 1e-9) {
      throw new RangeError(`${position} weights sum to ${total}, expected 1`);
    }
  }
}

/** Rating (1–99, whole number) for playing `position` with these attributes. */
export function overallAt(
  attributes: Attributes,
  position: Position,
  weights: OverallWeights = DEFAULT_OVERALL_WEIGHTS,
): number {
  assertValidAttributes(attributes);
  let total = 0;
  for (const [key, w] of Object.entries(weights[position])) {
    total += attributes[key as Attribute] * (w as number);
  }
  return Math.round(total);
}
