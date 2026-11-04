/**
 * The matchday squad (D15, D45, D81, D88): a formation, 11 starters in its
 * slots, up to 11 substitutes and a sub plan. The manager builds it; the
 * match engine plays it.
 */
import {
  type ChemistryBoosts,
  chemistryBoostsByPlayer,
  chemistryColorCount,
  DEFAULT_CHEMISTRY_BOOSTS,
} from "@lfs/core";
import { effectiveSkill } from "./effective-skill";
import {
  DEFAULT_MATCH_TUNING,
  type MatchTuning,
  PLAYERS_ON_FIELD,
  type PlannedSub,
  type SoccerTeam,
} from "./match";
import type { SoccerPlayer } from "./player";
import type { Position } from "./positions";

/** A place in a formation. `x` runs 0 (left) to 100 (right), `y` 0 (own goal) to 100. */
export interface FormationSlot {
  position: Position;
  x: number;
  y: number;
}

export interface Formation {
  id: string;
  slots: FormationSlot[];
}

const slot = (position: Position, x: number, y: number): FormationSlot => ({
  position,
  x,
  y,
});

const GK = slot("GK", 50, 6);
const backFour = [
  slot("LB", 12, 26),
  slot("CB", 37, 22),
  slot("CB", 63, 22),
  slot("RB", 88, 26),
];

/** Formation presets for the lineup (D88). Tactics and mentality come later. */
export const FORMATIONS: readonly Formation[] = [
  {
    id: "4-4-2",
    slots: [
      GK,
      ...backFour,
      slot("LM", 12, 55),
      slot("CM", 37, 50),
      slot("CM", 63, 50),
      slot("RM", 88, 55),
      slot("ST", 37, 82),
      slot("ST", 63, 82),
    ],
  },
  {
    id: "4-3-3",
    slots: [
      GK,
      ...backFour,
      slot("CM", 25, 50),
      slot("DM", 50, 42),
      slot("CM", 75, 50),
      slot("LW", 15, 78),
      slot("ST", 50, 85),
      slot("RW", 85, 78),
    ],
  },
  {
    id: "4-2-3-1",
    slots: [
      GK,
      ...backFour,
      slot("DM", 37, 42),
      slot("DM", 63, 42),
      slot("LW", 15, 68),
      slot("AM", 50, 65),
      slot("RW", 85, 68),
      slot("ST", 50, 86),
    ],
  },
  {
    id: "4-1-4-1",
    slots: [
      GK,
      ...backFour,
      slot("DM", 50, 38),
      slot("LM", 12, 60),
      slot("CM", 37, 55),
      slot("CM", 63, 55),
      slot("RM", 88, 60),
      slot("ST", 50, 85),
    ],
  },
  {
    id: "3-5-2",
    slots: [
      GK,
      slot("CB", 25, 22),
      slot("CB", 50, 20),
      slot("CB", 75, 22),
      slot("LM", 10, 52),
      slot("CM", 32, 50),
      slot("DM", 50, 40),
      slot("CM", 68, 50),
      slot("RM", 90, 52),
      slot("ST", 37, 82),
      slot("ST", 63, 82),
    ],
  },
  {
    id: "5-3-2",
    slots: [
      GK,
      slot("LB", 8, 32),
      slot("CB", 30, 22),
      slot("CB", 50, 20),
      slot("CB", 70, 22),
      slot("RB", 92, 32),
      slot("CM", 28, 52),
      slot("CM", 50, 48),
      slot("CM", 72, 52),
      slot("ST", 37, 80),
      slot("ST", 63, 80),
    ],
  },
];

export const DEFAULT_FORMATION = "4-4-2";
export const BENCH_SIZE = 11;
export const LATEST_PLAN_MINUTE = 89;

export function formation(id: string): Formation | undefined {
  return FORMATIONS.find((f) => f.id === id);
}

/** What the manager saves: player ids by slot, the bench in order, and a sub plan. */
export interface MatchdaySquad {
  formation: string;
  /** Starters, one per formation slot, in slot order. */
  lineup: string[];
  bench: string[];
  subPlan: PlannedSub[];
}

/** A player's rating in a slot: overall there plus the position-fit bonus, no chemistry. */
export function slotRating(player: SoccerPlayer, position: Position): number {
  return Math.round(
    effectiveSkill({ player, slot: position, chemistryBoost: 0 }),
  );
}

/**
 * Everything wrong with a squad, in plain English (empty when it's ready to
 * play): 11 starters in a known formation, 11 substitutes, nobody twice,
 * everyone on the roster, and a sub plan the engine can follow (D81).
 */
export function squadProblems(
  squad: MatchdaySquad,
  rosterIds: ReadonlySet<string>,
  tuning: Pick<MatchTuning, "maxSubs" | "maxSubWindows"> = DEFAULT_MATCH_TUNING,
): string[] {
  const problems: string[] = [];
  const shape = formation(squad.formation);
  if (!shape) problems.push("Pick a formation.");
  if (squad.lineup.length !== PLAYERS_ON_FIELD)
    problems.push(
      `Pick ${PLAYERS_ON_FIELD} starters (${squad.lineup.length} picked).`,
    );
  if (squad.bench.length !== BENCH_SIZE)
    problems.push(
      `Pick ${BENCH_SIZE} substitutes (${squad.bench.length} picked).`,
    );
  const everyone = [...squad.lineup, ...squad.bench];
  if (new Set(everyone).size !== everyone.length)
    problems.push("A player is picked twice.");
  const missing = everyone.filter((id) => !rosterIds.has(id)).length;
  if (missing > 0)
    problems.push(
      `${missing} picked player${missing === 1 ? " has" : "s have"} left the team.`,
    );
  problems.push(...subPlanProblems(squad, tuning));
  return problems;
}

