/**
 * The soccer match simulation, first version (roadmap Step 4):
 *
 * 1. Each player's effective skill (position fit + chemistry).
 * 2. Each team's influence map = Σ position template × effective skill.
 * 3. ~30 possession phases. Midfield control decides who attacks; the
 *    attacking team's influence in the final third against the defenders'
 *    influence in their own third sets the odds of a chance, then a shot,
 *    then a goal weighed against the keeper.
 * 4. Knockout matches that end level go to extra time, then penalties (D30).
 *
 * Fatigue, substitutions, injuries and cards come in the next M1 PRs.
 * Everything random comes from the seed, so a match always replays exactly.
 */
import {
  addScaled,
  type ChemistryBoosts,
  chemistryBoostsByPlayer,
  chemistryColorCount,
  createInfluenceMap,
  createRng,
  DEFAULT_CHEMISTRY_BOOSTS,
  type InfluenceMap,
  type MatchInput,
  type MatchOutput,
  type MatchResult,
  type Rng,
  type Seed,
  type Side,
  sumRows,
} from "@lfs/core";
import {
  DEFAULT_EFFECTIVE_SKILL_CONFIG,
  type EffectiveSkillConfig,
  effectiveSkill,
} from "./effective-skill";
import type { SoccerPlayer } from "./player";
import type { Position } from "./positions";
import {
  flipMap,
  type PositionTemplates,
  placeholderTemplates,
  SOCCER_GRID,
} from "./templates";

export const PLAYERS_ON_FIELD = 11;

export interface LineupSlot {
  player: SoccerPlayer;
  slot: Position;
}

export interface SoccerTeam {
  id: string;
  /** The 11 starters and the positions they fill. */
  lineup: LineupSlot[];
}

/** Tuning values for the possession model. Balance defaults: changed only with Gary's OK. */
export interface MatchTuning {
  /** Possession phases in 90 minutes. */
  phases: number;
  /** Extra-time phases (30 minutes). */
  extraTimePhases: number;
  /** How sharply midfield control decides possession (1 = proportional). */
  possessionSharpness: number;
  /** Chance probability per phase when attack and defence are even. */
  chanceRate: number;
  /** How strongly an attacking edge raises (or lowers) that probability. */
  chanceSharpness: number;
  /** Probability a chance becomes a shot on goal. */
  shotRate: number;
  /** Probability a shot scores when shooter and keeper are even. */
  goalRate: number;
  /** Probability a penalty scores when taker and keeper are even. */
  penaltyRate: number;
  /** Rows (from a team's own goal line) that count as its defensive third. */
  thirdRows: number;
}

export const DEFAULT_MATCH_TUNING: MatchTuning = {
  phases: 30,
  extraTimePhases: 10,
  possessionSharpness: 1.5,
  chanceRate: 0.34,
  chanceSharpness: 1.5,
  shotRate: 0.6,
  goalRate: 0.45,
  penaltyRate: 0.76,
  thirdRows: 8,
};

export interface SoccerConfig {
  version: string;
  skill: EffectiveSkillConfig;
  chemistry: ChemistryBoosts;
  templates: PositionTemplates;
  tuning: MatchTuning;
}

export function defaultSoccerConfig(): SoccerConfig {
  return {
    version: "default-1",
    skill: DEFAULT_EFFECTIVE_SKILL_CONFIG,
    chemistry: DEFAULT_CHEMISTRY_BOOSTS,
    templates: placeholderTemplates(),
    tuning: DEFAULT_MATCH_TUNING,
  };
}

export type SoccerEvent =
  | { minute: number; type: "chance"; side: Side }
  | {
      minute: number;
      type: "goal" | "saved" | "missed";
      side: Side;
      playerId: string;
    }
  | { minute: number; type: "extra_time" }
  | {
      minute: number;
      type: "penalty";
      side: Side;
      playerId: string;
      scored: boolean;
    }
  | { minute: number; type: "full_time" };

export interface SoccerResult extends MatchResult {
  decidedBy?: "extra_time" | "penalties";
  /** Shoot-out score, only when decided on penalties. */
  penalties?: Record<Side, number>;
  /** Share of possession phases won (0–1). */
  possession: Record<Side, number>;
  shots: Record<Side, number>;
}

/** Per-team numbers the match uses, worked out once at kickoff. */
interface TeamState {
  side: Side;
  /** Influence in the team's own attacking direction. */
  map: InfluenceMap;
  midfield: number;
  attack: number;
  defence: number;
  /** Outfield players weighted by how likely they are to take a shot. */
  shooters: { id: string; weight: number; skill: number }[];
  keeper: { id: string; skill: number };
}

