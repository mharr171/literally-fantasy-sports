/**
 * Balance settings admins change without a deploy (M5): match tuning,
 * season payouts and pack prices. They live in the versioned game settings
 * (D59) like templates, so a season always pays and plays by the version
 * it started with, and replays stay exact.
 *
 * Stored keys: "tuning" (MatchTuning), "payouts" (PayoutSettings) and
 * "packs" (PackPrices). Each may hold only some fields; the rest use the
 * built-in defaults.
 */
import { DEFAULT_PAYOUTS, type PayoutSettings } from "@lfs/core";
import { DEFAULT_MATCH_TUNING, type MatchTuning } from "./match";
import { BOUGHT_TIERS, DEFAULT_PACK_PRICES, type PackPrices } from "./roster";

export interface BalanceSettings {
  tuning: MatchTuning;
  payouts: PayoutSettings;
  packs: PackPrices;
}

export const DEFAULT_BALANCE: BalanceSettings = {
  tuning: DEFAULT_MATCH_TUNING,
  payouts: DEFAULT_PAYOUTS,
  packs: DEFAULT_PACK_PRICES,
};

/** What an admin may set a number to, with a label and a short help line. */
export interface Limit {
  label: string;
  help?: string;
  min: number;
  max: number;
  /** Whole numbers only. */
  integer?: boolean;
}

export const TUNING_LIMITS: Record<keyof MatchTuning, Limit> = {
  phases: {
    label: "Possession phases (90 minutes)",
    help: "More phases means more chances.",
    min: 10,
    max: 60,
    integer: true,
  },
  extraTimePhases: {
    label: "Extra-time phases",
    min: 0,
    max: 20,
    integer: true,
  },
  possessionSharpness: {
    label: "Possession sharpness",
    help: "How strongly midfield control decides possession (1 = proportional).",
    min: 0.5,
    max: 4,
  },
  chanceRate: {
    label: "Chance rate",
    help: "Chance of a chance per phase when attack and defence are even.",
    min: 0.05,
    max: 0.95,
  },
  chanceSharpness: {
    label: "Chance sharpness",
    help: "How much a stronger attack raises that chance.",
    min: 0.5,
    max: 4,
  },
  shotRate: {
    label: "Shot rate",
    help: "Share of chances that become a shot on target.",
    min: 0.1,
    max: 1,
  },
  goalRate: {
    label: "Goal rate",
    help: "Share of shots on target that score when shooter and keeper are even.",
    min: 0.05,
    max: 0.95,
  },
  penaltyRate: {
    label: "Penalty rate",
    help: "Share of shoot-out penalties scored when taker and keeper are even.",
    min: 0.3,
    max: 0.99,
  },
  thirdRows: {
    label: "Rows in each third",
    help: "Pitch rows (of 25) counted as a team's defensive and attacking third.",
    min: 4,
    max: 12,
    integer: true,
  },
  fatiguePerPhase: {
    label: "Tiredness per phase",
    help: "Energy (of 100) an average-stamina outfielder loses each phase.",
    min: 0,
    max: 5,
  },
  keeperFatigueFactor: {
    label: "Keeper tiredness factor",
    help: "Keepers tire this much as fast as outfielders.",
    min: 0,
    max: 1,
  },
  fatiguePenalty: {
    label: "Tiredness penalty",
    help: "Skill lost at zero energy (0.3 = −30%).",
    min: 0,
    max: 0.8,
  },
  autoSubEnergy: {
    label: "Auto-sub below energy",
    min: 0,
    max: 100,
    integer: true,
  },
  autoSubFromMinute: {
    label: "Auto-subs from minute",
    min: 0,
    max: 90,
    integer: true,
  },
  maxSubs: { label: "Most substitutions", min: 0, max: 5, integer: true },
  maxSubWindows: {
    label: "Most sub windows",
    help: "Separate stoppages in which subs can be made.",
    min: 1,
    max: 5,
    integer: true,
  },
  injuryRate: {
    label: "Injury rate",
    help: "Chance per player per phase, before tiredness.",
    min: 0,
    max: 0.01,
  },
  yellowRate: {
    label: "Yellow card rate",
    help: "Chance per phase that the defending team is booked.",
    min: 0,
    max: 0.5,
  },
  redRate: {
    label: "Red card rate",
    help: "Chance per phase of a straight red.",
    min: 0,
    max: 0.02,
  },
  teamMatchup: {
    label: "Team color matchup",
    help: "Skill boost when your dominant color beats theirs (0.04 = +4%, 0 = off). ADR 0003.",
    min: 0,
    max: 0.2,
  },
  teamMatchupSecond: {
    label: "Second color matchup",
    help: "The same for the second-largest color groups (0 = off).",
    min: 0,
    max: 0.2,
  },
  playerMatchup: {
    label: "Player color matchups",
    help: "Most a player's skill moves for beating (or losing to) the colors of everyone they face (0.06 = ±6%, 0 = off).",
    min: 0,
    max: 0.2,
  },
};

