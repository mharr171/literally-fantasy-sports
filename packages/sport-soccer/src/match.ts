/**
 * The soccer match simulation (roadmap Step 4):
 *
 * 1. Each player's effective skill: position fit, chemistry and tiredness.
 * 2. Each team's influence = Σ position template × effective skill.
 * 3. ~30 possession phases. Midfield control decides who attacks; the
 *    attacking team's influence in the final third against the defenders'
 *    influence in their own third sets the odds of a chance, then a shot,
 *    then a goal weighed against the keeper.
 * 4. Between phases players tire, pick up cards and injuries, and the bench
 *    comes on: the manager's sub plan first, then automatic subs for injuries
 *    and tiredness (D36, D45).
 * 5. Knockout matches that end level go to extra time, then penalties (D30).
 *
 * Everything random comes from the seed, so a match always replays exactly.
 */
import {
  addScaled,
  type ChemistryBoosts,
  chemistryBoostsByPlayer,
  chemistryColorCount,
  colorEdge,
  createInfluenceMap,
  createRng,
  DEFAULT_CHEMISTRY_BOOSTS,
  type InfluenceMap,
  type MatchInput,
  type MatchOutput,
  type MatchResult,
  type Rng,
  rankedColors,
  type Seed,
  type Side,
  sumRows,
} from "@lfs/core";
import {
  DEFAULT_EFFECTIVE_SKILL_CONFIG,
  type EffectiveSkillConfig,
  positionFit,
} from "./effective-skill";
import { overallAt } from "./overall";
import { type SoccerPlayer, variantAt } from "./player";
import type { Position } from "./positions";
import {
  flipMap,
  type PositionTemplates,
  placeholderTemplates,
  type SlotSide,
  SOCCER_GRID,
  sideMap,
} from "./templates";

export const PLAYERS_ON_FIELD = 11;

export interface LineupSlot {
  player: SoccerPlayer;
  slot: Position;
  /** Left or right of a shared position, e.g. the left CB of two (D112). */
  side?: SlotSide;
}

/** A planned substitution: from `minute` on, swap `outId` for `inId` (D45). */
export interface PlannedSub {
  minute: number;
  outId: string;
  inId: string;
}

export interface SoccerTeam {
  id: string;
  /** The 11 starters and the positions they fill. */
  lineup: LineupSlot[];
  /** Substitutes (up to 11, D15). The engine picks the best one for each slot. */
  bench?: SoccerPlayer[];
  subPlan?: PlannedSub[];
  /** Match fitness at kickoff, 0–100, by player id (default 100). Carried between game weeks in M4. */
  fitness?: Record<string, number>;
  /**
   * Extra skill modifiers by player id, as fractions (+0.04 = +4%): form and
   * morale (M4). Missing players get 0.
   */
  modifiers?: Record<string, number>;
}

/** Tuning values. Balance defaults: changed only with Gary's OK. */
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

  /** Energy an average-stamina outfielder loses per phase (energy runs 0–100). */
  fatiguePerPhase: number;
  /** Keepers tire this much slower. */
  keeperFatigueFactor: number;
  /** Skill lost at zero energy (0.3 = −30%), scaled linearly with tiredness. */
  fatiguePenalty: number;
  /** Auto-sub a player whose energy falls below this. */
  autoSubEnergy: number;
  /** Earliest minute for a tiredness auto-sub. */
  autoSubFromMinute: number;
  maxSubs: number;
  /** Separate stoppages in which subs can be made. */
  maxSubWindows: number;

  /** Chance per player per phase of an injury, before tiredness. */
  injuryRate: number;
  /** Chance per phase that the defending team gets a yellow card. */
  yellowRate: number;
  /** Chance per phase that the defending team gets a straight red. */
  redRate: number;

  /** Color matchups (D119, ADR 0003); 0 switches each one off. Skill boost
   * for the team whose dominant color beats the other's. */
  teamMatchup: number;
  /** The same for the second colors. */
  teamMatchupSecond: number;
  /** Most a player's skill moves for winning or losing every matchup they face. */
  playerMatchup: number;
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

  fatiguePerPhase: 1,
  keeperFatigueFactor: 0.3,
  fatiguePenalty: 0.3,
  autoSubEnergy: 80,
  autoSubFromMinute: 55,
  maxSubs: 5,
  maxSubWindows: 3,

  injuryRate: 0.0004,
  yellowRate: 0.12,
  redRate: 0.0015,

  // Off unless a settings version turns them on, so seasons and replays
  // from before ADR 0003 play exactly as they did.
  teamMatchup: 0,
  teamMatchupSecond: 0,
  playerMatchup: 0,
};

