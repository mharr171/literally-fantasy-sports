/**
 * The AI manager (D113, ADR 0002): what an AI club decides, given what it
 * can see. Pure and seeded like the rest of the engine; packages/game turns
 * the decisions into the same steps a manager takes.
 *
 * An AI club decides from the same information a manager has: overall,
 * age, positions and the shown potential range, never the hidden potential.
 */
import {
  CLUB_COLORS,
  generateName,
  pickNationality,
  type Rng,
} from "@lfs/core";
import { aiTeamName } from "./ai-team";
import {
  DEFAULT_CONDITION_SETTINGS,
  isAvailable,
  type PlayerCondition,
} from "./condition";
import type { PackFocus } from "./generation";
import {
  autoPickSquad,
  FORMATIONS,
  type MatchdaySquad,
  type PickablePlayer,
} from "./matchday";
import { type Line, POSITION_LINE, type Position } from "./positions";
import {
  DEFAULT_PACK_PRICES,
  LADDER_TIERS,
  type PackPrices,
  packPrice,
  ROSTER_MAX,
  ROSTER_MIN,
} from "./roster";
import { pickWeight, ROTATION_FITNESS_EMPHASIS } from "./squad-score";

/** How an AI club runs its squad (ADR 0002, decision 3). */
export type Personality = "builder" | "spender" | "steady";
/** How fast an AI club plays (D114). */
export type Pace = "slow" | "normal" | "fast";

export const PERSONALITIES: readonly Personality[] = [
  "builder",
  "spender",
  "steady",
];

/** Seasons a day by pace (D114, proposed defaults, adjustable in admin). */
export const PACE_SEASONS_PER_DAY: Record<Pace, number> = {
  slow: 0.5,
  normal: 1,
  fast: 2,
};

/** Share of AI clubs at each pace (ADR 0002). */
export const PACE_SHARE: Record<Pace, number> = {
  slow: 0.3,
  normal: 0.5,
  fast: 0.2,
};

/** What an AI club is like: stored with the club, seen only by admins. */
export interface AiProfile {
  personality: Personality;
  pace: Pace;
  formation: string;
}

/** A new AI club's identity: club name, colors, manager name and profile. */
export interface AiIdentity {
  name: string;
  colors: string[];
  managerName: string;
  profile: AiProfile;
}

/** Rolls a new AI club. `taken` is lower-cased names already in use. */
export function rollAiIdentity(
  rng: Rng,
  taken: ReadonlySet<string> = new Set(),
  /** The formations that are on (D140); every built-in one by default. */
  formations: readonly string[] = FORMATIONS.map((f) => f.id),
): AiIdentity {
  let name = aiTeamName(rng.fork("name"));
  for (let k = 0; taken.has(name.toLowerCase()); k++)
    name = aiTeamName(rng.fork(`name-${k}`));
  const shuffled = rng.fork("colors").shuffle(CLUB_COLORS.map((c) => c.key));
  const colors = shuffled.slice(0, rng.fork("color-count").chance(0.3) ? 3 : 2);
  const person = generateName(
    rng.fork("manager"),
    pickNationality(rng.fork("manager-nationality")),
  );
  const paceRoll = rng.fork("pace").next();
  const pace: Pace =
    paceRoll < PACE_SHARE.slow
      ? "slow"
      : paceRoll < PACE_SHARE.slow + PACE_SHARE.normal
        ? "normal"
        : "fast";
  return {
    name,
    colors,
    managerName: person.displayName,
    profile: {
      personality: rng.fork("personality").pick(PERSONALITIES),
      pace,
      formation: rng.fork("formation").pick([...formations]),
    },
  };
}

/** What an AI club sees of a player: never the hidden potential. */
export interface AiPlayerView {
  age: number;
  primaryPosition: Position;
  overall: number;
  /** The scout's range (D48). */
  potentialRange: readonly [number, number];
}

/** Players each line needs on a roster: keepers, defenders, midfielders, forwards. */
export const LINE_NEEDS: Record<Line, number> = {
  goal: 3,
  defence: 8,
  midfield: 8,
  attack: 5,
};

/** Roster size each personality aims for, within 22–30 (D54). */
/**
 * AI clubs never hold more than this, whatever the sport allows, so their
 * squads stay as before the limits moved (D182).
 */
export const AI_ROSTER_CAP = 30;

export const ROSTER_TARGET: Record<Personality, number> = {
  builder: 28,
  spender: 25,
  steady: 26,
};

/**
 * How much the club wants a player. A builder values room to grow, a
 * spender values today's overall, steady clubs a bit of both. Potential
 * counts only while a player can still grow.
 */
