/**
 * Generating baseball players (ADR 0008 §2): attributes shaped by position
 * (D198), age and a hidden potential shown as a range (D35, D48), a name
 * from baseball's nationalities (D203), a role for pitchers and a permanent
 * chemistry color, one of 4 (D200).
 *
 * Everything comes from the seeded RNG, so a pack's contents can be stored
 * as a seed and regenerated exactly. Each part has its own fork.
 */
import {
  chemistryColorCount,
  generateName,
  type NationalityCode,
  type NationalityWeights,
  pickNationality,
  type Rng,
  rollChemistryColor,
} from "@lfs/core";
import {
  ATTRIBUTE_MAX,
  ATTRIBUTE_MIN,
  ATTRIBUTES,
  type Attribute,
  type Attributes,
  BATTING_ATTRIBUTES,
  FIELDING_ATTRIBUTES,
  PITCHING_ATTRIBUTES,
} from "./attributes";
import {
  DEFAULT_OVERALL_WEIGHTS,
  type OverallWeights,
  overallAt,
} from "./overall";
import {
  type BatterPosition,
  type PitcherRole,
  type Position,
  type RatingSlot,
  ratingSlot,
} from "./positions";
import {
  type LocationPreset,
  profileChoices,
  type SprayPreset,
  type ZonePreset,
} from "./profiles";

/** Players on the field per side; with the DH, 10 take part (ADR 0008 §3). */
export const PLAYERS_ON_FIELD = 9;

/** Baseball's chemistry colors (D200): 4. */
export const COLOR_COUNT = chemistryColorCount(PLAYERS_ON_FIELD);

/** A newly generated player, ready to store. */
export interface GeneratedPlayer {
  firstName: string;
  lastName: string;
  displayName: string;
  nationality: NationalityCode;
  age: number;
  attributes: Attributes;
  primaryPosition: Position;
  secondaryPosition: BatterPosition | null;
  pitcherRole: PitcherRole | null;
  /** Overall at the primary position (and role). */
  overall: number;
  /** True potential, hidden from managers (D48). */
  potential: number;
  /** What managers see: a range that contains the true potential (D48). */
  potentialRange: [number, number];
  chemistryColor: number;
  /** A batter's zone and spray presets, a pitcher's location (D211). */
  zoneProfile: ZonePreset | null;
  sprayProfile: SprayPreset | null;
  locationProfile: LocationPreset | null;
}

/** Positions a batter could also be comfortable in (D195). */
export const SECONDARY_OPTIONS: Record<Position, BatterPosition[]> = {
  P: [],
  C: ["1B"],
  "1B": ["3B", "LF", "RF"],
  "2B": ["SS", "3B"],
  "3B": ["1B", "SS", "2B"],
  SS: ["2B", "3B"],
  LF: ["RF", "CF", "1B"],
  CF: ["LF", "RF"],
  RF: ["LF", "CF", "1B"],
  DH: ["1B", "LF"],
};

/**
 * Baseball's nationalities (D203), led by the USA, the Dominican Republic,
 * Venezuela, Japan, Cuba, South Korea, Puerto Rico and Mexico, with a tail.
 */
export const BASEBALL_NATIONALITY_WEIGHTS: NationalityWeights = {
  USA: 40,
  DOM: 14,
  VEN: 9,
  JPN: 6,
  CUB: 5,
  KOR: 4,
  PUR: 4,
  MEX: 4,
  COL: 2,
  NED: 1,
  CHN: 1,
  BRA: 1,
  ITA: 1,
  GER: 1,
  ESP: 1,
};

