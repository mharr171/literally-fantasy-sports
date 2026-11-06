/**
 * Generating soccer players (M2): attributes shaped by position, age and a
 * hidden potential shown as a range (D35, D48), a nationality-styled name
 * (D10), a permanent chemistry colour (D42) and a template variant (D84).
 *
 * Everything comes from the seeded RNG, so a pack's contents can be stored as
 * a seed and regenerated exactly.
 */
import {
  chemistryColorCount,
  generateName,
  type NationalityCode,
  type NationalityWeights,
  PACK_SIZE,
  type PackTier,
  type PotentialStyle,
  pickNationality,
  type Rng,
  rollChemistryColor,
  rollPackOverall,
} from "@lfs/core";
import {
  ATTRIBUTE_MAX,
  ATTRIBUTE_MIN,
  ATTRIBUTES,
  type Attribute,
  type Attributes,
} from "./attributes";
import { PLAYERS_ON_FIELD } from "./match";
import {
  DEFAULT_OVERALL_WEIGHTS,
  type OverallWeights,
  overallAt,
} from "./overall";
import { POSITION_LINE, POSITIONS, type Position } from "./positions";

export const DEFAULT_TEMPLATE_VARIANT = "default";

/** A newly generated player, ready to store. */
export interface GeneratedPlayer {
  firstName: string;
  lastName: string;
  displayName: string;
  nationality: NationalityCode;
  age: number;
  attributes: Attributes;
  primaryPosition: Position;
  secondaryPosition: Position | null;
  /** Overall at the primary position. */
  overall: number;
  /** True potential, hidden from managers (D48). */
  potential: number;
  /** What managers see: a range that contains the true potential (D48). */
  potentialRange: [number, number];
  chemistryColor: number;
  /** Which of the position's influence templates this player uses (D84). */
  templateVariant: string;
  /** Template at the secondary position (D136); default when there is none. */
  secondaryTemplateVariant: string;
}

/** Positions a player could also be comfortable in. */
export const SECONDARY_OPTIONS: Record<Position, Position[]> = {
  GK: [],
  CB: ["DM", "LB", "RB"],
  LB: ["LM", "CB", "RB"],
  RB: ["RM", "CB", "LB"],
  DM: ["CM", "CB"],
  CM: ["DM", "AM"],
  AM: ["CM", "ST", "LW", "RW"],
  LM: ["LW", "LB", "CM"],
  RM: ["RW", "RB", "CM"],
  LW: ["LM", "ST", "RW"],
  RW: ["RM", "ST", "LW"],
  ST: ["AM", "LW", "RW"],
};

/** Tuning for generated players. Balance defaults: changed only with Gary's OK. */
export interface GenerationSettings {
  /** Youngest and oldest ages generated. */
  minAge: number;
  maxAge: number;
  meanAge: number;
  ageSpread: number;
  /** Chance of having a secondary position. */
  secondaryChance: number;
  /** How much an attribute varies around the player's level. */
  attributeSpread: number;
  /** How far below the player's level the attributes their position ignores sit. */
  offPositionDrop: number;
  /** Largest yearly growth a teenager can expect; it shrinks to 0 by peakAge. */
  growthPerYear: number;
  peakAge: number;
  /** Width of the potential range shown to managers. */
  potentialRangeWidth: number;
  nationalityWeights?: NationalityWeights;
  /** Available template variants per position (D82); "default" when none are listed. */
  templateVariants?: Partial<Record<Position, string[]>>;
  overallWeights: OverallWeights;
}

/**
 * Soccer's nationalities, equally likely (D10): the 25 pools it has always
 * used. Fixed here so that pools added for other sports (D203) never change
 * which players a soccer pack's seed makes.
 */
export const SOCCER_NATIONALITY_WEIGHTS: NationalityWeights =
  Object.fromEntries(
    (
      [
        "ENG",
        "ESP",
        "BRA",
        "ARG",
        "GER",
        "FRA",
        "ITA",
        "NED",
        "POR",
        "NGA",
        "GHA",
        "SEN",
        "EGY",
        "MAR",
        "JPN",
        "KOR",
        "CHN",
        "KSA",
        "MEX",
        "USA",
        "COL",
        "SWE",
        "POL",
        "TUR",
        "IND",
      ] as const
    ).map((code) => [code, 1]),
  );

export const DEFAULT_GENERATION_SETTINGS: GenerationSettings = {
  minAge: 17,
  maxAge: 34,
  meanAge: 25,
  ageSpread: 4,
  secondaryChance: 0.6,
  attributeSpread: 5,
  offPositionDrop: 12,
  growthPerYear: 2.5,
  peakAge: 27,
  potentialRangeWidth: 10,
  overallWeights: DEFAULT_OVERALL_WEIGHTS,
};