const money = (label: string, help?: string): Limit => ({
  label,
  ...(help ? { help } : {}),
  min: 0,
  max: 100_000,
  integer: true,
});

export const PAYOUT_LIMITS: Record<keyof PayoutSettings, Limit> = {
  perMatch: money("Every match"),
  win: money("Extra for a win"),
  draw: money("Extra for a draw"),
  quarter: money(
    "Reaching the quarter-finals",
    "12-club seasons, play-in winners included (D117).",
  ),
  playoffs: money(
    "Reaching the semi-finals",
    "On top of the quarter-final bonus.",
  ),
  final: money("Reaching the final", "On top of the semi-final bonus."),
  champion: money("Winning the final", "On top of the final bonus."),
};

export const PACK_PRICE_LIMIT: Limit = {
  label: "Price",
  min: 500,
  max: 500_000,
  integer: true,
};

export const FOCUS_SURCHARGE_LIMIT: Limit = {
  label: "Position-focus surcharge",
  help: "Focused packs cost this much more (0.2 = +20%).",
  min: 0,
  max: 2,
};

function limitError(name: string, value: unknown, limit: Limit): string | null {
  if (typeof value !== "number" || !Number.isFinite(value))
    return `${name} must be a number.`;
  if (limit.integer && !Number.isInteger(value))
    return `${name} must be a whole number.`;
  if (value < limit.min || value > limit.max)
    return `${name} must be between ${limit.min} and ${limit.max}.`;
  return null;
}

/** Everything wrong with a set of balance settings (empty when it's fine). */
export function balanceErrors(settings: BalanceSettings): string[] {
  const errors: string[] = [];
  const check = (name: string, value: unknown, limit: Limit) => {
    const e = limitError(name, value, limit);
    if (e) errors.push(e);
  };
  for (const [key, limit] of Object.entries(TUNING_LIMITS))
    check(limit.label, settings.tuning[key as keyof MatchTuning], limit);
  if (settings.tuning.maxSubWindows > Math.max(1, settings.tuning.maxSubs))
    errors.push("There can't be more sub windows than substitutions.");
  for (const [key, limit] of Object.entries(PAYOUT_LIMITS))
    check(limit.label, settings.payouts[key as keyof PayoutSettings], limit);
  for (const tier of BOUGHT_TIERS)
    check(
      `${tier.name} pack price`,
      settings.packs.tiers[tier.id],
      PACK_PRICE_LIMIT,
    );
  check(
    FOCUS_SURCHARGE_LIMIT.label,
    settings.packs.focusSurcharge,
    FOCUS_SURCHARGE_LIMIT,
  );
  const prices = BOUGHT_TIERS.map((t) => settings.packs.tiers[t.id] ?? 0);
  if (prices.some((p, i) => i > 0 && p <= (prices[i - 1] as number)))
    errors.push("Each pack tier must cost more than the one before it.");
  return errors;
}

/** Keeps only the known keys of a stored object whose values are numbers. */
function numbers<T extends object>(stored: unknown, keys: readonly string[]) {
  const out: Partial<T> = {};
  if (stored && typeof stored === "object")
    for (const k of keys) {
      const v = (stored as Record<string, unknown>)[k];
      if (typeof v === "number" && Number.isFinite(v))
        (out as Record<string, number>)[k] = v;
    }
  return out;
}

/** A stored version's balance settings; anything missing uses the defaults. */
export function balanceFromValues(
  values: Record<string, unknown>,
): BalanceSettings {
  const packs = (values.packs ?? {}) as Partial<PackPrices>;
  return {
    tuning: {
      ...DEFAULT_MATCH_TUNING,
      ...numbers<MatchTuning>(values.tuning, Object.keys(TUNING_LIMITS)),
    },
    payouts: {
      ...DEFAULT_PAYOUTS,
      ...numbers<PayoutSettings>(values.payouts, Object.keys(PAYOUT_LIMITS)),
    },
    packs: {
      tiers: {
        ...DEFAULT_PACK_PRICES.tiers,
        ...(numbers<Record<string, number>>(
          packs.tiers,
          BOUGHT_TIERS.map((t) => t.id),
        ) as Record<string, number>),
      },
      focusSurcharge:
        typeof packs.focusSurcharge === "number" &&
        Number.isFinite(packs.focusSurcharge)
          ? packs.focusSurcharge
          : DEFAULT_PACK_PRICES.focusSurcharge,
    },
  };
}

/** The rows to store for a set of balance settings (checked first). */
export function balanceToRows(
  settings: BalanceSettings,
): { key: "tuning" | "payouts" | "packs"; value: unknown }[] {
  const errors = balanceErrors(settings);
  if (errors.length > 0) throw new Error(errors.join(" "));
  return [
    { key: "tuning", value: { ...settings.tuning } },
    { key: "payouts", value: { ...settings.payouts } },
    {
      key: "packs",
      value: {
        tiers: { ...settings.packs.tiers },
        focusSurcharge: settings.packs.focusSurcharge,
      },
    },
  ];
}
