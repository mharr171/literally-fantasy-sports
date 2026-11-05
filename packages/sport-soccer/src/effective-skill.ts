/**
 * Effective skill on matchday (roadmap Step 4, "How a soccer match is
 * simulated", item 1): the rating at the position the player is filling,
 * raised by bonuses for position fit and chemistry. Later milestones add form,
 * match fitness and morale through `extraModifiers`.
 *
 * Bonuses add up, then multiply the rating once:
 * 70 at primary position (+25%) with chemistry +15% → 70 × 1.40 = 98.
 */
import type { OverallWeights } from "./overall";
import { DEFAULT_OVERALL_WEIGHTS, overallAt } from "./overall";
import type { SoccerPlayer } from "./player";
import type { Position } from "./positions";

export interface PositionFitBonuses {
  primary: number;
  secondary: number;
  /** Anywhere else (D135): a match tuning value, 0 when not set. */
  other?: number;
}

/** From the roadmap: +25% at the primary position, +10% at the secondary. */
export const DEFAULT_POSITION_FIT_BONUSES: PositionFitBonuses = {
  primary: 0.25,
  secondary: 0.1,
};

export type PositionFit = "primary" | "secondary" | "other";

export function positionFit(player: SoccerPlayer, slot: Position): PositionFit {
  if (slot === player.primaryPosition) return "primary";
  if (slot === player.secondaryPosition) return "secondary";
  return "other";
}

export interface EffectiveSkillInput {
  player: SoccerPlayer;
  /** The position the player is filling in this lineup. */
  slot: Position;
  /** Chemistry boost from @lfs/core's chemistryBoostsByPlayer, e.g. 0.25. */
  chemistryBoost: number;
  /** Form, match fitness, morale… as fractions (+0.05, −0.1). Added in later milestones. */
  extraModifiers?: readonly number[];
}

export interface EffectiveSkillConfig {
  overallWeights: OverallWeights;
  positionFit: PositionFitBonuses;
}

export const DEFAULT_EFFECTIVE_SKILL_CONFIG: EffectiveSkillConfig = {
  overallWeights: DEFAULT_OVERALL_WEIGHTS,
  positionFit: DEFAULT_POSITION_FIT_BONUSES,
};

export function effectiveSkill(
  input: EffectiveSkillInput,
  config: EffectiveSkillConfig = DEFAULT_EFFECTIVE_SKILL_CONFIG,
): number {
  const base = overallAt(
    input.player.attributes,
    input.slot,
    config.overallWeights,
  );
  const fit = positionFit(input.player, input.slot);
  const fitBonus =
    fit === "other" ? (config.positionFit.other ?? 0) : config.positionFit[fit];
  let multiplier = 1 + fitBonus + input.chemistryBoost;
  for (const m of input.extraModifiers ?? []) multiplier += m;
  // A player never drops below zero skill, however bad the modifiers.
  return Math.max(0, base * multiplier);
}
