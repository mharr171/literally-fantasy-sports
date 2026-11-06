/**
 * Pitchers over a game and a season (ADR 0008 §5, D197, D213):
 * - a pitch budget from stamina, smaller for relievers; past it velocity,
 *   control and movement fall with every pitch;
 * - the bullpen plan, baseball's sub plan: the starter's pitch limit, a
 *   closer for the 9th and a setup man for the 8th with a lead of 3 or
 *   fewer, and the rest in order when the pitcher on the mound tires;
 * - rest days after pitching, and the next rested starter in the rotation.
 * The game layer keeps the rest days between games (in days, ADR 0007 §5).
 */
import { overallAt } from "./overall";
import type { BaseballPlayer } from "./player";

export interface FatigueTuning {
  /** A starter's budget: this many pitches at stamina 40, rising per point. */
  starterBudgetAt40: number;
  budgetPerStamina: number;
  /** A reliever's budget as a share of a starter's. */
  relieverShare: number;
  /** How much velocity, control and movement fall per pitch past the budget. */
  perPitchPast: number;
  /** The lowest they fall to. */
  floor: number;
  /** A tired pitcher comes out this many pitches past the budget. */
  tiredMargin: number;
  /**
   * A starter throwing a no-hitter (or a perfect game) stays in: no pitch
   * limit, no closer or setup man, and out only this far past the budget.
   */
  noHitterLeeway: number;
}

export const DEFAULT_FATIGUE: FatigueTuning = {
  starterBudgetAt40: 60,
  budgetPerStamina: 1,
  relieverShare: 0.35,
  perPitchPast: 0.008,
  floor: 0.6,
  tiredMargin: 10,
  noHitterLeeway: 30,
};

/** Pitches a pitcher can throw before tiring (60 at stamina 40 to 110 at 90, for starters). */
export function pitchBudget(
  pitcher: Pick<BaseballPlayer, "attributes" | "pitcherRole">,
  t: FatigueTuning = DEFAULT_FATIGUE,
): number {
  const starter =
    t.starterBudgetAt40 +
    (pitcher.attributes.stamina - 40) * t.budgetPerStamina;
  const budget =
    pitcher.pitcherRole === "reliever" ? starter * t.relieverShare : starter;
  return Math.max(10, Math.round(budget));
}

/** The multiplier on velocity, control and movement after `thrown` pitches. */
export function fatigueFactor(
  thrown: number,
  budget: number,
  t: FatigueTuning = DEFAULT_FATIGUE,
): number {
  const past = Math.max(0, thrown - budget);
  return Math.max(t.floor, 1 - past * t.perPitchPast);
}

/** A side's bullpen plan, saved with the game-day squad (D197). */
export interface BullpenPlan {
  /** The starter comes out at this many pitches (or sooner, once tired). */
  starterPitchLimit: number;
  /** Takes the 9th or later with a lead of 3 or fewer. */
  closer: string | null;
  /** Takes the 8th with a lead of 3 or fewer. */
  setup: string | null;
  /** Everyone else, in the order they come in. */
  order: readonly string[];
}

/** The largest lead the closer and setup man come in to protect. */
export const SAVE_LEAD = 3;

/**
 * A sensible plan: the best reliever (as RP) closes, the next sets up, the
 * rest follow best first; starters come out at 100 pitches.
 */
export function defaultBullpenPlan(
  bullpen: readonly BaseballPlayer[],
): BullpenPlan {
  const ranked = [...bullpen].sort(
    (a, b) =>
      overallAt(b.attributes, "RP") - overallAt(a.attributes, "RP") ||
      a.id.localeCompare(b.id),
  );
  return {
    starterPitchLimit: 100,
    closer: ranked[0]?.id ?? null,
    setup: ranked[1]?.id ?? null,
    order: ranked.slice(2).map((p) => p.id),
  };
}

export type ChangeReason = "limit" | "tired" | "closer" | "setup";

/**
 * Who comes in now, if anyone, at the start of an at-bat. `lead` is the
 * fielding side's lead; `used` holds pitchers who already pitched (they
 * can't come back) and `unavailable` relievers who need rest.
 */
