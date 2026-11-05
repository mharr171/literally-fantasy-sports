/**
 * Form and morale (D45, M4). Form is how well a player has been playing
 * lately; morale is how the team feels after recent results. Both are
 * numbers from −1 to 1 that nudge skill in the next match a little.
 */
import type { PlayerMatchReport } from "./match";
import { POSITION_LINE, type Position } from "./positions";

/** The lines a form weight is set for (D178). */
export const FORM_LINES = ["GK", "DEF", "MID", "ATT"] as const;
export type FormLine = (typeof FORM_LINES)[number];
/** The stats a match rating counts, each weighted per line (D178). */
export const FORM_STATS = [
  "goals",
  "assists",
  "tackles",
  "saves",
  "cleanSheet",
] as const;
export type FormStat = (typeof FORM_STATS)[number];
/** E.g. "goalsDEF": what one goal adds to a defender's match rating. */
export type FormWeightKey = `${FormStat}${FormLine}`;

const LINE_OF: Record<string, FormLine> = {
  goal: "GK",
  defence: "DEF",
  midfield: "MID",
  attack: "ATT",
};
export const formLine = (position: Position): FormLine =>
  LINE_OF[POSITION_LINE[position]] ?? "MID";

/** Today's single set of weights (D161), the same for every line. */
const BASE_WEIGHTS: Record<FormStat, Record<FormLine, number>> = {
  goals: { GK: 1, DEF: 1, MID: 1, ATT: 1 },
  assists: { GK: 0.5, DEF: 0.5, MID: 0.5, ATT: 0.5 },
  tackles: { GK: 0.1, DEF: 0.1, MID: 0.1, ATT: 0.1 },
  saves: { GK: 0.25, DEF: 0.25, MID: 0.25, ATT: 0.25 },
  cleanSheet: { GK: 1, DEF: 0.5, MID: 0, ATT: 0 },
};

/** Tackles and saves count up to these many in one match. */
const TACKLES_COUNTED = 10;
const SAVES_COUNTED = 6;

/** Balance defaults: changed only with Gary's OK. */
export interface FormSettings extends FormWeights {
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
  /**
   * 1 makes the match rating also count assists, tackles, saves and clean
   * sheets (D161), so defenders and keepers build form too; 0 = goals,
   * results and cards only.
   */
  contributionRating: number;
  /**
   * 1 weights each stat per line with the values below (D178), so every
   * line builds form alike; 0 = the single set of weights.
   */
  positionWeights: number;
  /**
   * 1 moves form in step with minutes played (minutes / 90, up and down
   * alike) instead of halving short cameos (D178).
   */
  minutesScaling: number;
}

/** Per-line stat weights, stored next to the other form settings (D178). */
export type FormWeights = Record<FormWeightKey, number>;

export const DEFAULT_FORM_WEIGHTS: FormWeights = Object.fromEntries(
  FORM_STATS.flatMap((stat) =>
    FORM_LINES.map((line) => [`${stat}${line}`, BASE_WEIGHTS[stat][line]]),
  ),
) as FormWeights;

export const DEFAULT_FORM_SETTINGS: FormSettings = {
  formEffect: 0.05,
  moraleEffect: 0.03,
  formMemory: 0.6,
  formIdleDecay: 0.8,
  moraleMemory: 0.7,
  moraleSwing: 0.3,
  // Off unless a settings version turns it on (D161).
  contributionRating: 0,
  // Off unless a settings version turns them on (D178).
  positionWeights: 0,
  minutesScaling: 0,
  ...DEFAULT_FORM_WEIGHTS,
};

/** What a match rating can also know about the player and the match (D161). */
export interface RatingContext {
  /** Where the player played (their main position will do). */
  position?: Position;
  /** Goals the player's team let in; 0 is a clean sheet. */
  conceded?: number | null;
  /** Count assists, tackles, saves and clean sheets. */
  contributions?: boolean;
  /** Per-line weights (D178); the single set when left out. */
  weights?: FormWeights;
  /** Don't halve short cameos: minutes scale form instead (D178). */
  fullCameo?: boolean;
}

const DEFENDERS: readonly Position[] = ["CB", "LB", "RB"];

export type TeamResult = "win" | "draw" | "loss";

