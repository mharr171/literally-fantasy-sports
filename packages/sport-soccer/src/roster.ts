/**
 * Roster rules for soccer teams (D83): a new team gets 22 free starter packs,
 * opens them all (its initial scouting) and keeps 22–30 of the players.
 */
import { createRng, type Seed } from "@lfs/core";
import {
  DEFAULT_GENERATION_SETTINGS,
  type GeneratedPlayer,
  type GenerationSettings,
  generatePack,
  PACK_SIZE,
  type PackFocus,
  type PackTier,
  STARTER_PACKS,
  STARTER_TIER,
} from "./generation";

/**
 * A sport's roster limits (D182): the fewest and most players a club can
 * hold, and the most substitutes on its matchday bench. Set per sport in
 * Admin → Game settings; these are soccer's defaults.
 */
export interface RosterLimits {
  min: number;
  max: number;
  benchMax: number;
}

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

/** A tier managers can buy, with its price in funds. */
export interface BoughtTier extends PackTier {
  name: string;
  price: number;
  /** A special pack (D181), outside the Basic → Silver → Gold ladder. */
  special?: boolean;
  /** One line for the shop, e.g. the ages a special pack holds. */
  blurb?: string;
}

const bandTier = (
  id: string,
  name: string,
  price: number,
  bands: [min: number, max: number, percent: number][],
  extra: Partial<BoughtTier> = {},
): BoughtTier => {
  const odds = bands.map(([min, max, weight]) => ({ min, max, weight }));
  const total = odds.reduce((a, b) => a + b.weight, 0);
  return {
    ...extra,
    id,
    name,
    price,
    bands: odds,
    min: Math.min(...odds.map((b) => b.min)),
    max: Math.max(...odds.map((b) => b.max)),
    mean:
      odds.reduce((a, b) => a + ((b.min + b.max) / 2) * b.weight, 0) / total,
    spread: 0,
  };
};

/**
 * Packs for sale, cheapest first, with published odds of player skill (D47).
 * Basic costs 5,000 (D39). Balance defaults: changed only with Gary's OK.
 */
export const BOUGHT_TIERS: readonly BoughtTier[] = [
  bandTier("basic", "Basic", 5_000, [
    [40, 49, 25],
    [50, 59, 50],
    [60, 69, 20],
    [70, 79, 5],
  ]),
  bandTier("silver", "Silver", 12_000, [
    [50, 59, 35],
    [60, 69, 45],
    [70, 79, 17],
    [80, 89, 3],
  ]),
  bandTier("gold", "Gold", 30_000, [
    [60, 69, 40],
    [70, 79, 45],
    [80, 89, 13],
    [90, 99, 2],
  ]),
  // Special packs (D181, ADR 0006 §6). Balance defaults: Gary OK'd.
  bandTier(
    "prospect",
    "Prospect",
    12_000,
    [
      [30, 39, 25],
      [40, 49, 50],
      [50, 59, 20],
      [60, 69, 5],
    ],
    {
      special: true,
      ages: [17, 20],
      potentialStyle: "prospect",
      blurb:
        "Ages 17–20, with potential starting at least 10 above their overall.",
    },
  ),
  bandTier(
    "veteran",
    "Veteran",
    8_400,
    [
      [53, 62, 35],
      [63, 72, 45],
      [73, 82, 17],
      [83, 92, 3],
    ],
    {
      special: true,
      ages: [30, 33],
      potentialStyle: "veteran",
      blurb: "Ages 30–33: ready now, with no growth left.",
    },
  ),
  bandTier(
    "wildcard",
    "Wildcard",
    12_000,
    [
      [40, 49, 15],
      [50, 79, 70],
      [80, 89, 15],
    ],
    { special: true, blurb: "Anything can happen: wider odds both ways." },
  ),
];

/** Basic, Silver and Gold: each costs more than the one before (D47). */
export const LADDER_TIERS: readonly BoughtTier[] = BOUGHT_TIERS.filter(
  (t) => !t.special,
);

/**
 * The free pack a club earns for its playoff finish (D181): Gold for the
 * champion, Silver for the losing finalist, Basic for a semi-finalist.
 */
export function rewardTier(playoffs: string): string | null {
  return playoffs === "champion"
    ? "gold"
    : playoffs === "final"
      ? "silver"
      : playoffs === "semi"
        ? "basic"
        : null;
}