export function playerValue(p: AiPlayerView, personality: Personality): number {
  const [low, high] = p.potentialRange;
  const growth = p.age <= 24 ? Math.max(0, (low + high) / 2 - p.overall) : 0;
  const ageing = p.age >= 32 ? (p.age - 31) * 2 : 0;
  switch (personality) {
    case "builder":
      return p.overall + 0.8 * growth + (p.age <= 21 ? 2 : 0) - ageing;
    case "spender":
      return p.overall + 0.1 * growth - ageing / 2;
    case "steady":
      return p.overall + 0.4 * growth - ageing;
  }
}

const lineOf = (p: AiPlayerView): Line => POSITION_LINE[p.primaryPosition];

/**
 * Which players to keep from the starter packs (D83): the best by value in
 * each line up to what the line needs, then the best of the rest up to the
 * club's roster target. Returns indexes into `players`.
 */
export function pickStarterKeeps(
  players: readonly AiPlayerView[],
  personality: Personality,
): number[] {
  const order = players
    .map((p, i) => ({ i, value: playerValue(p, personality), line: lineOf(p) }))
    .sort((a, b) => b.value - a.value || a.i - b.i);
  const kept = new Set<number>();
  for (const [line, need] of Object.entries(LINE_NEEDS))
    for (const o of order.filter((x) => x.line === line).slice(0, need))
      kept.add(o.i);
  const target = Math.min(
    AI_ROSTER_CAP,
    ROSTER_MAX,
    ROSTER_TARGET[personality],
  );
  for (const o of order) {
    if (kept.size >= target) break;
    kept.add(o.i);
  }
  return [...kept].sort((a, b) => a - b);
}

/** The value of the weakest player a line relies on, or 0 if it's short. */
function lineCutoff(
  roster: readonly AiPlayerView[],
  line: Line,
  personality: Personality,
): number {
  const values = roster
    .filter((p) => lineOf(p) === line)
    .map((p) => playerValue(p, personality))
    .sort((a, b) => b - a);
  return values.length < LINE_NEEDS[line]
    ? 0
    : (values[LINE_NEEDS[line] - 1] as number);
}

const LINE_FOCUS: Record<Line, PackFocus> = {
  goal: "goal",
  defence: "defence",
  midfield: "midfield",
  attack: "attack",
};

/** Funds each personality keeps back. */
export const FUNDS_BUFFER: Record<Personality, number> = {
  builder: 2_000,
  spender: 0,
  steady: 8_000,
};

/**
 * The pack to buy now, or null to save. Spenders buy the best pack they
 * can afford, builders cheap all-position packs, steady clubs a mid-tier
 * pack aimed at their weakest line once they have a cushion. A full
 * roster buys nothing. `eloShift` is the club's pack shift (D179), which
 * moves prices the same way the shop does.
 */
export function choosePack(
  funds: number,
  roster: readonly AiPlayerView[],
  personality: Personality,
  prices: PackPrices = DEFAULT_PACK_PRICES,
  eloShift = 0,
): { tier: string; focus: PackFocus } | null {
  if (roster.length >= Math.min(AI_ROSTER_CAP, ROSTER_MAX)) return null;
  const spend = funds - FUNDS_BUFFER[personality];
  const weakest = (Object.keys(LINE_NEEDS) as Line[])
    .map((line) => ({ line, cutoff: lineCutoff(roster, line, personality) }))
    .sort((a, b) => a.cutoff - b.cutoff)[0] as { line: Line };
  const focus: PackFocus =
    personality === "builder" ? "any" : LINE_FOCUS[weakest.line];
  const tiers =
    personality === "spender"
      ? [...LADDER_TIERS].reverse()
      : personality === "steady"
        ? LADDER_TIERS.filter((t) => t.id !== "gold").reverse()
        : LADDER_TIERS.filter((t) => t.id === "basic");
  for (const t of tiers)
    if (packPrice(t.id, focus, prices, { eloShift }) <= spend)
      return { tier: t.id, focus };
  return null;
}

/**
 * Which players to keep from a bought pack (indexes 0–4): anyone who'd be
 * among the players their line relies on, while the roster has room.
 */
export function chooseKeeps(
  pack: readonly AiPlayerView[],
  roster: readonly AiPlayerView[],
  personality: Personality,
): number[] {
  const kept: number[] = [];
  const squad = [...roster];
  const order = pack
    .map((p, i) => ({ p, i }))
    .sort(
      (a, b) =>
        playerValue(b.p, personality) - playerValue(a.p, personality) ||
        a.i - b.i,
    );
  for (const { p, i } of order) {
    if (squad.length >= Math.min(AI_ROSTER_CAP, ROSTER_MAX)) break;
    if (
      playerValue(p, personality) > lineCutoff(squad, lineOf(p), personality)
    ) {
      kept.push(i);
      squad.push(p);
    }
  }
  return kept.sort((a, b) => a - b);
}

/** A rostered player as the AI sees them, with what releasing needs to know. */
export interface AiRosterPlayer extends AiPlayerView {
  id: string;
  fromStarterPack: boolean;
}