export function bullpenDecision(input: {
  plan: BullpenPlan;
  current: BaseballPlayer;
  starter: boolean;
  thrown: number;
  budget: number;
  inning: number;
  lead: number;
  bullpen: readonly BaseballPlayer[];
  used: ReadonlySet<string>;
  unavailable: ReadonlySet<string>;
  /** The other side has no hits yet. */
  noHitter?: boolean;
  fatigue?: FatigueTuning;
}): { pitcher: BaseballPlayer; reason: ChangeReason } | null {
  const t = input.fatigue ?? DEFAULT_FATIGUE;
  // A starter with a no-hitter going stays in until well past his budget.
  const keepIn = input.starter && input.noHitter === true;
  if (keepIn && input.thrown < input.budget + t.noHitterLeeway) return null;
  const free = (id: string | null) =>
    id !== null &&
    id !== input.current.id &&
    !input.used.has(id) &&
    !input.unavailable.has(id)
      ? (input.bullpen.find((p) => p.id === id) ?? null)
      : null;
  const save = input.lead >= 1 && input.lead <= SAVE_LEAD;
  if (save && input.inning >= 9 && input.current.id !== input.plan.closer) {
    const closer = free(input.plan.closer);
    if (closer) return { pitcher: closer, reason: "closer" };
  }
  if (
    save &&
    input.inning === 8 &&
    input.current.id !== input.plan.setup &&
    input.current.id !== input.plan.closer
  ) {
    const setup = free(input.plan.setup);
    if (setup) return { pitcher: setup, reason: "setup" };
  }
  const reason: ChangeReason | null = keepIn
    ? "tired"
    : input.starter && input.thrown >= input.plan.starterPitchLimit
      ? "limit"
      : input.thrown >= input.budget + t.tiredMargin
        ? "tired"
        : null;
  if (!reason) return null;
  // Next in order; the setup man and closer only once the order is used up.
  for (const id of [...input.plan.order, input.plan.setup, input.plan.closer]) {
    const next = free(id);
    if (next) return { pitcher: next, reason };
  }
  return null;
}

/** Pitchers' rest rules (D213): a balance setting, under condition. */
export interface RestSettings {
  /** Days a starter rests after 100+ pitches, 75–99, 50–74 and fewer. */
  starterAfter100: number;
  starterAfter75: number;
  starterAfter50: number;
  starterShort: number;
  /** A reliever rests a day after this many pitches, or after two days running. */
  relieverPitches: number;
}

export const DEFAULT_REST: RestSettings = {
  starterAfter100: 5,
  starterAfter75: 4,
  starterAfter50: 3,
  starterShort: 1,
  relieverPitches: 25,
};

/** Rest days a starter needs after a start (D213). */
export function starterRestDays(
  pitches: number,
  rest: RestSettings = DEFAULT_REST,
): number {
  if (pitches >= 100) return rest.starterAfter100;
  if (pitches >= 75) return rest.starterAfter75;
  if (pitches >= 50) return rest.starterAfter50;
  return rest.starterShort;
}

/** Rest days a reliever needs: one after 25+ pitches or two days running (D213). */
export function relieverRestDays(
  pitches: number,
  pitchedYesterday: boolean,
  rest: RestSettings = DEFAULT_REST,
): number {
  if (pitches === 0) return 0;
  return pitches >= rest.relieverPitches || pitchedYesterday ? 1 : 0;
}

/**
 * The next starter: the first rested one in rotation order after the last
 * starter; if nobody is rested, the one with the fewest rest days left
 * (who starts already tired). `restLeft` is days still needed, by id.
 */
export function nextStarter(
  rotation: readonly string[],
  lastStarter: string | null,
  restLeft: Readonly<Record<string, number>>,
): string | null {
  if (rotation.length === 0) return null;
  const from = lastStarter ? rotation.indexOf(lastStarter) + 1 : 0;
  const ordered = rotation.map(
    (_, k) => rotation[(from + k) % rotation.length] as string,
  );
  const rested = ordered.find((id) => (restLeft[id] ?? 0) <= 0);
  if (rested) return rested;
  return ordered.reduce((best, id) =>
    (restLeft[id] ?? 0) < (restLeft[best] ?? 0) ? id : best,
  );
}