/** The strengths ADR 0003 proposes, for the harness and a new settings version. */
export const PROPOSED_MATCHUPS: Pick<
  MatchTuning,
  "teamMatchup" | "teamMatchupSecond" | "playerMatchup"
> = { teamMatchup: 0.04, teamMatchupSecond: 0.02, playerMatchup: 0.06 };

/**
 * Soccer's color cycle (D138, ADR 0003): color indexes in rainbow order,
 * Red → Yellow → Green → Blue → Purple. Each beats the next two.
 */
export const SOCCER_COLOR_CYCLE: readonly number[] = [0, 3, 2, 1, 4];

export interface SoccerConfig {
  version: string;
  skill: EffectiveSkillConfig;
  chemistry: ChemistryBoosts;
  templates: PositionTemplates;
  /** Named template variants per position (D82, D84). */
  variants?: Partial<Record<Position, Record<string, InfluenceMap>>>;
  tuning: MatchTuning;
}

export function defaultSoccerConfig(): SoccerConfig {
  return {
    version: "default-2",
    skill: DEFAULT_EFFECTIVE_SKILL_CONFIG,
    chemistry: DEFAULT_CHEMISTRY_BOOSTS,
    templates: placeholderTemplates(),
    tuning: DEFAULT_MATCH_TUNING,
  };
}

export type SubReason = "plan" | "injury" | "tired" | "keeper";