/**
 * Who leaves to bring the roster back to the club's target: the least
 * valued, never taking a line below what it needs nor the roster below
 * 22. Bought players are sold (25% back), free ones released (D83).
 */
export function chooseReleases(
  roster: readonly AiRosterPlayer[],
  personality: Personality,
): { id: string; mode: "sell" | "release" }[] {
  const target = Math.max(ROSTER_MIN, ROSTER_TARGET[personality]);
  const left = [...roster];
  const out: { id: string; mode: "sell" | "release" }[] = [];
  const counts = (line: Line) => left.filter((p) => lineOf(p) === line).length;
  const order = [...roster].sort(
    (a, b) =>
      playerValue(a, personality) - playerValue(b, personality) ||
      a.id.localeCompare(b.id),
  );
  for (const p of order) {
    if (left.length <= target) break;
    if (counts(lineOf(p)) <= LINE_NEEDS[lineOf(p)]) continue;
    left.splice(left.indexOf(p), 1);
    out.push({ id: p.id, mode: p.fromStarterPack ? "release" : "sell" });
  }
  return out;
}

/** Most youth prospects each personality takes, and the potential it wants. */
const YOUTH: Record<Personality, { most: number; minHigh: number }> = {
  builder: { most: 4, minHigh: 70 },
  steady: { most: 2, minHigh: 75 },
  spender: { most: 1, minHigh: 80 },
};

/**
 * Which youth prospects to take (D53), by index: the most promising by
 * shown potential, as many as the personality likes and the roster holds.
 */
export function chooseYouth(
  prospects: readonly AiPlayerView[],
  rosterSize: number,
  personality: Personality,
): number[] {
  const { most, minHigh } = YOUTH[personality];
  const room = Math.max(0, Math.min(AI_ROSTER_CAP, ROSTER_MAX) - rosterSize);
  return prospects
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.potentialRange[1] >= minHigh)
    .sort(
      (a, b) =>
        b.p.potentialRange[1] - a.p.potentialRange[1] ||
        playerValue(b.p, personality) - playerValue(a.p, personality) ||
        a.i - b.i,
    )
    .slice(0, Math.min(most, room))
    .map(({ i }) => i)
    .sort((a, b) => a - b);
}

/** A player as the AI picks its matchday squad: rating inputs and condition. */
export interface AiSquadPlayer extends PickablePlayer {
  condition: PlayerCondition;
  form: number;
}

/** How much each personality rests tired players (D110). */
const ROTATION: Record<Personality, number> = {
  builder: ROTATION_FITNESS_EMPHASIS,
  steady: 2,
  spender: 1,
};

/** This week's matchday squad, in the club's formation. */
export function aiSquad(
  roster: readonly AiSquadPlayer[],
  profile: AiProfile,
  /** Fitness below which a player is rested if anyone fitter can play (D188). */
  restBelowFitness = DEFAULT_CONDITION_SETTINGS.restBelowFitness,
): MatchdaySquad {
  const byId = new Map(roster.map((p) => [p.id, p]));
  return autoPickSquad(roster, profile.formation, {
    rested: (id) => (byId.get(id)?.condition.fitness ?? 100) < restBelowFitness,
    available: (id) => {
      const p = byId.get(id);
      return p ? isAvailable(p.condition) : false;
    },
    weight: (id) => {
      const p = byId.get(id);
      return p
        ? pickWeight(p.condition.fitness, p.form, ROTATION[profile.personality])
        : 1;
    },
  });
}

/** A run catches up for at most this many missed runs (D177). */
export const MAX_RUNS_OWED = 6;

/**
 * How many scheduled runs' worth of play a run is owed (D177): the time
 * since the last finished run over the time between runs, so a run that
 * comes late (GitHub's schedule is best effort) catches up and one started
 * soon after another plays little. Capped at MAX_RUNS_OWED; a first run
 * counts as one.
 */
export function runsOwed(
  lastRunAt: string | null,
  now: Date,
  runsPerDay: number,
): number {
  if (!lastRunAt) return 1;
  const hours = (now.getTime() - new Date(lastRunAt).getTime()) / 3_600_000;
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.min(MAX_RUNS_OWED, hours / (24 / runsPerDay));
}

/**
 * Weeks an AI club tries to play in one scheduled run (D114): its pace's
 * share of a 26-week season, spread over the day's runs, rounded at random
 * so the average comes out right. Energy may allow fewer.
 */
export function weeksThisRun(
  rng: Rng,
  pace: Pace,
  runsPerDay: number,
  seasonWeeks = 26,
  paceSeasonsPerDay: Record<Pace, number> = PACE_SEASONS_PER_DAY,
  /** Scheduled runs this one stands for (see `runsOwed`); 1 by default. */
  runs = 1,
): number {
  const expected =
    ((paceSeasonsPerDay[pace] * seasonWeeks) / runsPerDay) * runs;
  const whole = Math.floor(expected);
  return whole + (rng.next() < expected - whole ? 1 : 0);
}