function subPlanProblems(
  squad: MatchdaySquad,
  tuning: Pick<MatchTuning, "maxSubs" | "maxSubWindows">,
): string[] {
  const plan = squad.subPlan;
  if (plan.length === 0) return [];
  const problems: string[] = [];
  if (plan.length > tuning.maxSubs)
    problems.push(`Plan at most ${tuning.maxSubs} substitutions.`);
  if (new Set(plan.map((s) => s.minute)).size > tuning.maxSubWindows)
    problems.push(
      `Plan substitutions in at most ${tuning.maxSubWindows} different minutes.`,
    );
  const onPitch = new Set(squad.lineup);
  const bench = new Set(squad.bench);
  const used = new Set<string>();
  const ordered = [...plan].sort((a, b) => a.minute - b.minute);
  for (const sub of ordered) {
    if (
      !Number.isInteger(sub.minute) ||
      sub.minute < 1 ||
      sub.minute > LATEST_PLAN_MINUTE
    ) {
      problems.push(
        `Planned substitutions happen from minute 1 to ${LATEST_PLAN_MINUTE}.`,
      );
      continue;
    }
    if (!bench.has(sub.inId) || used.has(sub.inId)) {
      problems.push("Each planned substitute must come from the bench, once.");
      continue;
    }
    if (!onPitch.has(sub.outId)) {
      problems.push(
        "A planned substitution takes off someone who isn't on the pitch then.",
      );
      continue;
    }
    used.add(sub.inId);
    onPitch.delete(sub.outId);
    onPitch.add(sub.inId);
  }
  return [...new Set(problems)];
}

export interface PickablePlayer extends SoccerPlayer {
  overall: number;
}

/** What auto-pick should know about a player's state this week (M4). */
export interface PickOptions {
  /** False for injured or suspended players; they're only used to fill gaps. */
  available?: (id: string) => boolean;
  /**
   * Multiplies a player's rating when choosing, e.g. lower for tired or
   * out-of-form players (1 = no change).
   */
  weight?: (id: string) => number;
}

/**
 * A sensible squad: fills the formation's slots, scarcest first (the
 * keeper), with the best available rating in each, then puts the next best
 * 11 on the bench, making sure a spare keeper is among them. Unavailable
 * players (injured, suspended) are never picked over available ones; they
 * only fill places nobody else can, so the squad can still be saved.
 */
export function autoPickSquad(
  players: readonly PickablePlayer[],
  formationId: string = DEFAULT_FORMATION,
  options: PickOptions = {},
): MatchdaySquad {
  const shape =
    formation(formationId) ?? (formation(DEFAULT_FORMATION) as Formation);
  const available = options.available ?? (() => true);
  const weight = options.weight ?? (() => 1);
  // Available players always outrank unavailable ones, then by weighted rating.
  const score = (p: PickablePlayer, rating: number) =>
    (available(p.id) ? 1_000 : 0) + rating * weight(p.id);
  const free = new Map(players.map((p) => [p.id, p]));
  const order = shape.slots
    .map((s, i) => ({ s, i }))
    .sort(
      (a, b) => Number(b.s.position === "GK") - Number(a.s.position === "GK"),
    );
  const lineup: string[] = Array(shape.slots.length).fill("");
  for (const { s, i } of order) {
    let best: PickablePlayer | undefined;
    for (const p of free.values())
      if (
        !best ||
        score(p, slotRating(p, s.position)) >
          score(best, slotRating(best, s.position))
      )
        best = p;
    if (!best) break;
    lineup[i] = best.id;
    free.delete(best.id);
  }
  const rest = [...free.values()].sort(
    (a, b) => score(b, b.overall) - score(a, a.overall),
  );
  const bench = rest.slice(0, BENCH_SIZE);
  const spareKeeper = rest.find(
    (p) => p.primaryPosition === "GK" && available(p.id),
  );
  if (
    spareKeeper &&
    !bench.includes(spareKeeper) &&
    bench.length === BENCH_SIZE
  )
    bench[BENCH_SIZE - 1] = spareKeeper;
  return {
    formation: shape.id,
    lineup: lineup.filter(Boolean),
    bench: bench.map((p) => p.id),
    subPlan: [],
  };
}

/** Chemistry boost of each starter, in lineup order (D42–D44, D52). */
export function lineupChemistry(
  starters: readonly SoccerPlayer[],
  boosts: ChemistryBoosts = DEFAULT_CHEMISTRY_BOOSTS,
): number[] {
  return chemistryBoostsByPlayer(
    starters.map((p) => p.chemistryColor),
    chemistryColorCount(PLAYERS_ON_FIELD),
    boosts,
  );
}

/** Turns a valid squad into the team the match engine plays. */
export function squadToTeam(
  teamId: string,
  squad: MatchdaySquad,
  playersById: ReadonlyMap<string, SoccerPlayer>,
): SoccerTeam {
  const shape = formation(squad.formation);
  if (!shape) throw new Error(`Unknown formation: ${squad.formation}`);
  const get = (id: string) => {
    const p = playersById.get(id);
    if (!p) throw new Error(`Player ${id} isn't on the team.`);
    return p;
  };
  return {
    id: teamId,
    lineup: squad.lineup.map((id, i) => ({
      player: get(id),
      slot: (shape.slots[i] as FormationSlot).position,
    })),
    bench: squad.bench.map(get),
    subPlan: squad.subPlan.map((s) => ({ ...s })),
  };
}
