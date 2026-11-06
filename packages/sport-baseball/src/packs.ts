/**
 * Baseball's packs (ADR 0009 §6, D196, D221): 5 players each, focused on
 * starting pitchers, relievers, the infield or the outfield, or any of
 * them. A new club opens 16 free starter packs (3 of starters, 3 of
 * relievers, 5 of infielders, 5 of outfielders: 80 players) and keeps 14
 * to 30, with at least 9 pitchers and 9 batters. Bought, reward and youth
 * packs use the tiers, odds and prices every sport shares (core).
 */
import {
  allowedColors as coreAllowedColors,
  excludedColorsError as coreExcludedColorsError,
  createRng,
  PACK_SIZE,
  type PackChoice,
  type PackTier,
  packTier,
  type Rng,
  type RosterLimits,
  rollPackOverall,
  type Seed,
  STARTER_TIER,
  shiftedTier,
} from "@lfs/core";
import {
  COLOR_COUNT,
  DEFAULT_GENERATION_SETTINGS,
  type GeneratedPlayer,
  type GenerationSettings,
  generatePlayer,
} from "./generation";
import type { PitcherRole, Position } from "./positions";

/** What a baseball pack holds (D221). */
export type PackFocus =
  | "starters"
  | "relievers"
  | "infield"
  | "outfield"
  | "any";

export const PACK_FOCUSES: readonly PackFocus[] = [
  "starters",
  "relievers",
  "infield",
  "outfield",
  "any",
];

export const PACK_FOCUS_NAMES: Record<PackFocus, string> = {
  starters: "Starting pitchers",
  relievers: "Relievers",
  infield: "Infield",
  outfield: "Outfield",
  any: "Any",
};

export function isPackFocus(value: string): value is PackFocus {
  return (PACK_FOCUSES as readonly string[]).includes(value);
}

/** A place a pack player can be made for: a position, and a pitcher's role. */
interface PackSlot {
  position: Position;
  role?: PitcherRole;
  weight: number;
}

const pitcher = (role: PitcherRole, weight = 1): PackSlot => ({
  position: "P",
  role,
  weight,
});
const at = (position: Position, weight = 1): PackSlot => ({
  position,
  weight,
});

/**
 * Each focus's slots. Catchers count in the infield and the DH in the
 * outfield (D221); an all-position pack follows a roster's shape, about
 * half pitchers.
 */
export const PACK_SLOTS: Record<PackFocus, readonly PackSlot[]> = {
  starters: [pitcher("starter")],
  relievers: [pitcher("reliever")],
  infield: [at("C"), at("1B"), at("2B"), at("3B"), at("SS")],
  outfield: [at("LF"), at("CF"), at("RF"), at("DH")],
  any: [
    pitcher("starter", 5),
    pitcher("reliever", 7),
    at("C", 2),
    at("1B", 1.5),
    at("2B", 1.5),
    at("3B", 1.5),
    at("SS", 1.5),
    at("LF", 1.5),
    at("CF", 1.5),
    at("RF", 1.5),
    at("DH", 1),
  ],
};

/** Opens a pack: PACK_SIZE players of the focus's slots at the tier's level. */
export function generatePack(
  rng: Rng,
  focus: PackFocus,
  tier: PackTier,
  settings: GenerationSettings = DEFAULT_GENERATION_SETTINGS,
  /** Colors the pack can hold (D180); all 4 when left out. */
  colors?: readonly number[],
): GeneratedPlayer[] {
  const slots = PACK_SLOTS[focus];
  const weights = slots.map((s) => s.weight);
  return Array.from({ length: PACK_SIZE }, (_, i) => {
    const r = rng.fork(`player-${i}`);
    const slot = slots[r.weightedIndex(weights)] as PackSlot;
    return generatePlayer(r, {
      position: slot.position,
      ...(slot.role ? { role: slot.role } : {}),
      overall: rollPackOverall(r, tier),
      settings,
      ...(colors ? { colors } : {}),
      ...(tier.ages ? { ages: tier.ages } : {}),
      ...(tier.potentialStyle ? { potentialStyle: tier.potentialStyle } : {}),
    });
  });
}

/** D221: 3 starting pitcher, 3 reliever, 5 infield and 5 outfield packs. */
export const STARTER_PACKS: { focus: PackFocus; count: number }[] = [
  { focus: "starters", count: 3 },
  { focus: "relievers", count: 3 },
  { focus: "infield", count: 5 },
  { focus: "outfield", count: 5 },
];

/** The 16 starter packs a new club receives, in a stable order (D221). */
export function starterPackPlan(): { focus: PackFocus; tier: string }[] {
  return STARTER_PACKS.flatMap(({ focus, count }) =>
    Array.from({ length: count }, () => ({ focus, tier: STARTER_TIER.id })),
  );
}

/** The players in a pack. The same seed always gives the same players. */
export function packContents(
  seed: Seed,
  focus: PackFocus,
  tierId: string,
  settings: GenerationSettings = DEFAULT_GENERATION_SETTINGS,
  choice: PackChoice = {},
): GeneratedPlayer[] {
  return generatePack(
    createRng(seed),
    focus,
    shiftedTier(packTier(tierId), choice.eloShift ?? 0),
    settings,
    allowedColors(choice.excludedColors),
  );
}

/**
 * Baseball's roster limits (D196): keep 14 to 30, with 5 on the game-day
 * bench. Admins set them per sport.
 */
export const DEFAULT_ROSTER_LIMITS: RosterLimits = {
  min: 14,
  max: 30,
  benchMax: 5,
};

/** A starting squad needs a rotation and a lineup (D221): at least this many of each. */
export const STARTER_MIN_PITCHERS = 9;
export const STARTER_MIN_BATTERS = 9;

/**
 * Why the players kept from the starter packs can't make a team, or null
 * (D221): at least 9 pitchers and 9 batters. The count of players is
 * checked against the roster limits by core's `starterSelectionError`.
 */
export function starterMixError(
  kept: readonly Pick<GeneratedPlayer, "primaryPosition">[],
): string | null {
  const pitchers = kept.filter((p) => p.primaryPosition === "P").length;
  const batters = kept.length - pitchers;
  if (pitchers < STARTER_MIN_PITCHERS)
    return `Keep at least ${STARTER_MIN_PITCHERS} pitchers (${pitchers} picked).`;
  if (batters < STARTER_MIN_BATTERS)
    return `Keep at least ${STARTER_MIN_BATTERS} batters (${batters} picked).`;
  return null;
}

/** Why a set of left-out colors can't be used, or null (D180): up to 3 of baseball's 4. */
export function excludedColorsError(colors: readonly number[]): string | null {
  return coreExcludedColorsError(colors, COLOR_COUNT);
}

/** The colors a pack can hold once some are left out (D180); undefined = all. */
export function allowedColors(
  excluded: readonly number[] = [],
): number[] | undefined {
  return coreAllowedColors(excluded, COLOR_COUNT);
}
