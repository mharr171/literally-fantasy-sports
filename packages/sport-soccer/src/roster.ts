/**
 * Roster rules for soccer teams (D83): a new team gets 22 free starter packs,
 * opens them all (its initial scouting) and keeps 22–30 of the players.
 */
import {
  allowedColors as coreAllowedColors,
  excludedColorsError as coreExcludedColorsError,
  removalError as coreRemovalError,
  rosterWarning as coreRosterWarning,
  starterSelectionError as coreStarterSelectionError,
  createRng,
  type PackChoice,
  packTier,
  type RosterLimits,
  type Seed,
  STARTER_TIER,
  type StarterPackState,
  type StarterSelection,
  shiftedTier,
} from "@lfs/core";
import {
  DEFAULT_GENERATION_SETTINGS,
  type GeneratedPlayer,
  type GenerationSettings,
  generatePack,
  type PackFocus,
  STARTER_PACKS,
} from "./generation";

// The pack and roster rules every sport shares (core's packs.ts), with
// soccer's colors and roster limits as the defaults below.
export {
  BOUGHT_TIERS,
  type BoughtTier,
  boughtTier,
  DEFAULT_PACK_PRICES,
  ELO_SHIFT_MAX,
  ELO_SHIFT_MIN,
  FOCUS_SURCHARGE,
  LADDER_TIERS,
  PACK_TIERS,
  type PackChoice,
  type PackPrices,
  PROPOSED_ELO_PER_OVERALL,
  packChoiceError,
  packEloShift,
  packPrice,
  packTier,
  rewardTier,
  type StarterPackState,
  type StarterSelection,
  shiftedTier,
} from "@lfs/core";

/**
 * A sport's roster limits (D182): the fewest and most players a club can
 * hold, and the most substitutes on its matchday bench. Set per sport in
 * Admin → Game settings; these are soccer's defaults.
 */
export type { RosterLimits };

export const DEFAULT_ROSTER_LIMITS: RosterLimits = {
  min: 11,
  max: 33,
  benchMax: 11,
};

/** What admins may set (the database checks the same). */
export const ROSTER_LIMIT_BOUNDS = {
  min: [11, 30],
  max: [22, 50],
  benchMax: [0, 11],
} as const;

/** What's wrong with a set of roster limits, or null. */
export function rosterLimitsError(l: RosterLimits): string | null {
  for (const [k, [lo, hi]] of Object.entries(ROSTER_LIMIT_BOUNDS)) {
    const v = l[k as keyof RosterLimits];
    if (!Number.isInteger(v) || v < lo || v > hi)
      return `${k === "benchMax" ? "Bench size" : k === "min" ? "Minimum roster" : "Maximum roster"} must be ${lo}–${hi}.`;
  }
  if (l.min > l.max) return "The minimum roster can't be above the maximum.";
  return null;
}

/** Soccer's default minimum roster (D182); use the sport's limits where you can. */
export const ROSTER_MIN = DEFAULT_ROSTER_LIMITS.min;
/** Soccer's default maximum roster (D182). */
export const ROSTER_MAX = DEFAULT_ROSTER_LIMITS.max;

export const PACK_FOCUSES: readonly PackFocus[] = [
  "attack",
  "midfield",
  "defence",
  "goal",
  "any",
];

export function isPackFocus(value: string): value is PackFocus {
  return (PACK_FOCUSES as readonly string[]).includes(value);
}

/** The five chemistry colors (D42). */
export const CHEMISTRY_COLOR_COUNT = 5;

/** Why a set of left-out colors can't be used, or null (D180): up to 3, each once. */
export function excludedColorsError(colors: readonly number[]): string | null {
  return coreExcludedColorsError(colors, CHEMISTRY_COLOR_COUNT);
}

/** The colors a pack can hold once some are left out (D180); undefined = all. */
export function allowedColors(
  excluded: readonly number[] = [],
): number[] | undefined {
  return coreAllowedColors(excluded, CHEMISTRY_COLOR_COUNT);
}

/** The 22 starter packs a new team receives, in a stable order (D83). */
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

/** Why a starter selection can't be confirmed, or null (D83, D182). */
export function starterSelectionError(
  packs: readonly StarterPackState[],
  selection: StarterSelection,
  limits: RosterLimits = DEFAULT_ROSTER_LIMITS,
): string | null {
  return coreStarterSelectionError(packs, selection, limits);
}

/** Why a player can't leave the roster, or null (D83, D182). */
export function removalError(
  rosterSize: number,
  player: { fromStarterPack: boolean },
  mode: "release" | "sell",
  limits: RosterLimits = DEFAULT_ROSTER_LIMITS,
): string | null {
  return coreRemovalError(rosterSize, player, mode, limits);
}

/** Over the maximum the next match is blocked until the roster is trimmed (D54, D182). */
export function rosterWarning(
  rosterSize: number,
  limits: RosterLimits = DEFAULT_ROSTER_LIMITS,
): string | null {
  return coreRosterWarning(rosterSize, limits);
}