/** Position-focused packs cost this much more than all-position ones. */
export const FOCUS_SURCHARGE = 0.2;

/** Every pack tier, by id. */
export const PACK_TIERS: Record<string, PackTier> = Object.fromEntries([
  [STARTER_TIER.id, STARTER_TIER],
  ...BOUGHT_TIERS.map((t) => [t.id, t]),
]);

export function packTier(id: string): PackTier {
  const tier = PACK_TIERS[id];
  if (!tier) throw new Error(`Unknown pack tier: ${id}`);
  return tier;
}

export function boughtTier(id: string): BoughtTier {
  const tier = BOUGHT_TIERS.find((t) => t.id === id);
  if (!tier) throw new Error(`That pack isn't for sale: ${id}`);
  return tier;
}

/** Pack prices: per tier, and the surcharge for a position focus (M5: set by admins). */
export interface PackPrices {
  /** Price in funds by bought tier id. */
  tiers: Record<string, number>;
  /** Position-focused packs cost this much more (0.2 = +20%). */
  focusSurcharge: number;
  /**
   * Elo points per overall point a bought pack's odds move (D179): 40 moves
   * every band up 5 at Elo 1700. 0 = packs don't follow Elo.
   */
  eloPerOverall?: number;
  /** How much more a pack costs per overall point it moves (0.03 = +3%). */
  pricePerOverall?: number;
  /** Surcharges for leaving out 1, 2 or 3 chemistry colors (D180). */
  excludeOne?: number;
  excludeTwo?: number;
  excludeThree?: number;
}

export const DEFAULT_PACK_PRICES: PackPrices = {
  tiers: Object.fromEntries(BOUGHT_TIERS.map((t) => [t.id, t.price])),
  focusSurcharge: FOCUS_SURCHARGE,
  // Off until a settings version turns it on (D179).
  eloPerOverall: 0,
  pricePerOverall: 0.03,
  excludeOne: 0.25,
  excludeTwo: 0.6,
  excludeThree: 1.2,
};

/** The Elo scaling Gary chose (D186), for the version that turns it on. */
export const PROPOSED_ELO_PER_OVERALL = 40;

/** How far a pack's odds can move with Elo (D179). */
export const ELO_SHIFT_MIN = -10;
export const ELO_SHIFT_MAX = 15;

/** Overall points a bought pack's odds move for a club at this Elo (D179). */
export function packEloShift(
  elo: number,
  prices: PackPrices = DEFAULT_PACK_PRICES,
): number {
  const per = prices.eloPerOverall ?? 0;
  if (!per || !Number.isFinite(elo)) return 0;
  return Math.max(
    ELO_SHIFT_MIN,
    Math.min(ELO_SHIFT_MAX, Math.round((elo - 1500) / per)),
  );
}

/** A tier's odds moved by `shift` overall points, within 30–99 (D179). */
export function shiftedTier<T extends PackTier>(tier: T, shift: number): T {
  if (!shift) return tier;
  const clamp = (v: number) => Math.max(30, Math.min(99, v));
  return {
    ...tier,
    mean: clamp(tier.mean + shift),
    min: clamp(tier.min + shift),
    max: clamp(tier.max + shift),
    ...(tier.bands
      ? {
          bands: tier.bands.map((b) => ({
            ...b,
            min: clamp(b.min + shift),
            max: clamp(b.max + shift),
          })),
        }
      : {}),
  };
}

/** The five chemistry colors (D42). */
export const CHEMISTRY_COLOR_COUNT = 5;

/** Why a set of left-out colors can't be used, or null (D180): up to 3, each once. */
export function excludedColorsError(colors: readonly number[]): string | null {
  if (colors.length > 3) return "Leave out at most 3 colors.";
  if (new Set(colors).size !== colors.length) return "A color is listed twice.";
  if (
    colors.some(
      (c) => !Number.isInteger(c) || c < 0 || c >= CHEMISTRY_COLOR_COUNT,
    )
  )
    return "That isn't a chemistry color.";
  return null;
}

/** The colors a pack can hold once some are left out (D180); undefined = all. */
export function allowedColors(
  excluded: readonly number[] = [],
): number[] | undefined {
  if (excluded.length === 0) return undefined;
  return Array.from({ length: CHEMISTRY_COLOR_COUNT }, (_, c) => c).filter(
    (c) => !excluded.includes(c),
  );
}

