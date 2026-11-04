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

/** Every pack tier, by id. Bought tiers arrive later in M2. */
export const PACK_TIERS: Record<string, PackTier> = {
  [STARTER_TIER.id]: STARTER_TIER,
};

export function packTier(id: string): PackTier {
  const tier = PACK_TIERS[id];
  if (!tier) throw new Error(`Unknown pack tier: ${id}`);
  return tier;
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
