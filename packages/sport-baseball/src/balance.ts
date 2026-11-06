/**
 * Baseball's balance outside the game itself (ADR 0009 §6, §7): payouts,
 * pack prices, condition, form and player generation. Kept in the config
 * as `balance`, so they're stored, versioned and published with the rest of
 * baseball's settings; the game engine never reads them.
 *
 * Balance defaults: changed only with Gary's OK. Proposed in ADR 0009.
 */
import {
  DEFAULT_PACK_PRICES,
  DEFAULT_PAYOUTS,
  type PackPrices,
  type PayoutSettings,
} from "@lfs/core";
import {
  DEFAULT_GENERATION_SETTINGS,
  type GenerationSettings,
} from "./generation";
import { DEFAULT_REST, type RestSettings } from "./pitching";

/** What a club earns (ADR 0009 §6) and how far Elo moves per game (§7). */
export interface BaseballPayouts extends PayoutSettings {
  /** Elo K for one game: a third of soccer's, with 3 games a week. */
  eloK: number;
}

/** Proposed: 120 a game and 180 a win, about 9,000 for a .500 season of 42 games; postseason rounds as soccer's. */
export const DEFAULT_BASEBALL_PAYOUTS: BaseballPayouts = {
  ...DEFAULT_PAYOUTS,
  perMatch: 120,
  win: 180,
  draw: 0,
  eloK: 8,
};

export interface BaseballCondition {
  /** How much a young player's growth depends on his playing time (D154): 0 = not at all. */
  playingTimeGrowth: number;
  /** Pitchers' rest (D213). */
  rest: RestSettings;
}

export const DEFAULT_BASEBALL_CONDITION: BaseballCondition = {
  playingTimeGrowth: 0,
  rest: DEFAULT_REST,
};

/** Form and morale, as soccer's (M4): how game ratings move form, and form and morale move skill. */
export interface BaseballForm {
  formEffect: number;
  moraleEffect: number;
  formMemory: number;
  formIdleDecay: number;
  moraleMemory: number;
  moraleSwing: number;
}

export const DEFAULT_BASEBALL_FORM: BaseballForm = {
  formEffect: 0.05,
  moraleEffect: 0.03,
  formMemory: 0.6,
  formIdleDecay: 0.8,
  moraleMemory: 0.7,
  moraleSwing: 0.3,
};

/** The generation numbers admins can set; the rest stay in code. */
export type BaseballGeneration = Pick<
  GenerationSettings,
  | "meanAge"
  | "ageSpread"
  | "secondaryChance"
  | "starterChance"
  | "growthPerYear"
  | "peakAge"
  | "potentialRangeWidth"
  | "leftyPitcherShare"
  | "leftyThrowerShare"
  | "leftyBatterShare"
  | "switchHitterShare"
>;

const g = DEFAULT_GENERATION_SETTINGS;
export const DEFAULT_BASEBALL_GENERATION: BaseballGeneration = {
  meanAge: g.meanAge,
  ageSpread: g.ageSpread,
  secondaryChance: g.secondaryChance,
  starterChance: g.starterChance,
  growthPerYear: g.growthPerYear,
  peakAge: g.peakAge,
  potentialRangeWidth: g.potentialRangeWidth,
  leftyPitcherShare: g.leftyPitcherShare,
  leftyThrowerShare: g.leftyThrowerShare,
  leftyBatterShare: g.leftyBatterShare,
  switchHitterShare: g.switchHitterShare,
};

export interface BaseballBalance {
  payouts: BaseballPayouts;
  packs: PackPrices;
  condition: BaseballCondition;
  form: BaseballForm;
  generation: BaseballGeneration;
}

export function defaultBaseballBalance(): BaseballBalance {
  return structuredClone({
    payouts: DEFAULT_BASEBALL_PAYOUTS,
    packs: DEFAULT_PACK_PRICES,
    condition: DEFAULT_BASEBALL_CONDITION,
    form: DEFAULT_BASEBALL_FORM,
    generation: DEFAULT_BASEBALL_GENERATION,
  });
}

/** Player generation with the balance's numbers in place. */
export function generationSettings(
  balance: Pick<BaseballBalance, "generation">,
): GenerationSettings {
  return { ...DEFAULT_GENERATION_SETTINGS, ...balance.generation };
}
