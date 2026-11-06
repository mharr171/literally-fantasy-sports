/**
 * Season end (D35, D46, D53): players age a year, young ones grow toward
 * their potential, older ones decline and some retire, and the club is
 * offered 22 youth prospects to take for free. Pure and seeded, so the
 * same season always ends the same way.
 */
import {
  type AgingSettings,
  createRng,
  DEFAULT_AGING,
  type PlayingTimeGrowth,
  retirementChance,
  yearlyChange,
} from "@lfs/core";

// Growth, decline and retirement are shared with every sport (core's aging.ts).
export {
  type PlayingTimeGrowth,
  playingTimeFactor,
  REGULAR_SHARE,
  retirementChance,
  yearlyChange,
} from "@lfs/core";

import {
  ATTRIBUTE_MAX,
  ATTRIBUTE_MIN,
  type Attribute,
  type Attributes,
} from "./attributes";
import {
  ANY_POSITION_WEIGHTS,
  DEFAULT_GENERATION_SETTINGS,
  type GeneratedPlayer,
  type GenerationSettings,
  generatePlayer,
} from "./generation";
import { PLAYERS_ON_FIELD } from "./match";
import {
  DEFAULT_OVERALL_WEIGHTS,
  type OverallWeights,
  overallAt,
} from "./overall";
import { POSITIONS, type Position } from "./positions";

/** Balance defaults: changed only with Gary's OK. */
export interface SeasonEndSettings extends AgingSettings {
  /** Youth intake (D53): 2 × players on the field. */
  intakeSize: number;
  intakeAges: [number, number];
  intakeOverall: { mean: number; spread: number; min: number; max: number };
}

export const DEFAULT_SEASON_END_SETTINGS: SeasonEndSettings = {
  ...DEFAULT_AGING,
  intakeSize: 2 * PLAYERS_ON_FIELD,
  intakeAges: [16, 18],
  intakeOverall: { mean: 45, spread: 5, min: 35, max: 58 },
};

/** What season end needs to know about a player. */
export interface AgingPlayer {
  id: string;
  age: number;
  attributes: Attributes;
  primaryPosition: Position;
  overall: number;
  /** True potential (server only, D48). */
  potential: number;
  /** Minutes played this season in the club's own matches (D154). */
  seasonMinutes?: number;
}

export interface AgedPlayer {
  id: string;
  age: number;
  attributes: Attributes;
  overall: number;
}

const clampAttr = (v: number) =>
  Math.max(ATTRIBUTE_MIN, Math.min(ATTRIBUTE_MAX, Math.round(v)));

/**
 * Moves a player's attributes so their overall at `position` becomes
 * `target`: the attributes the position counts shift together, the rest
 * stay as they are.
 */
export function shiftToOverall(
  attributes: Attributes,
  position: Position,
  target: number,
  weights: OverallWeights = DEFAULT_OVERALL_WEIGHTS,
): Attributes {
  const next = { ...attributes };
  const counted = (Object.keys(weights[position]) as Attribute[]).filter(
    (k) => (weights[position][k] ?? 0) > 0,
  );
  const goal = Math.max(
    ATTRIBUTE_MIN,
    Math.min(ATTRIBUTE_MAX, Math.round(target)),
  );
  for (let i = 0; i < 20; i++) {
    const diff = goal - overallAt(next, position, weights);
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

export interface SeasonEndResult {
  aged: AgedPlayer[];
  /** Ids of players who retire (they leave the club). */
  retired: string[];
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
    const target = Math.max(
      ATTRIBUTE_MIN,
      Math.min(
        ATTRIBUTE_MAX,
        p.overall + yearlyChange(rng.fork("growth"), p, s, growth),
      ),
    );
    const attributes = shiftToOverall(
      p.attributes,
      p.primaryPosition,
      target,
      weights,
    );
    aged.push({
      id: p.id,
      age,
      attributes,
      overall: overallAt(attributes, p.primaryPosition, weights),
    });
  }
  return { aged, retired };
}

/**
 * The youth intake (D46, D53): 22 prospects aged 16–18 around overall 45,
 * any of whom the club can take for free. Regenerated from the seed, so
 * nothing about them has to be stored until they're taken.
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
  const positions = [...POSITIONS];
  const weights = positions.map((p) => ANY_POSITION_WEIGHTS[p]);
  return Array.from({ length: s.intakeSize }, (_, i) => {
    const r = root.fork(`prospect-${i}`);
    // Two keepers first, so every intake has a choice in goal.
    const position =
      i < 2 ? "GK" : (positions[r.weightedIndex(weights)] as Position);
    const { mean, spread, min, max } = s.intakeOverall;
    const overall = Math.max(
      min,
      Math.min(max, Math.round(r.normal(mean, spread))),
    );
    return generatePlayer(r, { position, overall, settings });
  });
}