function prepareTeam(
  team: SoccerTeam,
  side: Side,
  config: SoccerConfig,
): TeamState {
  if (team.lineup.length !== PLAYERS_ON_FIELD) {
    throw new RangeError(
      `Team ${team.id} has ${team.lineup.length} starters, expected 11`,
    );
  }
  const colorCount = chemistryColorCount(PLAYERS_ON_FIELD);
  const chemistry = chemistryBoostsByPlayer(
    team.lineup.map((s) => s.player.chemistryColor),
    colorCount,
    config.chemistry,
  );
  const map = createInfluenceMap(SOCCER_GRID);
  const { rows } = SOCCER_GRID;
  const third = config.tuning.thirdRows;
  const shooters: TeamState["shooters"] = [];
  let keeper: TeamState["keeper"] | undefined;

  team.lineup.forEach(({ player, slot }, i) => {
    const skill = effectiveSkill(
      { player, slot, chemistryBoost: chemistry[i] as number },
      config.skill,
    );
    const template = config.templates[slot];
    addScaled(map, template, skill);
    if (slot === "GK") {
      keeper = { id: player.id, skill };
    } else {
      // Shooters: presence in the final third × finishing ability.
      const presence = sumRows(template, rows - third, rows);
      shooters.push({
        id: player.id,
        weight: presence * player.attributes.shooting,
        skill: skill * (0.5 + player.attributes.shooting / 198),
      });
    }
  });

  if (!keeper) throw new RangeError(`Team ${team.id} has no goalkeeper`);
  return {
    side,
    map,
    midfield: sumRows(map, third, rows - third),
    attack: sumRows(map, rows - third, rows),
    defence: sumRows(map, 0, third),
    shooters,
    keeper,
  };
}

const other = (side: Side): Side => (side === "home" ? "away" : "home");

/** The reference shape: a flat 4-4-2 where every player is equally good. */
const REFERENCE_SLOTS: Position[] = [
  "GK",
  "LB",
  "CB",
  "CB",
  "RB",
  "LM",
  "CM",
  "CM",
  "RM",
  "ST",
  "ST",
];

const referenceCache = new WeakMap<PositionTemplates, number>();

/**
 * How much final-third influence a balanced team has compared with a
 * balanced defence. Defences always crowd their own third, so attack and
 * defence are compared relative to this baseline: an "even" contest is one
 * that looks like a balanced 4-4-2 against a balanced 4-4-2.
 */
function referenceAttackToDefence(
  templates: PositionTemplates,
  thirdRows: number,
): number {
  const cached = referenceCache.get(templates);
  if (cached !== undefined) return cached;
  const map = createInfluenceMap(SOCCER_GRID);
  for (const slot of REFERENCE_SLOTS) addScaled(map, templates[slot], 1);
  const { rows } = SOCCER_GRID;
  const ratio =
    sumRows(map, rows - thirdRows, rows) / sumRows(map, 0, thirdRows);
  referenceCache.set(templates, ratio);
  return ratio;
}

/** Chance of `a` beating `b`, sharpened: 0.5 when equal, towards 0 or 1 as they differ. */
function edge(a: number, b: number, sharpness: number): number {
  const x = a ** sharpness;
  const y = b ** sharpness;
  return x + y === 0 ? 0.5 : x / (x + y);
}

interface Streams {
  possession: Rng;
  chances: Rng;
  shooters: Rng;
  finishing: Rng;
  penalties: Rng;
}

function playPhases(
  teams: Record<Side, TeamState>,
  templates: PositionTemplates,
  tuning: MatchTuning,
  rng: Streams,
  count: number,
  startMinute: number,
  minutes: number,
  score: Record<Side, number>,
  tally: { possession: Record<Side, number>; shots: Record<Side, number> },
  events: SoccerEvent[],
): void {
  const baseline = referenceAttackToDefence(templates, tuning.thirdRows);
  const homePossession = edge(
    teams.home.midfield,
    teams.away.midfield,
    tuning.possessionSharpness,
  );
  for (let i = 0; i < count; i++) {
    const minute =
      startMinute +
      Math.min(minutes, Math.floor(((i + 0.5) * minutes) / count) + 1);
    const side: Side = rng.possession.chance(homePossession) ? "home" : "away";
    tally.possession[side]++;
    const att = teams[side];
    const def = teams[other(side)];

    const pChance = Math.min(
      0.95,
      tuning.chanceRate *
        2 *
        edge(att.attack, def.defence * baseline, tuning.chanceSharpness),
    );
    if (!rng.chances.chance(pChance)) continue;
    events.push({ minute, type: "chance", side });

    const shooter =
      att.shooters[
        rng.shooters.weightedIndex(att.shooters.map((s) => s.weight))
      ];
    /* v8 ignore next */
    if (!shooter) continue;
    if (!rng.finishing.chance(tuning.shotRate)) {
      events.push({ minute, type: "missed", side, playerId: shooter.id });
      continue;
    }
    tally.shots[side]++;
    const pGoal = Math.min(
      0.95,
      tuning.goalRate * 2 * edge(shooter.skill, def.keeper.skill, 1),
    );
    if (rng.finishing.chance(pGoal)) {
      score[side]++;
      events.push({ minute, type: "goal", side, playerId: shooter.id });
    } else {
      events.push({ minute, type: "saved", side, playerId: shooter.id });
    }
  }
}