const clamp = (v: number, lo = -1, hi = 1) => Math.max(lo, Math.min(hi, v));
const round = (v: number) => Math.round(v * 1000) / 1000;

/**
 * A simple 1–10 match rating: 6 for an ordinary game, up for goals and
 * wins, down for losses and cards. With contributions on (D161) it also
 * counts assists (+0.5 each), tackles (+0.1 each, up to +1), saves (+0.25
 * each, up to +1.5) and a clean sheet after an hour or more (+1 for a
 * keeper, +0.5 for a defender). Only for players who played.
 */
export function matchRating(
  report: PlayerMatchReport,
  result: TeamResult,
  context: RatingContext = {},
): number {
  let rating = 6;
  if (context.weights && context.position) {
    // Per-line weights (D178).
    const line = formLine(context.position);
    const w = (stat: FormStat) =>
      (context.weights as FormWeights)[`${stat}${line}`];
    rating += w("goals") * report.goals;
    if (context.contributions) {
      rating += w("assists") * report.assists;
      rating += w("tackles") * Math.min(TACKLES_COUNTED, report.tackles);
      rating += w("saves") * Math.min(SAVES_COUNTED, report.saves);
      if (context.conceded === 0 && report.minutes >= 60)
        rating += w("cleanSheet");
    }
  } else {
    rating += report.goals;
    if (context.contributions) {
      rating += 0.5 * report.assists;
      rating += Math.min(1, 0.1 * report.tackles);
      rating += Math.min(1.5, 0.25 * report.saves);
      if (context.conceded === 0 && report.minutes >= 60 && context.position) {
        if (context.position === "GK") rating += 1;
        else if (DEFENDERS.includes(context.position)) rating += 0.5;
      }
    }
  }
  if (result === "win") rating += 0.5;
  if (result === "loss") rating -= 0.5;
  rating -= report.yellowCards * 0.5;
  if (report.redCard) rating -= 2;
  // A cameo counts for less, unless minutes scale form instead (D178).
  if (report.minutes < 30 && !context.fullCameo) rating = 6 + (rating - 6) / 2;
  return clamp(rating, 1, 10);
}

/** Form after a game week: blends in this match's rating, or drifts toward 0 if the player sat out. */
export function nextForm(
  form: number,
  report: PlayerMatchReport | undefined,
  result: TeamResult | null,
  s: FormSettings = DEFAULT_FORM_SETTINGS,
  context: Omit<RatingContext, "contributions" | "weights" | "fullCameo"> = {},
): number {
  if (!report || report.minutes === 0 || !result)
    return round(form * s.formIdleDecay);
  const rating = matchRating(report, result, {
    ...context,
    contributions: Boolean(s.contributionRating),
    ...(s.positionWeights ? { weights: s } : {}),
    ...(s.minutesScaling ? { fullCameo: true } : {}),
  });
  const performance = clamp((rating - 6) / 2);
  if (s.minutesScaling) {
    // Form moves toward this match's performance in step with the minutes
    // played (D178): a full 90 moves it most, a cameo little.
    const share = Math.min(1, report.minutes / 90);
    return round(
      clamp(form + (performance - form) * (1 - s.formMemory) * share),
    );
  }
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

/**
 * Per-line weights tuned with the harness (D178) so keepers, defenders,
 * midfielders and attackers average the same match rating: keepers count
 * saves and clean sheets for less, defenders and midfielders more for
 * tackles and clean sheets, attackers a little less for goals. For the
 * settings version that turns form weights by position on.
 */
export const PROPOSED_FORM_WEIGHTS: FormWeights = {
  goalsGK: 1,
  goalsDEF: 1,
  goalsMID: 1,
  goalsATT: 0.95,
  assistsGK: 0.5,
  assistsDEF: 0.5,
  assistsMID: 1,
  assistsATT: 0.47,
  tacklesGK: 0.1,
  tacklesDEF: 0.18,
  tacklesMID: 0.34,
  tacklesATT: 0.1,
  savesGK: 0.12,
  savesDEF: 0.25,
  savesMID: 0.25,
  savesATT: 0.25,
  cleanSheetGK: 0.48,
  cleanSheetDEF: 0.9,
  cleanSheetMID: 1.01,
  cleanSheetATT: 0,
};
