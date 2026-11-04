/**
 * Form and morale (D45, M4). Form is how well a player has been playing
 * lately; morale is how the team feels after recent results. Both are
 * numbers from −1 to 1 that nudge skill in the next match a little.
 */
import type { PlayerMatchReport } from "./match";

/** Balance defaults: changed only with Gary's OK. */
export interface FormSettings {
  /** Skill change at form +1 or −1 (0.05 = ±5%). */
  formEffect: number;
  /** Skill change at morale +1 or −1, for every player in the team. */
  moraleEffect: number;
  /** Share of old form kept after a match (the rest is the new rating). */
  formMemory: number;
  /** Form kept each week a player doesn't play (it drifts back to 0). */
  formIdleDecay: number;
  /** Share of old morale kept after a match. */
  moraleMemory: number;
  /** Morale added for a win, removed for a loss. */
  moraleSwing: number;
}

export const DEFAULT_FORM_SETTINGS: FormSettings = {
  formEffect: 0.05,
  moraleEffect: 0.03,
  formMemory: 0.6,
  formIdleDecay: 0.8,
  moraleMemory: 0.7,
  moraleSwing: 0.3,
};

export type TeamResult = "win" | "draw" | "loss";

const clamp = (v: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));
const round = (v: number) => Math.round(v * 1000) / 1000;

/**
 * A simple 1–10 match rating: 6 for an ordinary game, up for goals and
 * wins, down for losses and cards. Only for players who played.
 */
export function matchRating(
  report: PlayerMatchReport,
  result: TeamResult,
): number {
  let rating = 6;
  rating += report.goals;
  if (result === "win") rating += 0.5;
  if (result === "loss") rating -= 0.5;
  rating -= report.yellowCards * 0.5;
  if (report.redCard) rating -= 2;
  if (report.minutes < 30) rating = 6 + (rating - 6) / 2; // A cameo counts for less.
  return clamp(rating, 1, 10);
}

/** Form after a game week: blends in this match's rating, or drifts toward 0 if the player sat out. */
export function nextForm(
  form: number,
  report: PlayerMatchReport | undefined,
  result: TeamResult | null,
  s: FormSettings = DEFAULT_FORM_SETTINGS,
): number {
  if (!report || report.minutes === 0 || !result)
    return round(form * s.formIdleDecay);
  const performance = clamp((matchRating(report, result) - 6) / 2);
  return round(clamp(form * s.formMemory + performance * (1 - s.formMemory)));
}

/** Team morale after a game week (unchanged when the team had no match). */
export function nextMorale(
  morale: number,
  result: TeamResult | null,
  s: FormSettings = DEFAULT_FORM_SETTINGS,
): number {
  if (!result) return morale;
  const swing =
    result === "win" ? s.moraleSwing : result === "loss" ? -s.moraleSwing : 0;
  return round(clamp(morale * s.moraleMemory + swing));
}

/** The skill modifier a player takes into a match from their form and the team's morale. */
export function formModifier(
  form: number,
  morale: number,
  s: FormSettings = DEFAULT_FORM_SETTINGS,
): number {
  return round(clamp(form) * s.formEffect + clamp(morale) * s.moraleEffect);
}
