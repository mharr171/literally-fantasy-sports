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

/** A team needs at least a full matchday 22 (11 + 11 bench) to play. */
export const ROSTER_MIN = 22;
/** Most players a team can hold. */
export const ROSTER_MAX = 30;

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
}

const bandTier = (
  id: string,
  name: string,
  price: number,
  bands: [min: number, max: number, percent: number][],
): BoughtTier => {
  const odds = bands.map(([min, max, weight]) => ({ min, max, weight }));
  const total = odds.reduce((a, b) => a + b.weight, 0);
  return {
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
];

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
}

export const DEFAULT_PACK_PRICES: PackPrices = {
  tiers: Object.fromEntries(BOUGHT_TIERS.map((t) => [t.id, t.price])),
  focusSurcharge: FOCUS_SURCHARGE,
};

/** What a pack costs: the tier's price, plus the surcharge for a position focus. */
export function packPrice(
  tierId: string,
  focus: PackFocus,
  prices: PackPrices = DEFAULT_PACK_PRICES,
): number {
  const price = prices.tiers[tierId] ?? boughtTier(tierId).price;
  if (focus === "any") return price;
  return Math.round((price * (1 + prices.focusSurcharge)) / 50) * 50;
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
): GeneratedPlayer[] {
  return generatePack(createRng(seed), focus, packTier(tierId), settings);
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
 * exist and the roster must end up with 22–30 players.
 */
export function starterSelectionError(
  packs: readonly StarterPackState[],
  selection: StarterSelection,
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
  if (kept < ROSTER_MIN)
    return `Keep at least ${ROSTER_MIN} players (${kept} picked).`;
  if (kept > ROSTER_MAX)
    return `Keep at most ${ROSTER_MAX} players (${kept} picked).`;
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
 * least ROSTER_MIN players, and free starter-pack players can be released
 * but never sold (D83).
 */
export function removalError(
  rosterSize: number,
  player: { fromStarterPack: boolean },
  mode: "release" | "sell",
): string | null {
  if (rosterSize <= ROSTER_MIN)
    return `Keep at least ${ROSTER_MIN} players: buy a pack before letting anyone go.`;
  if (mode === "sell" && player.fromStarterPack)
    return "Starter-pack players were free, so they can be released but not sold.";
  return null;
}

/** Over ROSTER_MAX the next match is blocked until the roster is trimmed (D54). */
export function rosterWarning(rosterSize: number): string | null {
  if (rosterSize < ROSTER_MIN)
    return `You need at least ${ROSTER_MIN} players to play.`;
  if (rosterSize > ROSTER_MAX)
    return `You have ${rosterSize} players: release or sell down to ${ROSTER_MAX} before your next match.`;
  return null;
}