const clampAttr = (v: number) =>
  Math.max(ATTRIBUTE_MIN, Math.min(ATTRIBUTE_MAX, Math.round(v)));

/**
 * Attributes whose overall at `position` lands on `target` (within 1).
 * The attributes the position values sit around the target; the rest sit
 * lower; outfielders are poor keepers and keepers are poor outfielders.
 */
function rollAttributes(
  rng: Rng,
  position: Position,
  target: number,
  settings: GenerationSettings,
): Attributes {
  const weights = settings.overallWeights[position];
  const attributes = {} as Attributes;
  for (const key of ATTRIBUTES) {
    const counts = (weights[key] ?? 0) > 0;
    let centre = counts ? target : target - settings.offPositionDrop;
    if (key === "goalkeeping" && position !== "GK") centre = rng.normal(15, 5);
    attributes[key] = clampAttr(rng.normal(centre, settings.attributeSpread));
  }
  // Nudge the attributes that count until the overall matches the target.
  const counted = (Object.keys(weights) as Attribute[]).filter(
    (k) => (weights[k] ?? 0) > 0,
  );
  for (let i = 0; i < 20; i++) {
    const diff =
      target - overallAt(attributes, position, settings.overallWeights);
    if (Math.abs(diff) <= 0) break;
    const step = Math.sign(diff) * Math.max(1, Math.round(Math.abs(diff)));
    for (const key of counted)
      attributes[key] = clampAttr(attributes[key] + step);
  }
  return attributes;
}

