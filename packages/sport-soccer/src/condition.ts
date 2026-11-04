/**
 * Player condition between game weeks (D45, M4): match fitness carries over
 * and recovers, injuries and suspensions count down, and yellow cards add
 * up to bans. Unavailable players are swapped out of the matchday squad
 * automatically, so a week can always be played.
 */
import type { PlayerMatchReport } from "./match";
import {
  BENCH_SIZE,
  formation,
  type MatchdaySquad,
  type PickablePlayer,
  slotRating,
} from "./matchday";

/** Balance defaults: changed only with Gary's OK. */
export interface ConditionSettings {
  /** Fitness regained each game week, up to 100. */
  weeklyRecovery: number;
  /** Matches banned for a red card. */
  redCardBan: number;
  /** Every this many yellow cards in a season earns a ban. */
  yellowsForBan: number;
  yellowBan: number;
}

export const DEFAULT_CONDITION_SETTINGS: ConditionSettings = {
  weeklyRecovery: 20,
  redCardBan: 1,
  yellowsForBan: 5,
  yellowBan: 1,
};

export interface PlayerCondition {
  /** Match fitness at the next kickoff, 0–100. */
  fitness: number;
  /** Game weeks still out injured. */
  injuredWeeks: number;
  /** Matches still to sit out. */
  suspendedWeeks: number;
  /** Yellow cards this season. */
  yellowCards: number;
}

export const FRESH: PlayerCondition = {
  fitness: 100,
  injuredWeeks: 0,
  suspendedWeeks: 0,
  yellowCards: 0,
};

export function isAvailable(c: PlayerCondition): boolean {
  return c.injuredWeeks === 0 && c.suspendedWeeks === 0;
}

/**
 * A player's condition after a game week. `report` is their line from the
 * week's match, or undefined if they weren't in the squad (or the team had
 * no match). Fitness recovers from where the match left it; existing
 * injuries and bans count down before new ones are added.
 */
export function nextCondition(
  before: PlayerCondition,
  report: PlayerMatchReport | undefined,
  s: ConditionSettings = DEFAULT_CONDITION_SETTINGS,
): PlayerCondition {
  const start = report ? report.energy : before.fitness;
  const fitness = Math.min(100, Math.round(start + s.weeklyRecovery));
  let injuredWeeks = Math.max(0, before.injuredWeeks - 1);
  let suspendedWeeks = Math.max(0, before.suspendedWeeks - 1);
  let yellowCards = before.yellowCards;
  if (report) {
    if (report.injuryWeeks > 0)
      injuredWeeks = Math.max(injuredWeeks, report.injuryWeeks);
    if (report.redCard) {
      suspendedWeeks += s.redCardBan;
      // A second yellow's cards count toward the red, not the running total.
    } else if (report.yellowCards > 0) {
      const crossed =
        Math.floor((yellowCards + report.yellowCards) / s.yellowsForBan) -
        Math.floor(yellowCards / s.yellowsForBan);
      yellowCards += report.yellowCards;
      suspendedWeeks += crossed * s.yellowBan;
    }
  }
  return { fitness, injuredWeeks, suspendedWeeks, yellowCards };
}

/**
 * The squad that actually plays this week: unavailable starters are
 * replaced by the best available player for their slot (bench first, then
 * anyone else on the roster), unavailable substitutes drop out, and planned
 * substitutions involving anyone moved are cancelled. Throws if fewer than
 * 11 players are available.
 */
export function availableSquad(
  squad: MatchdaySquad,
  roster: readonly PickablePlayer[],
  available: (id: string) => boolean,
): { squad: MatchdaySquad; replaced: { out: string; in: string }[] } {
  const shape = formation(squad.formation);
  if (!shape) throw new Error(`Unknown formation: ${squad.formation}`);
  const byId = new Map(roster.map((p) => [p.id, p]));
  const fit = (id: string) => byId.has(id) && available(id);
  const used = new Set(squad.lineup.filter(fit));
  const bench = squad.bench.filter((id) => fit(id) && !used.has(id));
  const reserves = roster
    .filter((p) => fit(p.id) && !used.has(p.id) && !squad.bench.includes(p.id))
    .map((p) => p.id);
  const replaced: { out: string; in: string }[] = [];
  const lineup = squad.lineup.map((id, i) => {
    if (fit(id)) return id;
    const position = shape.slots[i]?.position ?? "CM";
    const pool = bench.length > 0 ? bench : reserves;
    let best = -1;
    pool.forEach((candidate, k) => {
      const p = byId.get(candidate) as PickablePlayer;
      const b =
        best === -1 ? null : (byId.get(pool[best] as string) as PickablePlayer);
      if (!b || slotRating(p, position) > slotRating(b, position)) best = k;
    });
    if (best === -1)
      throw new Error(
        "Not enough fit players: at least 11 must be available to play.",
      );
    const [chosen] = pool.splice(best, 1) as [string];
    used.add(chosen);
    replaced.push({ out: id, in: chosen });
    return chosen;
  });
  // Top the bench back up from the rest of the roster.
  while (bench.length < BENCH_SIZE && reserves.length > 0)
    bench.push(reserves.shift() as string);
  const benchSet = new Set(bench);
  const onPitch = new Set(lineup);
  const subPlan = squad.subPlan.filter(
    (s) =>
      benchSet.has(s.inId) && (onPitch.has(s.outId) || benchSet.has(s.outId)),
  );
  return {
    squad: { formation: squad.formation, lineup, bench, subPlan },
    replaced,
  };
}

/** Everyone starts a new season fresh: fit, no bans, no yellow cards; injuries carry on. */
export function seasonReset(c: PlayerCondition): PlayerCondition {
  return {
    fitness: 100,
    injuredWeeks: c.injuredWeeks,
    suspendedWeeks: 0,
    yellowCards: 0,
  };
}