/** Tuning for generated players. Balance defaults: changed only with Gary's OK. */
export interface GenerationSettings {
  minAge: number;
  maxAge: number;
  meanAge: number;
  ageSpread: number;
  /** Chance a batter has a secondary position. */
  secondaryChance: number;
  /** Chance a pitcher prefers to start rather than relieve. */
  starterChance: number;
  /** How much an attribute varies around the player's level. */
  attributeSpread: number;
  /**
   * How far a fielder leans to Bat or to Field (D212): the spread of the
   * tilt between the two, which leaves the overall unchanged.
   */
  batFieldTilt: number;
  /** How far below the player's level the attributes their position ignores sit. */
  offPositionDrop: number;
  /** Where a fielder's pitching and a pitcher's batting sit, they don't count. */
  unusedMean: number;
  /** Largest yearly growth a young player can expect; it shrinks to 0 by peakAge. */
  growthPerYear: number;
  peakAge: number;
  /** Width of the potential range shown to managers. */
  potentialRangeWidth: number;
  nationalityWeights: NationalityWeights;
  overallWeights: OverallWeights;
}

export const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
  minAge: 18,
  maxAge: 37,
  meanAge: 27,
  ageSpread: 4,
  secondaryChance: 0.5,
  starterChance: 0.5,
  attributeSpread: 6,
  batFieldTilt: 8,
  offPositionDrop: 15,
  unusedMean: 15,
  growthPerYear: 2.5,
  peakAge: 28,
  potentialRangeWidth: 10,
  nationalityWeights: BASEBALL_NATIONALITY_WEIGHTS,
  overallWeights: DEFAULT_OVERALL_WEIGHTS,
};

const clampAttr = (v: number) =>
  Math.max(ATTRIBUTE_MIN, Math.min(ATTRIBUTE_MAX, Math.round(v)));

/** The attributes that count for a slot, and those that don't count at all. */
function attributeGroups(slot: RatingSlot): {
  counted: readonly Attribute[];
  unused: readonly Attribute[];
} {
  if (slot === "SP" || slot === "RP")
    return { counted: PITCHING_ATTRIBUTES, unused: BATTING_ATTRIBUTES };
  if (slot === "DH")
    return { counted: BATTING_ATTRIBUTES, unused: PITCHING_ATTRIBUTES };
  return {
    counted: [...BATTING_ATTRIBUTES, ...FIELDING_ATTRIBUTES],
    unused: PITCHING_ATTRIBUTES,
  };
}

/**
 * Attributes whose overall in `slot` lands on `target` (within 1). What the
 * slot values sits around the target; a pitcher's fielding and a DH's
 * fielding sit lower; a fielder's pitching and a pitcher's batting don't
 * count and sit low.
 */
function rollAttributes(
  rng: Rng,
  slot: RatingSlot,
  target: number,
  s: GenerationSettings,
): Attributes {
  const { counted, unused } = attributeGroups(slot);
  // A fielder leans to Bat or to Field: Bat moves up by the tilt's share
  // of Field and Field down by Bat's share, so the overall stays put.
  const share =
    slot === "SP" || slot === "RP" ? 1 : s.overallWeights.battingShare[slot];
  const tilt = share < 1 ? rng.normal(0, s.batFieldTilt) : 0;
  const batCentre = target + tilt * (1 - share);
  const fieldCentre = target - tilt * share;
  const attributes = {} as Attributes;
  for (const key of ATTRIBUTES) {
    const centre = unused.includes(key)
      ? s.unusedMean
      : !counted.includes(key)
        ? target - s.offPositionDrop
        : (BATTING_ATTRIBUTES as readonly Attribute[]).includes(key) &&
            slot !== "SP" &&
            slot !== "RP"
          ? batCentre
          : (FIELDING_ATTRIBUTES as readonly Attribute[]).includes(key)
            ? fieldCentre
            : target;
    attributes[key] = clampAttr(rng.normal(centre, s.attributeSpread));
  }
  // Nudge the attributes that count until the overall matches the target.
  for (let i = 0; i < 20; i++) {
    const diff = target - overallAt(attributes, slot, s.overallWeights);
    if (diff === 0) break;
    const step = Math.sign(diff) * Math.max(1, Math.round(Math.abs(diff)));
    for (const key of counted)
      attributes[key] = clampAttr(attributes[key] + step);
  }
  return attributes;
}

