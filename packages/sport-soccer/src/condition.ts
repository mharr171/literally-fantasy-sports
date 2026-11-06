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
  playsPosition,
  slotRating,
} from "./matchday";

/** Balance defaults: changed only with Gary's OK. */
export interface ConditionSettings {
  /**
   * Fitness regained each day, up to 100 (ADR 0007 §5). Soccer's week is one
   * day (SOCCER_DAYS_PER_WEEK), so this is what a player gets back a week.
   */
  recoveryPerDay: number;
  /** Matches banned for a red card. */
  redCardBan: number;
  /** Every this many yellow cards in a season earns a ban. */
  yellowsForBan: number;
  yellowBan: number;
  /**
   * How much a young player's growth at season end depends on his minutes
   * (D154): 0 = not at all, 1 = a player who never played barely grows.
   */
  playingTimeGrowth: number;
  /**
   * Auto-pick rests players below this fitness: it picks a fitter player,
   * even out of position, and uses a tired one only when nobody fitter is
   * left (D188). 0 = off.
   */
  restBelowFitness: number;
}

/** Days in a soccer game week (ADR 0007 §5): one, its match day. */
export const SOCCER_DAYS_PER_WEEK = 1;

export const DEFAULT_CONDITION_SETTINGS: ConditionSettings = {
  recoveryPerDay: 20,
  redCardBan: 1,
  yellowsForBan: 5,
  yellowBan: 1,
  // Off unless a settings version turns it on (D154).
  playingTimeGrowth: 0,
  // Squad picking only, not the match engine (D188).
  restBelowFitness: 50,
};

export interface PlayerCondition {
  /** Match fitness at the next kickoff, 0–100. */
  fitness: number;
  /** Game weeks still out injured. */
  injuredDays: number;
  /** Matches still to sit out. */
  suspendedGames: number;
  /** Yellow cards this season. */
  yellowCards: number;
}

export const FRESH: PlayerCondition = {
  fitness: 100,
  injuredDays: 0,
  suspendedGames: 0,
  yellowCards: 0,
};

export function isAvailable(c: PlayerCondition): boolean {
  return c.injuredDays === 0 && c.suspendedGames === 0;
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
  /** Days the week holds, each recovering `recoveryPerDay` (ADR 0007 §5). */
  days = SOCCER_DAYS_PER_WEEK,
): PlayerCondition {
  const start = report ? report.energy : before.fitness;
  const fitness = Math.min(100, Math.round(start + s.recoveryPerDay * days));
  let injuredDays = Math.max(0, before.injuredDays - 1);
  let suspendedGames = Math.max(0, before.suspendedGames - 1);
  let yellowCards = before.yellowCards;
  if (report) {
    if (report.injuryWeeks > 0)
      injuredDays = Math.max(injuredDays, report.injuryWeeks);
    if (report.redCard) {
      suspendedGames += s.redCardBan;
      // A second yellow's cards count toward the red, not the running total.
    } else if (report.yellowCards > 0) {
      const crossed =
        Math.floor((yellowCards + report.yellowCards) / s.yellowsForBan) -
        Math.floor(yellowCards / s.yellowsForBan);
      yellowCards += report.yellowCards;
      suspendedGames += crossed * s.yellowBan;
    }
  }
  return { fitness, injuredDays, suspendedGames, yellowCards };
}

/**
 * The squad that actually plays this week: unavailable starters are
 * replaced by the best available player for their slot (bench first, then
 * anyone else on the roster), unavailable substitutes drop out, and planned
 * substitutions involving anyone moved are cancelled. A slot nobody fit
 * can fill stays empty ("") and the club plays a man down (D183); with no
 * fit keeper, the best outfield starter goes in goal and their own slot is
 * left empty. Under MIN_PLAYERS starters the match is forfeited.
 */
export function availableSquad(
  squad: MatchdaySquad,
  roster: readonly PickablePlayer[],
  available: (id: string) => boolean,
): {
  squad: MatchdaySquad;
  replaced: { out: string; in: string }[];
  /** Starters who'll take the field (11 unless the club is short). */
  starters: number;
  /** The outfield player moved in goal, if no keeper was fit. */
  keeperFromOutfield: string | null;
} {
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
      // Players in their own position first (D135), then by rating.
      const rank = (x: PickablePlayer) =>
        (playsPosition(x, position) ? 1_000 : 0) + slotRating(x, position);
      if (!b || rank(p) > rank(b)) best = k;
    });
    // Nobody left: the slot stays empty (D183).
    if (best === -1) return "";
    const [chosen] = pool.splice(best, 1) as [string];
    used.add(chosen);
    replaced.push({ out: id, in: chosen });
    return chosen;
  });
  // No fit keeper: the best outfield starter in goal, their slot empty.
  let keeperFromOutfield: string | null = null;
  const keeperSlot = shape.slots.findIndex((sl) => sl.position === "GK");
  if (keeperSlot >= 0 && lineup[keeperSlot] === "") {
    let best = -1;
    lineup.forEach((id, i) => {
      if (!id || i === keeperSlot) return;
      const p = byId.get(id) as PickablePlayer;
      const b =
        best === -1
          ? null
          : (byId.get(lineup[best] as string) as PickablePlayer);
      if (!b || slotRating(p, "GK") > slotRating(b, "GK")) best = i;
    });
    if (best >= 0) {
      lineup[keeperSlot] = lineup[best] as string;
      lineup[best] = "";
    }
  }
  // Whoever ended up in goal without being a keeper (from the bench or
  // moved across), for the season page to say so.
  if (keeperSlot >= 0 && lineup[keeperSlot]) {
    const inGoal = byId.get(lineup[keeperSlot] as string);
    if (inGoal && !playsPosition(inGoal, "GK")) keeperFromOutfield = inGoal.id;
  }
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
    starters: lineup.filter(Boolean).length,
    keeperFromOutfield,
  };
}

/** Everyone starts a new season fresh: fit, no bans, no yellow cards; injuries carry on. */
export function seasonReset(c: PlayerCondition): PlayerCondition {
  return {
    fitness: 100,
    injuredDays: c.injuredDays,
    suspendedGames: 0,
    yellowCards: 0,
  };
}