function rollAge(
  rng: Rng,
  s: GenerationSettings,
  ages?: readonly [number, number],
): number {
  // A pack with its own ages (D181) rolls evenly between them.
  if (ages) return rng.int(ages[0], ages[1]);
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

/**
 * A special pack's potential (D181). Prospects: at least 10 above overall,
 * with the usual growth on top, and a shown range that starts there.
 * Veterans: their overall, shown as a range at or below it.
 */
function packPotential(
  rng: Rng,
  style: PotentialStyle,
  overall: number,
  age: number,
  s: GenerationSettings,
): { potential: number; range: [number, number] } {
  const width = s.potentialRangeWidth;
  if (style === "veteran")
    return {
      potential: overall,
      range: [Math.max(ATTRIBUTE_MIN, overall - width), overall],
    };
  const floor = Math.min(ATTRIBUTE_MAX, overall + PROSPECT_POTENTIAL_LIFT);
  const years = Math.max(0, s.peakAge - age);
  const potential = Math.min(
    ATTRIBUTE_MAX,
    Math.round(floor + rng.float(0, years * s.growthPerYear)),
  );
  const low = Math.max(floor, potential - rng.int(0, width));
  return {
    potential,
    range: [low, Math.max(potential, Math.min(ATTRIBUTE_MAX, low + width))],
  };
}

/** How far above overall a prospect's potential starts (D181). */
export const PROSPECT_POTENTIAL_LIFT = 10;

/** A range of the configured width that contains the true potential. */
function potentialRange(
  rng: Rng,
  potential: number,
  overall: number,
  width: number,
): [number, number] {
  const below = rng.int(0, width);
  let low = Math.max(overall, potential - below);
  let high = low + width;
  if (high > ATTRIBUTE_MAX) {
    high = ATTRIBUTE_MAX;
    low = Math.max(overall, high - width);
  }
  return [low, Math.max(high, potential)];
}

export interface GeneratePlayerOptions {
  position: Position;
  /** The overall the player should have at that position. */
  overall: number;
  settings?: GenerationSettings;
  /**
   * The chemistry colors the player may have (D180), e.g. a pack that
   * leaves some out. Rolled on its own stream; all colors when left out.
   */
  colors?: readonly number[];
  /** Ages to roll between, for a pack with its own ages (D181). */
  ages?: readonly [number, number];
  /** How potential is rolled, for a prospect or veteran pack (D181). */
  potentialStyle?: PotentialStyle;
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
  // Each part gets its own stream, so changing one never shifts the others.
  const attributes = rollAttributes(
    rng.fork("attributes"),
    position,
    target,
    s,
  );
  const overall = overallAt(attributes, position, s.overallWeights);
  const bio = rng.fork("bio");
  const age = rollAge(bio, s, options.ages);
  const special = options.potentialStyle
    ? packPotential(bio, options.potentialStyle, overall, age, s)
    : null;
  const potential = special
    ? special.potential
    : rollPotential(bio, overall, age, s);
  const nationality = pickNationality(
    rng.fork("nationality"),
    s.nationalityWeights ?? SOCCER_NATIONALITY_WEIGHTS,
  );
  const name = generateName(rng.fork("name"), nationality);
  const roles = rng.fork("roles");
  const secondaryChoices = SECONDARY_OPTIONS[position];
  const secondaryPosition =
    secondaryChoices.length > 0 && roles.chance(s.secondaryChance)
      ? roles.pick(secondaryChoices)
      : null;
  const templateVariant = pickVariant(roles, s, position);
  // Its own stream, so players rolled before D136 keep every other part.
  const secondaryTemplateVariant = secondaryPosition
    ? pickVariant(rng.fork("secondary-variant"), s, secondaryPosition)
    : DEFAULT_TEMPLATE_VARIANT;

  return {
    ...name,
    nationality,
    age,
    attributes,
    primaryPosition: position,
    secondaryPosition,
    overall,
    potential,
    potentialRange:
      special?.range ??
      potentialRange(bio, potential, overall, s.potentialRangeWidth),
    chemistryColor:
      options.colors && options.colors.length > 0
        ? (options.colors[
            rng.fork("colors").int(0, options.colors.length - 1)
          ] as number)
        : rollChemistryColor(
            rng.fork("chemistry"),
            chemistryColorCount(PLAYERS_ON_FIELD),
          ),
    templateVariant,
    secondaryTemplateVariant,
  };
}

/** A random enabled template for a position (D84), or the default when none are enabled. */
function pickVariant(
  rng: Rng,
  s: GenerationSettings,
  position: Position,
): string {
  const variants = s.templateVariants?.[position];
  return variants && variants.length > 0
    ? rng.pick(variants)
    : DEFAULT_TEMPLATE_VARIANT;
}

// ---------------------------------------------------------------------------
// Packs (D47, D83).

/** Which positions a pack can contain. */
export type PackFocus = "attack" | "midfield" | "defence" | "goal" | "any";

/** How often each position turns up in an all-position pack, roughly a squad's shape. */
export const ANY_POSITION_WEIGHTS: Record<Position, number> = {
  GK: 2,
  CB: 4,
  LB: 2,
  RB: 2,
  DM: 2,
  CM: 3,
  AM: 2,
  LM: 1.5,
  RM: 1.5,
  LW: 1.5,
  RW: 1.5,
  ST: 3,
};

export function positionsFor(focus: PackFocus): Position[] {
  if (focus === "any") return [...POSITIONS];
  const line =
    focus === "goal"
      ? "goal"
      : focus === "defence"
        ? "defence"
        : focus === "midfield"
          ? "midfield"
          : "attack";
  return POSITIONS.filter((p) => POSITION_LINE[p] === line);
}

// Pack tiers and their odds are shared with every sport (core's packs.ts).
export {
  type OddsBand,
  PACK_SIZE,
  type PackTier,
  type PotentialStyle,
  STARTER_TIER,
} from "@lfs/core";

/** D83: 2 attacker, 4 midfielder, 4 defender, 1 goalkeeper and 11 all-position packs. */
export const STARTER_PACKS: { focus: PackFocus; count: number }[] = [
  { focus: "attack", count: 2 },
  { focus: "midfield", count: 4 },
  { focus: "defence", count: 4 },
  { focus: "goal", count: 1 },
  { focus: "any", count: 11 },
];

/** Opens a pack: PACK_SIZE players of the focus's positions at the tier's level. */
export function generatePack(
  rng: Rng,
  focus: PackFocus,
  tier: PackTier,
  settings: GenerationSettings = DEFAULT_GENERATION_SETTINGS,
  /** Colors the pack can hold (D180); all when left out. */
  colors?: readonly number[],
): GeneratedPlayer[] {
  const positions = positionsFor(focus);
  const weights = positions.map((p) =>
    focus === "any" ? ANY_POSITION_WEIGHTS[p] : 1,
  );
  return Array.from({ length: PACK_SIZE }, (_, i) => {
    const r = rng.fork(`player-${i}`);
    const position = positions[r.weightedIndex(weights)] as Position;
    const overall = rollPackOverall(r, tier);
    return generatePlayer(r, {
      position,
      overall,
      settings,
      ...(colors ? { colors } : {}),
      ...(tier.ages ? { ages: tier.ages } : {}),
      ...(tier.potentialStyle ? { potentialStyle: tier.potentialStyle } : {}),
    });
  });
}
