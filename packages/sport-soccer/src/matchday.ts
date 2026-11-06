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
import {
  DEFAULT_EFFECTIVE_SKILL_CONFIG,
  effectiveSkill,
} from "./effective-skill";
import {
  DEFAULT_MATCH_TUNING,
  type MatchTuning,
  PLAYERS_ON_FIELD,
  type PlannedSub,
  type SoccerTeam,
} from "./match";
import type { SoccerPlayer } from "./player";
import type { Position } from "./positions";
import type { SlotSide } from "./templates";

/** A place in a formation. `x` runs 0 (left) to 100 (right), `y` 0 (own goal) to 100. */
export interface FormationSlot {
  position: Position;
  x: number;
  y: number;
  /** Left or right when the formation has several of this position (D112). */
  side?: SlotSide;
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

/**
 * Marks shared positions left and right (D112): of two or more slots in the
 * same position, the leftmost is "left" and the rightmost "right"; a third
 * in between (e.g. the middle of three CBs) keeps the template as painted.
 */
function withSides(f: Formation): Formation {
  const slots = f.slots.map((s) => {
    const same = f.slots.filter((o) => o.position === s.position);
    if (same.length < 2) return { ...s };
    const xs = same.map((o) => o.x);
    if (s.x === Math.min(...xs)) return { ...s, side: "left" as const };
    if (s.x === Math.max(...xs)) return { ...s, side: "right" as const };
    return { ...s };
  });
  return { ...f, slots };
}

/** A slot's short name: "LCB" and "RCB" for a pair of centre-backs, else "CB". */
export function slotLabel(
  slot: Pick<FormationSlot, "position" | "side">,
): string {
  if (!slot.side) return slot.position;
  return `${slot.side === "left" ? "L" : "R"}${slot.position}`;
}

/** Formation presets for the lineup (D88). Tactics and mentality come later. */
export const FORMATIONS: readonly Formation[] = (
  [
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
  ] as Formation[]
).map(withSides);

export const DEFAULT_FORMATION = "4-4-2";
/** The most substitutes soccer allows (D182); a sport's bench may be smaller. */
export const BENCH_SIZE = 11;
export const LATEST_PLAN_MINUTE = 89;

/**
 * Formations admins created (D140). They can't be changed once made, so a
 * match that used one replays the same; loaded from the database and
 * registered here before squads that may use them are read.
 */
const custom = new Map<string, Formation>();

/**
 * Adds admin-made formations to the lookup. Built-in ids are ignored, and a
 * formation already registered keeps its first definition.
 */
export function registerFormations(
  list: readonly { id: string; slots: readonly FormationSlot[] }[],
): void {
  for (const f of list) {
    if (FORMATIONS.some((b) => b.id === f.id) || custom.has(f.id)) continue;
    custom.set(f.id, buildFormation(f.id, f.slots));
  }
}

export function formation(id: string): Formation | undefined {
  return FORMATIONS.find((f) => f.id === id) ?? custom.get(id);
}

/** A formation from its slots, keeper first, with left and right worked out (D112). */
export function buildFormation(
  id: string,
  slots: readonly Pick<FormationSlot, "position" | "x" | "y">[],
): Formation {
  const ordered = [
    ...slots.filter((s) => s.position === "GK"),
    ...slots.filter((s) => s.position !== "GK"),
  ].map((s) => ({ position: s.position, x: s.x, y: s.y }));
  return withSides({ id, slots: ordered });
}

/** Ids look like "4-4-2" or "4-3-2-1b": digits and dashes, a letter or two allowed. */
export const FORMATION_ID = /^[0-9](?:[0-9-]*[0-9])?[a-z]{0,2}$/;

/**
 * Everything wrong with a new formation (D140), in plain English: an unused
 * id, 11 slots with exactly one keeper, outfield positions only elsewhere,
 * places on the pitch, and no two slots on the same spot.
 */
export function formationProblems(
  id: string,
  slots: readonly Pick<FormationSlot, "position" | "x" | "y">[],
  existing: readonly string[],
): string[] {
  const problems: string[] = [];
  if (!FORMATION_ID.test(id) || id.length > 16)
    problems.push('Name it like "4-5-1" or "4-3-2-1b".');
  else if (existing.includes(id) || formation(id))
    problems.push(`${id} already exists.`);
  if (slots.length !== PLAYERS_ON_FIELD)
    problems.push(`Use ${PLAYERS_ON_FIELD} slots (${slots.length} now).`);
  const keepers = slots.filter((s) => s.position === "GK").length;
  if (keepers !== 1) problems.push("Use exactly one goalkeeper.");
  if (
    slots.some(
      (s) =>
        !Number.isInteger(s.x) ||
        !Number.isInteger(s.y) ||
        s.x < 0 ||
        s.x > 100 ||
        s.y < 0 ||
        s.y > 100,
    )
  )
    problems.push("Place every slot on the pitch (0 to 100 each way).");
  const spots = new Set(slots.map((s) => `${s.x},${s.y}`));
  if (spots.size !== slots.length) problems.push("Two slots share a spot.");
  return problems;
}

/** What the manager saves: player ids by slot, the bench in order, and a sub plan. */
export interface MatchdaySquad {
  formation: string;
  /** Starters, one per formation slot, in slot order. */
  lineup: string[];
  bench: string[];
  subPlan: PlannedSub[];
}

/**
 * A player's rating in a slot: overall there plus the position-fit bonus, no
 * chemistry. `outOfPosition` is the season's penalty for anywhere other than
 * the player's two positions (D135), 0 when it isn't on.
 */
export function slotRating(
  player: SoccerPlayer,
  position: Position,
  outOfPosition = 0,
): number {
  const config = outOfPosition
    ? {
        ...DEFAULT_EFFECTIVE_SKILL_CONFIG,
        positionFit: {
          ...DEFAULT_EFFECTIVE_SKILL_CONFIG.positionFit,
          other: outOfPosition,
        },
      }
    : DEFAULT_EFFECTIVE_SKILL_CONFIG;
  return Math.round(
    effectiveSkill({ player, slot: position, chemistryBoost: 0 }, config),
  );
}

/** Whether a player plays this position: their primary or secondary one (D135). */
export const playsPosition = (player: SoccerPlayer, position: Position) =>
  player.primaryPosition === position || player.secondaryPosition === position;

/**
 * Everything wrong with a squad, in plain English (empty when it's ready to
 * play): 11 starters in a known formation, 11 substitutes, nobody twice,
 * everyone on the roster, and a sub plan the engine can follow (D81).
 */
export function squadProblems(
  squad: MatchdaySquad,
  rosterIds: ReadonlySet<string>,
  tuning: Pick<MatchTuning, "maxSubs" | "maxSubWindows"> = DEFAULT_MATCH_TUNING,
  benchMax: number = BENCH_SIZE,
): string[] {
  const problems: string[] = [];
  const shape = formation(squad.formation);
  if (!shape) problems.push("Pick a formation.");
  if (squad.lineup.length !== PLAYERS_ON_FIELD)
    problems.push(
      `Pick ${PLAYERS_ON_FIELD} starters (${squad.lineup.length} picked).`,
    );
  // Up to the sport's bench size (D182); fewer just means fewer subs.
  if (squad.bench.length > benchMax)
    problems.push(
      `Pick at most ${benchMax} substitutes (${squad.bench.length} picked).`,
    );
  // An empty starter slot ("") is allowed: the club plays a man down (D183).
  const everyone = [...squad.lineup, ...squad.bench].filter(Boolean);
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
  /** False for injured or suspended players; they're never picked (D183). */
  available?: (id: string) => boolean;
  /**
   * Multiplies a player's rating when choosing, e.g. lower for tired or
   * out-of-form players (1 = no change).
   */
  weight?: (id: string) => number;
  /** Substitutes to pick, up to the sport's bench size (D182); 11 by default. */
  benchSize?: number;
  /**
   * True for players too tired to start (D188): they're picked only when
   * nobody fitter can fill the slot, even out of position.
   */
  rested?: (id: string) => boolean;
}

/**
 * A sensible squad: fills the formation's slots, scarcest first (the
 * keeper), with the best available rating in each, then puts the next best
 * 11 on the bench, making sure a spare keeper is among them. Unavailable
 * players (injured, suspended) are never picked: a slot nobody fit can
 * fill is left empty and the club plays a man down (D183).
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
  const rested = options.rested ?? (() => false);
  // Available players always outrank unavailable ones, then players fit
  // enough to start (D188), then players in their own positions (D135),
  // then by weighted rating.
  const score = (p: PickablePlayer, rating: number) =>
    (available(p.id) ? 1_000_000 : 0) +
    (rested(p.id) ? 0 : 10_000) +
    rating * weight(p.id);
  const slotScore = (p: PickablePlayer, position: Position) =>
    score(p, slotRating(p, position)) +
    (playsPosition(p, position) ? 1_000 : 0);
  // Injured and suspended players are never picked: a slot nobody fit can
  // fill stays empty (""), as at kickoff (D183).
  const free = new Map(
    players.filter((p) => available(p.id)).map((p) => [p.id, p]),
  );
  const order = shape.slots
    .map((s, i) => ({ s, i }))
    .sort(
      (a, b) => Number(b.s.position === "GK") - Number(a.s.position === "GK"),
    );
  const lineup: string[] = Array(shape.slots.length).fill("");
  for (const { s, i } of order) {
    let best: PickablePlayer | undefined;
    for (const p of free.values())
      if (!best || slotScore(p, s.position) > slotScore(best, s.position))
        best = p;
    if (!best) break;
    lineup[i] = best.id;
    free.delete(best.id);
  }
  const rest = [...free.values()].sort(
    (a, b) => score(b, b.overall) - score(a, a.overall),
  );
  const benchSize = options.benchSize ?? BENCH_SIZE;
  const bench = rest.slice(0, benchSize);
  const spareKeeper = rest.find(
    (p) => p.primaryPosition === "GK" && available(p.id),
  );
  if (
    spareKeeper &&
    !bench.includes(spareKeeper) &&
    benchSize > 0 &&
    bench.length === benchSize
  )
    bench[benchSize - 1] = spareKeeper;
  return {
    formation: shape.id,
    lineup: players.length === 0 ? [] : lineup,
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

const slotOf = ({ position, side }: FormationSlot) =>
  side ? { slot: position, side } : { slot: position };

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
    // An empty slot ("") is a club playing a man down (D183).
    lineup: squad.lineup.flatMap((id, i) =>
      id
        ? [{ player: get(id), ...slotOf(shape.slots[i] as FormationSlot) }]
        : [],
    ),
    bench: squad.bench.map(get),
    subPlan: squad.subPlan.map((s) => ({ ...s })),
  };
}

/**
 * The formation most like `fromId` among `candidates` (D140): the most
 * positions in common, then the earliest in the list. For moving a club off
 * a formation that's been turned off.
 */
export function closestFormation(
  fromId: string,
  candidates: readonly Formation[],
): Formation | undefined {
  const from = formation(fromId);
  const count = (f: Formation) => {
    const left = (from?.slots ?? []).map((s) => s.position);
    let common = 0;
    for (const s of f.slots) {
      const i = left.indexOf(s.position);
      if (i >= 0) {
        common++;
        left.splice(i, 1);
      }
    }
    return common;
  };
  let best: Formation | undefined;
  let bestCount = -1;
  for (const f of candidates) {
    const c = count(f);
    if (c > bestCount) {
      best = f;
      bestCount = c;
    }
  }
  return best;
}

/**
 * The same squad in another formation (D140): the same 11 starters, bench
 * and sub plan, each starter put in a slot of their old position where
 * there is one, then where they can play, then where they rate best.
 */
export function moveSquad(
  squad: MatchdaySquad,
  to: Formation,
  playersById: ReadonlyMap<string, SoccerPlayer>,
): MatchdaySquad {
  const fromSlots = formation(squad.formation)?.slots ?? [];
  const left = squad.lineup.map((id, i) => ({
    id,
    was: fromSlots[i]?.position,
  }));
  const lineup: (string | undefined)[] = to.slots.map(() => undefined);
  const place = (fits: (p: (typeof left)[number], at: Position) => boolean) => {
    to.slots.forEach((slot, i) => {
      if (lineup[i]) return;
      const k = left.findIndex((p) => fits(p, slot.position));
      if (k < 0) return;
      lineup[i] = left[k]?.id;
      left.splice(k, 1);
    });
  };
  place((p, at) => p.was === at);
  place((p, at) => {
    const player = playersById.get(p.id);
    return player !== undefined && playsPosition(player, at);
  });
  to.slots.forEach((slot, i) => {
    if (lineup[i] || left.length === 0) return;
    const rating = (id: string) => {
      const player = playersById.get(id);
      return player ? slotRating(player, slot.position) : -1;
    };
    let k = 0;
    left.forEach((p, j) => {
      if (rating(p.id) > rating((left[k] as { id: string }).id)) k = j;
    });
    lineup[i] = left[k]?.id;
    left.splice(k, 1);
  });
  return {
    ...squad,
    formation: to.id,
    lineup: lineup.filter((id): id is string => id !== undefined),
  };
}