function shootout(
  teams: Record<Side, TeamState>,
  tuning: MatchTuning,
  rng: Rng,
  events: SoccerEvent[],
): Record<Side, number> {
  const pens: Record<Side, number> = { home: 0, away: 0 };
  const takers = (side: Side) =>
    [...teams[side].shooters].sort(
      (a, b) => b.skill - a.skill || a.id.localeCompare(b.id),
    );
  const order: Record<Side, TeamState["shooters"]> = {
    home: takers("home"),
    away: takers("away"),
  };
  const kick = (side: Side, n: number) => {
    const list = order[side];
    const taker = list[n % list.length] as TeamState["shooters"][number];
    const p = Math.min(
      0.98,
      tuning.penaltyRate *
        2 *
        edge(taker.skill, teams[other(side)].keeper.skill, 0.5),
    );
    const scored = rng.chance(p);
    if (scored) pens[side]++;
    events.push({
      minute: 120,
      type: "penalty",
      side,
      playerId: taker.id,
      scored,
    });
  };
  // Best of five, stopping early once one side can't catch up.
  const taken: Record<Side, number> = { home: 0, away: 0 };
  for (let n = 0; n < 5; n++) {
    for (const side of ["home", "away"] as const) {
      kick(side, n);
      taken[side]++;
      if (
        pens.home > pens.away + (5 - taken.away) ||
        pens.away > pens.home + (5 - taken.home)
      ) {
        return pens;
      }
    }
  }
  // Sudden death.
  for (let n = 5; pens.home === pens.away; n++) {
    kick("home", n);
    kick("away", n);
  }
  return pens;
}

/** Plays one match. Pure and deterministic for a given input and seed. */
export function simulateMatch(
  input: MatchInput<SoccerTeam, SoccerConfig>,
  seed: Seed,
): MatchOutput<SoccerEvent, SoccerResult> {
  const { config } = input;
  const { tuning } = config;
  const root = createRng(seed);
  const rng: Streams = {
    possession: root.fork("possession"),
    chances: root.fork("chances"),
    shooters: root.fork("shooters"),
    finishing: root.fork("finishing"),
    penalties: root.fork("penalties"),
  };
  const teams: Record<Side, TeamState> = {
    home: prepareTeam(input.home, "home", config),
    away: prepareTeam(input.away, "away", config),
  };
  const score: Record<Side, number> = { home: 0, away: 0 };
  const tally = {
    possession: { home: 0, away: 0 },
    shots: { home: 0, away: 0 },
  };
  const events: SoccerEvent[] = [];

  playPhases(
    teams,
    config.templates,
    tuning,
    rng,
    tuning.phases,
    0,
    90,
    score,
    tally,
    events,
  );

  let decidedBy: SoccerResult["decidedBy"];
  let penalties: SoccerResult["penalties"];
  if (input.mode === "knockout" && score.home === score.away) {
    events.push({ minute: 90, type: "extra_time" });
    playPhases(
      teams,
      config.templates,
      tuning,
      rng,
      tuning.extraTimePhases,
      90,
      30,
      score,
      tally,
      events,
    );
    if (score.home === score.away) {
      penalties = shootout(teams, tuning, rng.penalties, events);
      decidedBy = "penalties";
    } else {
      decidedBy = "extra_time";
    }
  }
  events.push({ minute: decidedBy ? 120 : 90, type: "full_time" });

  const totalPhases = tally.possession.home + tally.possession.away;
  const winner: Side | null =
    score.home > score.away
      ? "home"
      : score.away > score.home
        ? "away"
        : penalties
          ? penalties.home > penalties.away
            ? "home"
            : "away"
          : null;

  const result: SoccerResult = {
    score,
    winner,
    possession: {
      home: tally.possession.home / totalPhases,
      away: tally.possession.away / totalPhases,
    },
    shots: tally.shots,
  };
  if (decidedBy) result.decidedBy = decidedBy;
  if (penalties) result.penalties = penalties;

  return {
    result,
    events,
    // Both maps in the home team's frame, ready to overlay on one pitch.
    influence: { home: teams.home.map, away: flipMap(teams.away.map) },
  };
}