export interface PackChoice {
  /** Overall points the odds move with the club's Elo (D179). */
  eloShift?: number;
  /** Chemistry colors left out (D180). */
  excludedColors?: readonly number[];
}

/**
 * What a pack costs: the tier's price, plus the surcharges for a position
 * focus and for leaving out colors (they add up, D180), moved with the
 * club's Elo shift (D179). Rounded to 50.
 */
export function packPrice(
  tierId: string,
  focus: PackFocus,
  prices: PackPrices = DEFAULT_PACK_PRICES,
  choice: PackChoice = {},
): number {
  const price = prices.tiers[tierId] ?? boughtTier(tierId).price;
  const excluded = choice.excludedColors?.length ?? 0;
  const surcharge =
    (focus === "any" ? 0 : prices.focusSurcharge) +
    (excluded === 0
      ? 0
      : excluded === 1
        ? (prices.excludeOne ?? 0)
        : excluded === 2
          ? (prices.excludeTwo ?? 0)
          : (prices.excludeThree ?? 0));
  const elo = 1 + (choice.eloShift ?? 0) * (prices.pricePerOverall ?? 0);
  if (surcharge === 0 && elo === 1) return price;
  return Math.max(50, Math.round((price * (1 + surcharge) * elo) / 50) * 50);
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

export interface StarterPackState {
  id: string;
  opened: boolean;
  resolved: boolean;
}

/** Players chosen from the starter packs: indexes 0–4 into each pack, by pack id. */
export type StarterSelection = Record<string, readonly number[]>;

/**
 * Why a starter selection can't be confirmed, or null when it can. Every
 * starter pack must be opened and still unresolved, every chosen index must
 * exist and the roster must end up within the sport's limits (D182).
 */
export function starterSelectionError(
  packs: readonly StarterPackState[],
  selection: StarterSelection,
  limits: RosterLimits = DEFAULT_ROSTER_LIMITS,
): string | null {
  if (packs.length === 0) return "This team has no starter packs to scout.";
  if (packs.some((p) => p.resolved))
    return "Your starting squad is already picked.";
  const unopened = packs.filter((p) => !p.opened).length;
  if (unopened > 0)
    return `Open every starter pack first (${unopened} still sealed).`;
  const ids = new Set(packs.map((p) => p.id));
  let kept = 0;
  for (const [packId, indexes] of Object.entries(selection)) {
    if (!ids.has(packId)) return "That pack isn't one of your starter packs.";
    if (new Set(indexes).size !== indexes.length)
      return "A player was picked twice.";
    for (const i of indexes)
      if (!Number.isInteger(i) || i < 0 || i >= PACK_SIZE)
        return "That player isn't in the pack.";
    kept += indexes.length;
  }
  if (kept < limits.min)
    return `Keep at least ${limits.min} players (${kept} picked).`;
  if (kept > limits.max)
    return `Keep at most ${limits.max} players (${kept} picked).`;
  return null;
}

/** Why a bought pack's keep choices are invalid, or null when they're fine. */
export function packChoiceError(kept: readonly number[]): string | null {
  if (new Set(kept).size !== kept.length) return "A player was picked twice.";
  for (const i of kept)
    if (!Number.isInteger(i) || i < 0 || i >= PACK_SIZE)
      return "That player isn't in the pack.";
  return null;
}

/**
 * Why a player can't leave the roster, or null when they can. Teams keep at
 * least the sport's minimum (D182), and free starter-pack players can be
 * released but never sold (D83).
 */
export function removalError(
  rosterSize: number,
  player: { fromStarterPack: boolean },
  mode: "release" | "sell",
  limits: RosterLimits = DEFAULT_ROSTER_LIMITS,
): string | null {
  if (rosterSize <= limits.min)
    return `Keep at least ${limits.min} players: buy a pack before letting anyone go.`;
  if (mode === "sell" && player.fromStarterPack)
    return "Starter-pack players were free, so they can be released but not sold.";
  return null;
}

/** Over the maximum the next match is blocked until the roster is trimmed (D54, D182). */
export function rosterWarning(
  rosterSize: number,
  limits: RosterLimits = DEFAULT_ROSTER_LIMITS,
): string | null {
  if (rosterSize < limits.min)
    return `You need at least ${limits.min} players to play.`;
  if (rosterSize > limits.max)
    return `You have ${rosterSize} players: release or sell down to ${limits.max} before your next match.`;
  return null;
}
