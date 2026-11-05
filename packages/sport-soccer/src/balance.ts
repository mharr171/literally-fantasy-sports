/**
 * Balance settings admins change without a deploy (M5): match tuning,
 * season payouts and pack prices. They live in the versioned game settings
 * (D59) like templates, so a season always pays and plays by the version
 * it started with, and replays stay exact.
 *
 * Stored keys: "tuning" (MatchTuning), "payouts" (PayoutSettings), "packs"
 * (PackPrices), "condition" (ConditionSettings) and "form" (FormSettings,
 * D158). Each may hold only some fields; the rest use the built-in
 * defaults, so versions saved before a group existed play as they did.
 */
import { DEFAULT_PAYOUTS, type PayoutSettings } from "@lfs/core";
import {
  type ConditionSettings,
  DEFAULT_CONDITION_SETTINGS,
} from "./condition";
import {
  DEFAULT_FORM_SETTINGS,
  FORM_LINES,
  FORM_STATS,
  type FormLine,
  type FormSettings,
  type FormStat,
  type FormWeightKey,
} from "./form";
import {
  colorCycleError,
  DEFAULT_MATCH_TUNING,
  type MatchTuning,
} from "./match";
import { BOUGHT_TIERS, DEFAULT_PACK_PRICES, type PackPrices } from "./roster";

export interface BalanceSettings {
  tuning: MatchTuning;
  payouts: PayoutSettings;
  packs: PackPrices;
  /** Weekly recovery and bans between game weeks (D158). */
  condition: ConditionSettings;
  /** Form and morale (D158). */
  form: FormSettings;
}

export const DEFAULT_BALANCE: BalanceSettings = {
  tuning: DEFAULT_MATCH_TUNING,
  payouts: DEFAULT_PAYOUTS,
  packs: DEFAULT_PACK_PRICES,
  condition: DEFAULT_CONDITION_SETTINGS,
  form: DEFAULT_FORM_SETTINGS,
};

/** The stamina of an average player, for the fatigue summary (D157). */
export const AVERAGE_STAMINA = 60;

/**
 * Fitness an average player loses over a full 90 minutes, and a keeper's
 * (D157), from the in-match tiredness values. The engine takes
 * `fatiguePerPhase × (1.5 − stamina / 100)` each phase, a keeper only
 * `keeperFatigueFactor` of that.
 */
export function fatiguePerMatch(
  tuning: Pick<
    MatchTuning,
    "phases" | "fatiguePerPhase" | "keeperFatigueFactor"
  >,
  stamina = AVERAGE_STAMINA,
): { outfield: number; keeper: number } {
  const perPhase = tuning.fatiguePerPhase * (1.5 - stamina / 100);
  const outfield = perPhase * tuning.phases;
  return { outfield, keeper: outfield * tuning.keeperFatigueFactor };
}

/** What an admin may set a number to, with a label and a short help line. */
export interface Limit {
  label: string;
  help?: string;
  min: number;
  max: number;
  /** Whole numbers only. */
  integer?: boolean;
}

/** The number tuning values; the color cycle (D149) is checked on its own. */
export type TuningNumberKey = Exclude<keyof MatchTuning, "colorCycle">;

