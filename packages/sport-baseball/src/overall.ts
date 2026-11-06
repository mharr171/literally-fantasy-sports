/**
 * Baseball ratings (ADR 0008 §2, D212). A player's overall at a position is
 * a weighted mix of their attributes. Two parts are shown on their own so a
 * manager can weigh them: **Bat** (contact, power, eye, speed) and **Field**
 * at a position (fielding and arm, plus speed in center). Weights are
 * starting values, to be tuned in the admin panel.
 */
import {
  type Attribute,
  type Attributes,
  assertValidAttributes,
} from "./attributes";
import {
  type BatterPosition,
  FIELD_POSITIONS,
  type FieldPosition,
  type RatingSlot,
} from "./positions";

type Weights = Partial<Record<Attribute, number>>;

export interface OverallWeights {
  /** Bat: the same for every position. */
  batting: Weights;
  /** Field, per fielding position. */
  fielding: Record<FieldPosition, Weights>;
  /** How much Bat counts in the overall at each batter position; Field is the rest. */
  battingShare: Record<BatterPosition, number>;
  /** A starting pitcher's and a reliever's overall. */
  pitching: Record<"SP" | "RP", Weights>;
}

export const DEFAULT_OVERALL_WEIGHTS: OverallWeights = {
  batting: { contact: 0.3, power: 0.3, eye: 0.25, speed: 0.15 },
  fielding: {
    C: { fielding: 0.5, arm: 0.5 },
    "1B": { fielding: 0.8, arm: 0.2 },
    "2B": { fielding: 0.65, arm: 0.35 },
    "3B": { fielding: 0.5, arm: 0.5 },
    SS: { fielding: 0.55, arm: 0.45 },
    LF: { fielding: 0.6, arm: 0.25, speed: 0.15 },
    CF: { fielding: 0.5, arm: 0.2, speed: 0.3 },
    RF: { fielding: 0.45, arm: 0.4, speed: 0.15 },
  },
  battingShare: {
    C: 0.4,
    "1B": 0.75,
    "2B": 0.55,
    "3B": 0.6,
    SS: 0.45,
    LF: 0.7,
    CF: 0.55,
    RF: 0.65,
    DH: 1,
  },
  pitching: {
    SP: { velocity: 0.3, control: 0.3, movement: 0.25, stamina: 0.15 },
    RP: { velocity: 0.35, control: 0.3, movement: 0.3, stamina: 0.05 },
  },
};

const sumsToOne = (name: string, weights: Weights) => {
  let total = 0;
  for (const [key, w] of Object.entries(weights)) {
    if (!(w >= 0) || !Number.isFinite(w))
      throw new RangeError(`Invalid weight for ${name}.${key}: ${w}`);
    total += w;
  }
  if (Math.abs(total - 1) > 1e-9)
    throw new RangeError(`${name} weights sum to ${total}, expected 1`);
};

/** Throws unless every weight is non-negative and each set sums to 1. */
export function assertValidWeights(weights: OverallWeights): void {
  sumsToOne("batting", weights.batting);
  for (const p of FIELD_POSITIONS) sumsToOne(p, weights.fielding[p]);
  sumsToOne("SP", weights.pitching.SP);
  sumsToOne("RP", weights.pitching.RP);
  for (const [p, share] of Object.entries(weights.battingShare))
    if (!(share >= 0 && share <= 1))
      throw new RangeError(`Invalid batting share for ${p}: ${share}`);
}

const mix = (attributes: Attributes, weights: Weights) => {
  let total = 0;
  for (const [key, w] of Object.entries(weights))
    total += attributes[key as Attribute] * (w as number);
  return total;
};

/** Bat (1–99): how good a hitter the player is, the same at every position. */
export function battingRating(
  attributes: Attributes,
  weights: OverallWeights = DEFAULT_OVERALL_WEIGHTS,
): number {
  assertValidAttributes(attributes);
  return Math.round(mix(attributes, weights.batting));
}

/** Field (1–99) at a fielding position; null for the DH, who doesn't field. */
export function fieldingRating(
  attributes: Attributes,
  position: BatterPosition,
  weights: OverallWeights = DEFAULT_OVERALL_WEIGHTS,
): number | null {
  assertValidAttributes(attributes);
  if (position === "DH") return null;
  return Math.round(mix(attributes, weights.fielding[position]));
}

/** Overall (1–99, whole number) in a slot: a batter's position, or SP or RP. */
export function overallAt(
  attributes: Attributes,
  slot: RatingSlot,
  weights: OverallWeights = DEFAULT_OVERALL_WEIGHTS,
): number {
  assertValidAttributes(attributes);
  if (slot === "SP" || slot === "RP")
    return Math.round(mix(attributes, weights.pitching[slot]));
  const share = weights.battingShare[slot];
  const bat = mix(attributes, weights.batting);
  const field = slot === "DH" ? 0 : mix(attributes, weights.fielding[slot]);
  return Math.round(bat * share + field * (1 - share));
}