function rollAge(rng: Rng, s: GenerationSettings): number {
  const age = Math.round(rng.normal(s.meanAge, s.ageSpread));
  return Math.max(s.minAge, Math.min(s.maxAge, age));
}

/** Younger players have more room to grow; nobody grows past 99. */
function rollPotential(
  rng: Rng,
  overall: number,
  age: number,
  s: GenerationSettings,
): number {
  const years = Math.max(0, s.peakAge - age);
  const growth = rng.float(0, years * s.growthPerYear);
  return Math.min(
    ATTRIBUTE_MAX,
    Math.max(overall, Math.round(overall + growth)),
  );
}

/** A range of the configured width that contains the true potential. */
function potentialRange(
  rng: Rng,
  potential: number,
  overall: number,
  width: number,
): [number, number] {
  let low = Math.max(overall, potential - rng.int(0, width));
  let high = low + width;
  if (high > ATTRIBUTE_MAX) {
    high = ATTRIBUTE_MAX;
    low = Math.max(overall, high - width);
  }
  return [low, Math.max(high, potential)];
}

export interface GeneratePlayerOptions {
  position: Position;
  /** The overall the player should have at that position (and role). */
  overall: number;
  /** A pitcher's role; rolled when left out. Ignored for batters. */
  role?: PitcherRole;
  settings?: GenerationSettings;
  /** The chemistry colors the player may have (D180); all 4 when left out. */
  colors?: readonly number[];
}

export function generatePlayer(
  rng: Rng,
  options: GeneratePlayerOptions,
): GeneratedPlayer {
  const s = options.settings ?? DEFAULT_GENERATION_SETTINGS;
  const position = options.position;
  const target = Math.max(
    ATTRIBUTE_MIN,
    Math.min(ATTRIBUTE_MAX, Math.round(options.overall)),
  );
  const roles = rng.fork("roles");
  const pitcherRole: PitcherRole | null =
    position !== "P"
      ? null
      : (options.role ??
        (roles.chance(s.starterChance) ? "starter" : "reliever"));
  const slot = ratingSlot(position, pitcherRole ?? "starter");
  const attributes = rollAttributes(rng.fork("attributes"), slot, target, s);
  const overall = overallAt(attributes, slot, s.overallWeights);
  const bio = rng.fork("bio");
  const age = rollAge(bio, s);
  const potential = rollPotential(bio, overall, age, s);
  const nationality = pickNationality(
    rng.fork("nationality"),
    s.nationalityWeights,
  );
  const name = generateName(rng.fork("name"), nationality);
  const secondaryChoices = SECONDARY_OPTIONS[position];
  const secondaryPosition =
    secondaryChoices.length > 0 && roles.chance(s.secondaryChance)
      ? roles.pick(secondaryChoices)
      : null;
  // Presets on their own stream, so every other roll stays the same.
  const profiles = rng.fork("profiles");
  const choices = profileChoices(position);
  const pick = <T>(options: readonly T[]): T | null =>
    options.length > 0 ? profiles.pick(options) : null;
  const zoneProfile = pick(choices.zone);
  const sprayProfile = pick(choices.spray);
  const locationProfile = pick(choices.location);
  return {
    ...name,
    zoneProfile,
    sprayProfile,
    locationProfile,
    nationality,
    age,
    attributes,
    primaryPosition: position,
    secondaryPosition,
    pitcherRole,
    overall,
    potential,
    potentialRange: potentialRange(
      bio,
      potential,
      overall,
      s.potentialRangeWidth,
    ),
    chemistryColor:
      options.colors && options.colors.length > 0
        ? (options.colors[
            rng.fork("colors").int(0, options.colors.length - 1)
          ] as number)
        : rollChemistryColor(rng.fork("chemistry"), COLOR_COUNT),
  };
}