export const TUNING_LIMITS: Record<TuningNumberKey, Limit> = {
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
  groupedSubs: {
    label: "Logical substitutions",
    help: "1 = save tired-player subs up so they come in groups and all subs get used when there are fewer windows than subs; 0 = off. D159.",
    min: 0,
    max: 1,
    integer: true,
  },
  outOfPosition: {
    label: "Out-of-position skill",
    help: "Skill change for a player outside their primary and secondary positions (−0.5 = −50%, 0 = off). D135.",
    min: -0.9,
    max: 0,
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

export const CONDITION_LIMITS: Record<keyof ConditionSettings, Limit> = {
  weeklyRecovery: {
    label: "Weekly recovery",
    help: "Fitness every player gets back each game week, up to 100.",
    min: 0,
    max: 100,
  },
  redCardBan: {
    label: "Red card ban",
    help: "Matches a player sits out after a red card.",
    min: 0,
    max: 5,
    integer: true,
  },
  yellowsForBan: {
    label: "Yellow cards for a ban",
    help: "Every this many yellows in a season earns a ban.",
    min: 1,
    max: 20,
    integer: true,
  },
  yellowBan: {
    label: "Yellow card ban",
    help: "Matches banned each time the yellow card count is reached.",
    min: 0,
    max: 5,
    integer: true,
  },
  playingTimeGrowth: {
    label: "Growth from playing time",
    help: "How much a young player's growth at season end depends on his minutes: 0 = not at all, 0.5 = a player who didn't play grows half as much, 1 = he barely grows. Regulars (70%+ of the club's minutes) always grow fully. D154.",
    min: 0,
    max: 1,
  },
};

const STAT_NAME: Record<FormStat, string> = {
  goals: "Goal",
  assists: "Assist",
  tackles: "Tackle",
  saves: "Save",
  cleanSheet: "Clean sheet",
};
const LINE_NAME: Record<FormLine, string> = {
  GK: "keeper",
  DEF: "defender",
  MID: "midfielder",
  ATT: "attacker",
};

/** What each stat adds to a match rating, per line (D178). */
const FORM_WEIGHT_LIMITS = Object.fromEntries(
  FORM_STATS.flatMap((stat) =>
    FORM_LINES.map((line) => [
      `${stat}${line}`,
      {
        label: `${STAT_NAME[stat]}, ${LINE_NAME[line]}`,
        help: `What one ${STAT_NAME[stat].toLowerCase()} adds to a ${LINE_NAME[line]}'s match rating when form weights by position are on${stat === "tackles" ? " (up to 10 tackles count)" : stat === "saves" ? " (up to 6 saves count)" : ""}.`,
        min: 0,
        max: 3,
      },
    ]),
  ),
) as Record<FormWeightKey, Limit>;

export const FORM_LIMITS: Record<keyof FormSettings, Limit> = {
  formEffect: {
    label: "Form effect",
    help: "Skill change at full form, up or down (0.05 = ±5%).",
    min: 0,
    max: 0.3,
  },
  moraleEffect: {
    label: "Morale effect",
    help: "Skill change for every player at full morale, up or down.",
    min: 0,
    max: 0.3,
  },
  formMemory: {
    label: "Form memory",
    help: "Share of old form kept after a match; the rest is the new match rating.",
    min: 0,
    max: 1,
  },
  formIdleDecay: {
    label: "Form kept when not playing",
    help: "Share of form kept each week a player doesn't play (it drifts back to 0).",
    min: 0,
    max: 1,
  },
  moraleMemory: {
    label: "Morale memory",
    help: "Share of old morale kept after a match.",
    min: 0,
    max: 1,
  },
  moraleSwing: {
    label: "Morale swing",
    help: "Morale gained for a win, lost for a loss.",
    min: 0,
    max: 1,
  },
  positionWeights: {
    label: "Form weights by position",
    help: "1 = each stat counts with the weights below for the player's line (keeper, defence, midfield, attack), so every position builds form alike; 0 = one set of weights for everyone. D178.",
    min: 0,
    max: 1,
    integer: true,
  },
  minutesScaling: {
    label: "Form moves with minutes",
    help: "1 = form moves in step with minutes played (a full 90 most, a cameo little), instead of halving cameos. D178.",
    min: 0,
    max: 1,
    integer: true,
  },
  ...FORM_WEIGHT_LIMITS,
  contributionRating: {
    label: "Contributions count for form",
    help: "1 = assists, tackles, saves and clean sheets raise a player's match rating, so defenders and keepers build form too; 0 = goals, results and cards only. D161.",
    min: 0,
    max: 1,
    integer: true,
  },
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
    check(limit.label, settings.tuning[key as TuningNumberKey], limit);
  if (settings.tuning.colorCycle !== undefined) {
    const e = colorCycleError(settings.tuning.colorCycle);
    if (e) errors.push(e);
  }
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
  for (const [key, limit] of Object.entries(CONDITION_LIMITS))
    check(
      limit.label,
      settings.condition[key as keyof ConditionSettings],
      limit,
    );
  for (const [key, limit] of Object.entries(FORM_LIMITS))
    check(limit.label, settings.form[key as keyof FormSettings], limit);
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

/** A stored color cycle (D149), kept only when it's a valid one. */
function colorCycleOf(stored: unknown): Pick<MatchTuning, "colorCycle"> {
  const cycle = (stored as { colorCycle?: unknown } | null)?.colorCycle;
  return colorCycleError(cycle) === null
    ? { colorCycle: [...(cycle as number[])] }
    : {};
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
      ...colorCycleOf(values.tuning),
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
    condition: {
      ...DEFAULT_CONDITION_SETTINGS,
      ...numbers<ConditionSettings>(
        values.condition,
        Object.keys(CONDITION_LIMITS),
      ),
    },
    form: {
      ...DEFAULT_FORM_SETTINGS,
      ...numbers<FormSettings>(values.form, Object.keys(FORM_LIMITS)),
    },
  };
}

/** The rows to store for a set of balance settings (checked first). */
export function balanceToRows(settings: BalanceSettings): {
  key: "tuning" | "payouts" | "packs" | "condition" | "form";
  value: unknown;
}[] {
  const errors = balanceErrors(settings);
  if (errors.length > 0) throw new Error(errors.join(" "));
  return [
    {
      key: "tuning",
      value: {
        ...settings.tuning,
        ...(settings.tuning.colorCycle
          ? { colorCycle: [...settings.tuning.colorCycle] }
          : {}),
      },
    },
    { key: "payouts", value: { ...settings.payouts } },
    {
      key: "packs",
      value: {
        tiers: { ...settings.packs.tiers },
        focusSurcharge: settings.packs.focusSurcharge,
      },
    },
    { key: "condition", value: { ...settings.condition } },
    { key: "form", value: { ...settings.form } },
  ];
}