export type SoccerEvent =
  | { minute: number; type: "chance"; side: Side }
  | {
      minute: number;
      type: "goal" | "saved" | "missed";
      side: Side;
      playerId: string;
    }
  | {
      minute: number;
      type: "sub";
      side: Side;
      outId: string;
      inId: string;
      reason: SubReason;
    }
  | {
      minute: number;
      type: "position_change";
      side: Side;
      playerId: string;
      slot: Position;
    }
  | {
      minute: number;
      type: "injury";
      side: Side;
      playerId: string;
      weeks: number;
    }
  | { minute: number; type: "yellow"; side: Side; playerId: string }
  | {
      minute: number;
      type: "red";
      side: Side;
      playerId: string;
      secondYellow: boolean;
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

/** What happened to each player, for fitness, injuries and suspensions later (M4). */
export interface PlayerMatchReport {
  side: Side;
  minutes: number;
  /** Energy at the final whistle (or when they went off), 0–100. */
  energy: number;
  yellowCards: number;
  redCard: boolean;
  /** Weeks out injured, 0 if not injured. */
  injuryWeeks: number;
  /** Goals scored in open play (not shoot-out penalties). */
  goals: number;
  /** Goals set up for a teammate (D143). */
  assists: number;
  /** Attacks stopped before they became a chance (D143). */
  tackles: number;
  /** Shots on target kept out, for the keeper (D143). */
  saves: number;
}

/**
 * Share of goals with an assist (D143). Player stats only: assists and
 * tackles are rolled on their own streams, so they never change a score.
 */
export const ASSIST_SHARE = 0.8;

export interface SoccerResult extends MatchResult {
  decidedBy?: "extra_time" | "penalties";
  /** Shoot-out score, only when decided on penalties. */
  penalties?: Record<Side, number>;
  /** Share of possession phases won (0–1). */
  possession: Record<Side, number>;
  shots: Record<Side, number>;
  players: Record<string, PlayerMatchReport>;
}

// ---------------------------------------------------------------------------
// Template zones, worked out once per template set.

interface Zones {
  defence: number;
  midfield: number;
  attack: number;
}

const variantZoneCache = new WeakMap<InfluenceMap, Zones>();

/** A variant template's share of each third. */
function variantZones(t: InfluenceMap, thirdRows: number): Zones {
  const cached = variantZoneCache.get(t);
  if (cached) return cached;
  const { rows } = SOCCER_GRID;
  const z = {
    defence: sumRows(t, 0, thirdRows),
    midfield: sumRows(t, thirdRows, rows - thirdRows),
    attack: sumRows(t, rows - thirdRows, rows),
  };
  variantZoneCache.set(t, z);
  return z;
}

const zoneCache = new WeakMap<
  PositionTemplates,
  { zones: Record<Position, Zones>; baseline: number }
>();

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

/**
 * Each template's share of each third, plus the baseline ratio of attack to
 * defence for a balanced 4-4-2. Defences always crowd their own third, so a
 * contest counts as "even" when it looks like balanced 4-4-2 against
 * balanced 4-4-2.
 */
function templateZones(templates: PositionTemplates, thirdRows: number) {
  const cached = zoneCache.get(templates);
  if (cached) return cached;
  const { rows } = SOCCER_GRID;
  const zones = {} as Record<Position, Zones>;
  for (const [position, t] of Object.entries(templates) as [
    Position,
    InfluenceMap,
  ][]) {
    zones[position] = {
      defence: sumRows(t, 0, thirdRows),
      midfield: sumRows(t, thirdRows, rows - thirdRows),
      attack: sumRows(t, rows - thirdRows, rows),
    };
  }
  let attack = 0;
  let defence = 0;
  for (const slot of REFERENCE_SLOTS) {
    attack += zones[slot].attack;
    defence += zones[slot].defence;
  }
  const result = { zones, baseline: attack / defence };
  zoneCache.set(templates, result);
  return result;
}

// ---------------------------------------------------------------------------
// Match state.

interface OnField {
  player: SoccerPlayer;
  slot: Position;
  side: SlotSide | undefined;
  /** Overall at this slot, and the position-fit bonus there. */
  base: number;
  fit: number;
  /** Skill this phase, after chemistry and tiredness. */
  skill: number;
  /** Sum of skill over the phases played in this slot, for the heatmap. */
  skillTotal: number;
  /** The influence template this player uses here (their variant or the slot's). */
  template: InfluenceMap;
  /** That template's share of each third. */
  zones: Zones;
}

interface TeamState {
  side: Side;
  team: SoccerTeam;
  onField: OnField[];
  bench: SoccerPlayer[];
  subsUsed: number;
  windowsUsed: number;
  planDone: Set<number>;
  /** Slot-skill totals of players who have left, for the heatmap. */
  pastContributions: { template: InfluenceMap; skillTotal: number }[];
  zones: Zones;
}

interface MatchState {
  config: SoccerConfig;
  tuning: MatchTuning;
  teams: Record<Side, TeamState>;
  reports: Record<string, PlayerMatchReport & { energyNow: number }>;
  zones: Record<Position, Zones>;
  baseline: number;
  score: Record<Side, number>;
  tally: { possession: Record<Side, number>; shots: Record<Side, number> };
  events: SoccerEvent[];
  rng: {
    possession: Rng;
    chances: Rng;
    shooters: Rng;
    finishing: Rng;
    penalties: Rng;
    injuries: Rng;
    cards: Rng;
    assists: Rng;
    tackles: Rng;
  };
}

const other = (side: Side): Side => (side === "home" ? "away" : "home");

/** Chance of `a` beating `b`, sharpened: 0.5 when equal, towards 0 or 1 as they differ. */
function edge(a: number, b: number, sharpness: number): number {
  const x = a ** sharpness;
  const y = b ** sharpness;
  return x + y === 0 ? 0.5 : x / (x + y);
}

function enterField(
  state: MatchState,
  player: SoccerPlayer,
  slot: Position,
  side?: SlotSide,
): OnField {
  const base = overallAt(
    player.attributes,
    slot,
    state.config.skill.overallWeights,
  );
  const fitKind = positionFit(player, slot);
  const fit = fitKind === "other" ? 0 : state.config.skill.positionFit[fitKind];
  // A player's own template variants apply at their primary position (D84)
  // and their secondary one (D136); anywhere else they use the slot's.
  const own = variantAt(player, slot);
  const variant = own ? state.config.variants?.[slot]?.[own] : undefined;
  // The left or right version only moves the heatmap sideways (D112); the
  // thirds, and so the match, are worked out from the template as painted.
  const painted = variant ?? state.config.templates[slot];
  const template = sideMap(painted, side);
  const zones = variant
    ? variantZones(variant, state.tuning.thirdRows)
    : (state.zones[slot] as Zones);
  return {
    player,
    slot,
    side,
    base,
    fit,
    skill: base,
    skillTotal: 0,
    template,
    zones,
  };
}

function report(state: MatchState, id: string) {
  return state.reports[id] as MatchState["reports"][string];
}

/** Recomputes every on-field player's skill and the team's zone totals. */
function refreshTeam(state: MatchState, team: TeamState): void {
  const { tuning } = state;
  const chemistry = chemistryBoostsByPlayer(
    team.onField.map((p) => p.player.chemistryColor),
    chemistryColorCount(PLAYERS_ON_FIELD),
    state.config.chemistry,
  );
  const zones: Zones = { defence: 0, midfield: 0, attack: 0 };
  const opponent = state.teams?.[other(team.side)];
  const matchups = opponent ? matchupBonuses(tuning, team, opponent) : null;
  team.onField.forEach((p, i) => {
    const energy = report(state, p.player.id).energyNow;
    const tiredness = tuning.fatiguePenalty * ((100 - energy) / 100);
    const extra = team.team.modifiers?.[p.player.id] ?? 0;
    // Same order of terms as before matchups, so replays stay exact.
    let factor = 1 + p.fit + (chemistry[i] as number) + extra - tiredness;
    if (matchups) factor += matchups[i] as number;
    p.skill = Math.max(0, p.base * factor);
    const z = p.zones;
    zones.defence += z.defence * p.skill;
    zones.midfield += z.midfield * p.skill;
    zones.attack += z.attack * p.skill;
  });
  team.zones = zones;
}

/**
 * Each on-field player's color matchup boost (D119, ADR 0003), or null when
 * matchups are off. The team matchup goes to every player of the team
 * whose dominant (or second) color beats the other's. Each player's own
 * matchup averages their color edge over the opponents they face, weighted
 * by how much influence both have where they meet: attack against
 * defence, midfield against midfield, defence against attack.
 */
function matchupBonuses(
  tuning: MatchTuning,
  team: TeamState,
  opponent: TeamState,
): number[] | null {
  if (!hasMatchups(tuning)) return null;
  const { teamMatchup, teamMatchupSecond, playerMatchup } = tuning;
  const cycle = SOCCER_COLOR_CYCLE;
  const mine = rankedColors(team.onField.map((p) => p.player.chemistryColor));
  const theirs = rankedColors(
    opponent.onField.map((p) => p.player.chemistryColor),
  );
  const won = (a: number | null, b: number | null) =>
    a !== null && b !== null && colorEdge(a, b, cycle) > 0;
  const teamBonus =
    (won(mine.first, theirs.first) ? teamMatchup : 0) +
    (won(mine.second, theirs.second) ? teamMatchupSecond : 0);
  return team.onField.map((p) => {
    if (!playerMatchup) return teamBonus;
    let weight = 0;
    let edge = 0;
    for (const o of opponent.onField) {
      const meet =
        p.zones.attack * o.zones.defence +
        p.zones.midfield * o.zones.midfield +
        p.zones.defence * o.zones.attack;
      weight += meet;
      edge +=
        meet *
        colorEdge(p.player.chemistryColor, o.player.chemistryColor, cycle);
    }
    return teamBonus + (weight > 0 ? playerMatchup * (edge / weight) : 0);
  });
}

const hasMatchups = (t: MatchTuning) =>
  Boolean(t.teamMatchup || t.teamMatchupSecond || t.playerMatchup);

function keeperOf(team: TeamState): OnField | undefined {
  return team.onField.find((p) => p.slot === "GK");
}

/** Takes a player off (sub, injury or red card); returns the slot they left. */
function removeFromField(
  team: TeamState,
  id: string,
): { slot: Position; side: SlotSide | undefined } {
  const idx = team.onField.findIndex((p) => p.player.id === id);
  const [gone] = team.onField.splice(idx, 1) as [OnField];
  team.pastContributions.push({
    template: gone.template,
    skillTotal: gone.skillTotal,
  });
  return { slot: gone.slot, side: gone.side };
}

/** The bench player who would rate highest in `slot`. */
function bestForSlot(
  state: MatchState,
  team: TeamState,
  slot: Position,
): SoccerPlayer | undefined {
  let best: SoccerPlayer | undefined;
  let bestScore = -1;
  for (const p of team.bench) {
    const candidate = enterField(state, p, slot);
    const energy = report(state, p.id).energyNow;
    const score = candidate.base * (1 + candidate.fit) * (energy / 100);
    if (score > bestScore) {
      best = p;
      bestScore = score;
    }
  }
  return best;
}

/** Whether a sub can be made now; opens a new window if this minute hasn't used one. */
function canSub(
  state: MatchState,
  team: TeamState,
  windowOpen: { value: boolean },
): boolean {
  if (team.subsUsed >= state.tuning.maxSubs) return false;
  if (!windowOpen.value && team.windowsUsed >= state.tuning.maxSubWindows)
    return false;
  return true;
}

function makeSub(
  state: MatchState,
  team: TeamState,
  outId: string,
  inPlayer: SoccerPlayer,
  minute: number,
  reason: SubReason,
  windowOpen: { value: boolean },
): void {
  const { slot, side } = removeFromField(team, outId);
  team.bench = team.bench.filter((p) => p.id !== inPlayer.id);
  team.onField.push(enterField(state, inPlayer, slot, side));
  team.subsUsed++;
  if (!windowOpen.value) {
    team.windowsUsed++;
    windowOpen.value = true;
  }
  state.events.push({
    minute,
    type: "sub",
    side: team.side,
    outId,
    inId: inPlayer.id,
    reason,
  });
}

/** If the keeper has gone and nobody replaced them, the best outfield keeper goes in goal. */
function ensureKeeper(
  state: MatchState,
  team: TeamState,
  minute: number,
): void {
  if (keeperOf(team) || team.onField.length === 0) return;
  let pick = team.onField[0] as OnField;
  for (const p of team.onField) {
    if (p.player.attributes.goalkeeping > pick.player.attributes.goalkeeping)
      pick = p;
  }
  team.pastContributions.push({
    template: pick.template,
    skillTotal: pick.skillTotal,
  });
  const replacement = enterField(state, pick.player, "GK");
  team.onField[team.onField.indexOf(pick)] = replacement;
  state.events.push({
    minute,
    type: "position_change",
    side: team.side,
    playerId: pick.player.id,
    slot: "GK",
  });
}

/** Sub plan first, then forced and tiredness subs (D45). */
function handleSubs(
  state: MatchState,
  team: TeamState,
  minute: number,
  forced: string[],
): void {
  const { tuning } = state;
  const windowOpen = { value: false };

  // 1. The manager's plan.
  (team.team.subPlan ?? []).forEach((plan, i) => {
    if (team.planDone.has(i) || minute < plan.minute) return;
    const out = team.onField.find((p) => p.player.id === plan.outId);
    const sub = team.bench.find((p) => p.id === plan.inId);
    if (!out || !sub) {
      team.planDone.add(i); // Player already off, sent off or used: skip this line.
      return;
    }
    if (!canSub(state, team, windowOpen)) return;
    team.planDone.add(i);
    makeSub(state, team, plan.outId, sub, minute, "plan", windowOpen);
  });

  // 2. Players who must come off (injured).
  for (const id of forced) {
    if (!team.onField.some((p) => p.player.id === id)) continue;
    const slot = team.onField.find((p) => p.player.id === id)?.slot as Position;
    const sub = canSub(state, team, windowOpen)
      ? bestForSlot(state, team, slot)
      : undefined;
    if (sub) {
      makeSub(
        state,
        team,
        id,
        sub,
        minute,
        slot === "GK" ? "keeper" : "injury",
        windowOpen,
      );
    } else {
      removeFromField(team, id);
    }
  }

  // 3. Tired players, most tired first.
  if (minute >= tuning.autoSubFromMinute) {
    const tired = team.onField
      .filter(
        (p) => report(state, p.player.id).energyNow < tuning.autoSubEnergy,
      )
      .sort(
        (a, b) =>
          report(state, a.player.id).energyNow -
          report(state, b.player.id).energyNow,
      );
    for (const p of tired) {
      if (!canSub(state, team, windowOpen)) break;
      const sub = bestForSlot(state, team, p.slot);
      if (!sub) break;
      // Only worth it if the substitute would actually play better.
      const fresh = enterField(state, sub, p.slot);
      const subEnergy = report(state, sub.id).energyNow;
      const nowTired =
        p.base *
        (1 +
          p.fit -
          tuning.fatiguePenalty *
            ((100 - report(state, p.player.id).energyNow) / 100));
      const incoming =
        fresh.base *
        (1 + fresh.fit - tuning.fatiguePenalty * ((100 - subEnergy) / 100));
      if (incoming <= nowTired) continue;
      makeSub(state, team, p.player.id, sub, minute, "tired", windowOpen);
    }
  }

  ensureKeeper(state, team, minute);
}

/** Tiredness, cards and injuries at the end of a phase. */
function betweenPhases(
  state: MatchState,
  minute: number,
  phaseMinutes: number,
  defending: Side,
): void {
  const { tuning, rng } = state;
  for (const side of ["home", "away"] as const) {
    const team = state.teams[side];
    const forced: string[] = [];

    for (const p of team.onField) {
      const r = report(state, p.player.id);
      r.minutes += phaseMinutes;
      p.skillTotal += p.skill;
      const stamina = p.player.attributes.stamina;
      const keeperFactor = p.slot === "GK" ? tuning.keeperFatigueFactor : 1;
      r.energyNow = Math.max(
        0,
        r.energyNow -
          tuning.fatiguePerPhase * (1.5 - stamina / 100) * keeperFactor,
      );
      // Tired players get hurt more often (up to 3× when exhausted).
      const risk = tuning.injuryRate * (1 + (2 * (100 - r.energyNow)) / 100);
      if (rng.injuries.chance(risk)) {
        r.injuryWeeks = rng.injuries.int(1, 4);
        forced.push(p.player.id);
        state.events.push({
          minute,
          type: "injury",
          side,
          playerId: p.player.id,
          weeks: r.injuryWeeks,
        });
      }
    }

    // Fouls come from the side without the ball. Players already on a
    // yellow play more carefully.
    if (side === defending && team.onField.length > 0) {
      const weights = team.onField.map((p) => {
        const base = p.slot === "GK" ? 0.05 : 0.6 + p.zones.defence;
        return report(state, p.player.id).yellowCards > 0 ? base * 0.25 : base;
      });
      if (rng.cards.chance(tuning.redRate)) {
        const p = team.onField[rng.cards.weightedIndex(weights)] as OnField;
        sendOff(state, team, p.player.id, minute, false);
      } else if (rng.cards.chance(tuning.yellowRate)) {
        const p = team.onField[rng.cards.weightedIndex(weights)] as OnField;
        const r = report(state, p.player.id);
        r.yellowCards++;
        state.events.push({
          minute,
          type: "yellow",
          side,
          playerId: p.player.id,
        });
        if (r.yellowCards === 2)
          sendOff(state, team, p.player.id, minute, true);
      }
    }

    handleSubs(state, team, minute, forced);
    refreshTeam(state, team);
  }
  // A change on one side moves the other side's color matchups (D119).
  if (hasMatchups(tuning)) {
    refreshTeam(state, state.teams.home);
    refreshTeam(state, state.teams.away);
  }
}

function sendOff(
  state: MatchState,
  team: TeamState,
  id: string,
  minute: number,
  secondYellow: boolean,
): void {
  report(state, id).redCard = true;
  state.events.push({
    minute,
    type: "red",
    side: team.side,
    playerId: id,
    secondYellow,
  });
  removeFromField(team, id);
}

/** One attack: maybe a chance, maybe a shot, maybe a goal. */
function playAttack(state: MatchState, side: Side, minute: number): void {
  const { tuning, teams, rng, events, score, tally } = state;
  const att = teams[side];
  const def = teams[other(side)];
  const pChance = Math.min(
    0.95,
    tuning.chanceRate *
      2 *
      edge(
        att.zones.attack,
        def.zones.defence * state.baseline,
        tuning.chanceSharpness,
      ),
  );
  if (!rng.chances.chance(pChance)) {
    creditTackle(state, def);
    return;
  }
  events.push({ minute, type: "chance", side });

  const shooters = att.onField.filter((p) => p.slot !== "GK");
  if (shooters.length === 0) return;
  const weights = shooters.map(
    (p) => p.zones.attack * p.player.attributes.shooting,
  );
  const shooter = shooters[rng.shooters.weightedIndex(weights)] as OnField;
  const playerId = shooter.player.id;
  if (!rng.finishing.chance(tuning.shotRate)) {
    events.push({ minute, type: "missed", side, playerId });
    return;
  }
  tally.shots[side]++;
  const keeper = keeperOf(def);
  const finishing =
    shooter.skill * (0.5 + shooter.player.attributes.shooting / 198);
  const pGoal = Math.min(
    0.95,
    tuning.goalRate * 2 * edge(finishing, keeper ? keeper.skill : 0, 1),
  );
  if (rng.finishing.chance(pGoal)) {
    score[side]++;
    events.push({ minute, type: "goal", side, playerId });
    report(state, playerId).goals++;
    creditAssist(state, att, playerId);
  } else {
    events.push({ minute, type: "saved", side, playerId });
    if (keeper) report(state, keeper.player.id).saves++;
  }
}

/** Picks one of `players` by weight on its own stream, or none if all weigh 0. */
function pickBy(
  rng: Rng,
  players: readonly OnField[],
  weight: (p: OnField) => number,
): OnField | undefined {
  const weights = players.map(weight);
  if (!weights.some((w) => w > 0)) return undefined;
  return players[rng.weightedIndex(weights)];
}

/** A stopped attack goes to a defender, by defensive influence and defending (D143). */
function creditTackle(state: MatchState, def: TeamState): void {
  const tackler = pickBy(
    state.rng.tackles,
    def.onField.filter((p) => p.slot !== "GK"),
    (p) => p.zones.defence * p.player.attributes.defending,
  );
  if (tackler) report(state, tackler.player.id).tackles++;
}

/** Most goals have an assist, by attacking influence and passing (D143). */
function creditAssist(
  state: MatchState,
  att: TeamState,
  scorerId: string,
): void {
  const rng = state.rng.assists;
  if (!rng.chance(ASSIST_SHARE)) return;
  const provider = pickBy(
    rng,
    att.onField.filter((p) => p.slot !== "GK" && p.player.id !== scorerId),
    (p) => p.zones.attack * p.player.attributes.passing,
  );
  if (provider) report(state, provider.player.id).assists++;
}

function playPhases(
  state: MatchState,
  count: number,
  startMinute: number,
  minutes: number,
): void {
  const { tuning, teams, rng, tally } = state;
  for (let i = 0; i < count; i++) {
    const minute =
      startMinute +
      Math.min(minutes, Math.floor(((i + 0.5) * minutes) / count) + 1);
    const homePossession = edge(
      teams.home.zones.midfield,
      teams.away.zones.midfield,
      tuning.possessionSharpness,
    );
    const side: Side = rng.possession.chance(homePossession) ? "home" : "away";
    tally.possession[side]++;
    playAttack(state, side, minute);
    betweenPhases(state, minute, minutes / count, other(side));
  }
}

function shootout(state: MatchState): Record<Side, number> {
  const { tuning, teams, events } = state;
  const rng = state.rng.penalties;
  const pens: Record<Side, number> = { home: 0, away: 0 };
  const takers = (side: Side) =>
    teams[side].onField
      .filter((p) => p.slot !== "GK")
      .map((p) => ({
        id: p.player.id,
        skill: p.skill * (0.5 + p.player.attributes.shooting / 198),
      }))
      .sort((a, b) => b.skill - a.skill || a.id.localeCompare(b.id));
  const order: Record<Side, { id: string; skill: number }[]> = {
    home: takers("home"),
    away: takers("away"),
  };
  const kick = (side: Side, n: number) => {
    const list = order[side];
    const taker = list[n % list.length] as { id: string; skill: number };
    const keeper = keeperOf(teams[other(side)]);
    const p = Math.min(
      0.98,
      tuning.penaltyRate *
        2 *
        edge(taker.skill, keeper ? keeper.skill : 0, 0.5),
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

function prepareTeam(
  state: MatchState,
  team: SoccerTeam,
  side: Side,
): TeamState {
  if (team.lineup.length !== PLAYERS_ON_FIELD) {
    throw new RangeError(
      `Team ${team.id} has ${team.lineup.length} starters, expected 11`,
    );
  }
  if (!team.lineup.some((s) => s.slot === "GK")) {
    throw new RangeError(`Team ${team.id} has no goalkeeper`);
  }
  const everyone = [...team.lineup.map((s) => s.player), ...(team.bench ?? [])];
  for (const p of everyone) {
    if (state.reports[p.id])
      throw new RangeError(`Player ${p.id} appears more than once`);
    const fitness = team.fitness?.[p.id] ?? 100;
    state.reports[p.id] = {
      side,
      minutes: 0,
      energy: fitness,
      energyNow: fitness,
      yellowCards: 0,
      redCard: false,
      injuryWeeks: 0,
      goals: 0,
      assists: 0,
      tackles: 0,
      saves: 0,
    };
  }
  const t: TeamState = {
    side,
    team,
    onField: team.lineup.map(({ player, slot, side }) =>
      enterField(state, player, slot, side),
    ),
    bench: [...(team.bench ?? [])],
    subsUsed: 0,
    windowsUsed: 0,
    planDone: new Set(),
    pastContributions: [],
    zones: { defence: 0, midfield: 0, attack: 0 },
  };
  refreshTeam(state, t);
  return t;
}

/** Average influence over the match, from everyone who played in each slot. */
function teamMap(team: TeamState, phases: number): InfluenceMap {
  const map = createInfluenceMap(SOCCER_GRID);
  const parts = [
    ...team.pastContributions,
    ...team.onField.map((p) => ({
      template: p.template,
      skillTotal: p.skillTotal,
    })),
  ];
  for (const { template, skillTotal } of parts) {
    addScaled(map, template, skillTotal / phases);
  }
  return map;
}

/** Plays one match. Pure and deterministic for a given input and seed. */
export function simulateMatch(
  input: MatchInput<SoccerTeam, SoccerConfig>,
  seed: Seed,
): MatchOutput<SoccerEvent, SoccerResult> {
  const { config } = input;
  const root = createRng(seed);
  const { zones, baseline } = templateZones(
    config.templates,
    config.tuning.thirdRows,
  );
  const state = {
    config,
    tuning: config.tuning,
    reports: {},
    zones,
    baseline,
    score: { home: 0, away: 0 },
    tally: { possession: { home: 0, away: 0 }, shots: { home: 0, away: 0 } },
    events: [],
    rng: {
      possession: root.fork("possession"),
      chances: root.fork("chances"),
      shooters: root.fork("shooters"),
      finishing: root.fork("finishing"),
      penalties: root.fork("penalties"),
      injuries: root.fork("injuries"),
      cards: root.fork("cards"),
      // Player stats only (D143): their own streams, so scores never change.
      assists: root.fork("assists"),
      tackles: root.fork("tackles"),
    },
  } as unknown as MatchState;
  state.teams = {
    home: prepareTeam(state, input.home, "home"),
    away: prepareTeam(state, input.away, "away"),
  };
  // Home was prepared before away existed: work out matchups for both now.
  if (hasMatchups(config.tuning)) {
    refreshTeam(state, state.teams.home);
    refreshTeam(state, state.teams.away);
  }
  const { score, tally, events, tuning } = state;

  playPhases(state, tuning.phases, 0, 90);
  let phasesPlayed = tuning.phases;

  let decidedBy: SoccerResult["decidedBy"];
  let penalties: SoccerResult["penalties"];
  if (input.mode === "knockout" && score.home === score.away) {
    events.push({ minute: 90, type: "extra_time" });
    playPhases(state, tuning.extraTimePhases, 90, 30);
    phasesPlayed += tuning.extraTimePhases;
    if (score.home === score.away) {
      penalties = shootout(state);
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

  const players: Record<string, PlayerMatchReport> = {};
  for (const [id, r] of Object.entries(state.reports)) {
    const { energyNow, ...rest } = r;
    players[id] = {
      ...rest,
      minutes: Math.round(rest.minutes),
      energy: Math.round(energyNow * 10) / 10,
    };
  }

  const result: SoccerResult = {
    score,
    winner,
    possession: {
      home: tally.possession.home / totalPhases,
      away: tally.possession.away / totalPhases,
    },
    shots: tally.shots,
    players,
  };
  if (decidedBy) result.decidedBy = decidedBy;
  if (penalties) result.penalties = penalties;

  return {
    result,
    events,
    // Both maps in the home team's frame, ready to overlay on one pitch.
    influence: {
      home: teamMap(state.teams.home, phasesPlayed),
      away: flipMap(teamMap(state.teams.away, phasesPlayed)),
    },
  };
}
