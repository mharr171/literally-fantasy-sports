/**
 * Baseball's season end (ADR 0009 §6): players age a year with the aging
 * rules every sport shares (core), young ones grow with their playing
 * time, older ones decline and some retire, and the club is offered youth
 * prospects to take for free. Pure and seeded, so the same season always
 * ends the same way.
 */
import {
  type AgingSettings,
  createRng,
  DEFAULT_AGING,
  type PlayingTimeGrowth,
  retirementChance,
  yearlyChange,
} from "@lfs/core";
import { ATTRIBUTE_MAX, ATTRIBUTE_MIN, type Attributes } from "./attributes";
import {
  attributeGroups,
  DEFAULT_GENERATION_SETTINGS,
  type GeneratedPlayer,
  type GenerationSettings,
  generatePlayer,
  PLAYERS_ON_FIELD,
} from "./generation";
import {
  DEFAULT_OVERALL_WEIGHTS,
  type OverallWeights,
  overallAt,
} from "./overall";
import { PACK_SLOTS } from "./packs";
import {
  type PitcherRole,
  type Position,
  type RatingSlot,
  ratingSlot,
} from "./positions";

/** Balance defaults: changed only with Gary's OK. */
export interface SeasonEndSettings extends AgingSettings {
  /** Youth intake: 2 × players on the field, as soccer's (D53). */
  intakeSize: number;
  intakeAges: [number, number];
  intakeOverall: { mean: number; spread: number; min: number; max: number };
}

/** Soccer's aging and youth, sized for baseball's 9 on the field. */
export const DEFAULT_SEASON_END_SETTINGS: SeasonEndSettings = {
  ...DEFAULT_AGING,
  intakeSize: 2 * PLAYERS_ON_FIELD,
  intakeAges: [17, 19],
  intakeOverall: { mean: 45, spread: 5, min: 35, max: 58 },
};

/** What season end needs to know about a player. */
export interface AgingPlayer {
  id: string;
  age: number;
  attributes: Attributes;
  primaryPosition: Position;
  /** A pitcher's role: his overall is worked out for it. */
  pitcherRole: PitcherRole | null;
  overall: number;
  /** True potential (server only, D48). */
  potential: number;
  /** Playing time this season in the club's own games (D154). */
  seasonMinutes?: number;
}

export interface AgedPlayer {
  id: string;
  age: number;
  attributes: Attributes;
  overall: number;
}

export interface SeasonEndResult {
  aged: AgedPlayer[];
  /** Ids of players who retire (they leave the club). */
  retired: string[];
}

const clampAttr = (v: number) =>
  Math.max(ATTRIBUTE_MIN, Math.min(ATTRIBUTE_MAX, Math.round(v)));

/**
 * Moves a player's attributes so their overall in `slot` becomes `target`:
 * the attributes the slot counts shift together, the rest stay as they are.
 */
export function shiftToOverall(
  attributes: Attributes,
  slot: RatingSlot,
  target: number,
  weights: OverallWeights = DEFAULT_OVERALL_WEIGHTS,
): Attributes {
  const next = { ...attributes };
  const { counted } = attributeGroups(slot);
  const goal = clampAttr(target);
  for (let i = 0; i < 20; i++) {
    const diff = goal - overallAt(next, slot, weights);
    if (diff === 0) break;
    const step = Math.sign(diff) * Math.max(1, Math.round(Math.abs(diff)));
    let moved = false;
    for (const key of counted) {
      const v = clampAttr(next[key] + step);
      if (v !== next[key]) moved = true;
      next[key] = v;
    }
    if (!moved) break; // Every counted attribute is pinned at 1 or 99.
  }
  return next;
}

/**
 * Ages every player a year (D35). Retirement is decided on the new age,
 * before growth, so a retiring player's last season is the one just played.
 */
export function endOfSeason(
  seed: string,
  players: readonly AgingPlayer[],
  s: SeasonEndSettings = DEFAULT_SEASON_END_SETTINGS,
  weights: OverallWeights = DEFAULT_OVERALL_WEIGHTS,
  growth?: PlayingTimeGrowth,
): SeasonEndResult {
  const root = createRng(seed).fork("season-end");
  const aged: AgedPlayer[] = [];
  const retired: string[] = [];
  for (const p of players) {
    const rng = root.fork(p.id);
    const age = p.age + 1;
    if (rng.fork("retire").chance(retirementChance(age, s))) {
      retired.push(p.id);
      continue;
    }
    const slot = ratingSlot(p.primaryPosition, p.pitcherRole ?? "starter");
    const target = clampAttr(
      p.overall + yearlyChange(rng.fork("growth"), p, s, growth),
    );
    const attributes = shiftToOverall(p.attributes, slot, target, weights);
    aged.push({
      id: p.id,
      age,
      attributes,
      overall: overallAt(attributes, slot, weights),
    });
  }
  return { aged, retired };
}

/**
 * The youth intake (D46, D53): 18 prospects aged 17–19 around overall 45,
 * any of whom the club can take for free. A starter and a reliever first,
 * so every intake has both, then any position as a roster's shape.
 * Regenerated from the seed, so nothing has to be stored until taken.
 */
export function youthIntake(
  seed: string,
  s: SeasonEndSettings = DEFAULT_SEASON_END_SETTINGS,
  generation: GenerationSettings = DEFAULT_GENERATION_SETTINGS,
): GeneratedPlayer[] {
  const root = createRng(seed).fork("youth-intake");
  const [minAge, maxAge] = s.intakeAges;
  const settings: GenerationSettings = {
    ...generation,
    minAge,
    maxAge,
    meanAge: (minAge + maxAge) / 2,
    ageSpread: 1,
  };
  const slots = PACK_SLOTS.any;
  const weights = slots.map((x) => x.weight);
  return Array.from({ length: s.intakeSize }, (_, i) => {
    const r = root.fork(`prospect-${i}`);
    const slot =
      i === 0
        ? { position: "P" as const, role: "starter" as const }
        : i === 1
          ? { position: "P" as const, role: "reliever" as const }
          : slots[r.weightedIndex(weights)];
    const { mean, spread, min, max } = s.intakeOverall;
    const overall = Math.max(
      min,
      Math.min(max, Math.round(r.normal(mean, spread))),
    );
    return generatePlayer(r, {
      position: slot?.position ?? "P",
      ...(slot?.role ? { role: slot.role } : {}),
      overall,
      settings,
    });
  });
}
