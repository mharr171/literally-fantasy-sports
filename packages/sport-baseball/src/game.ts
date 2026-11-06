/**
 * The baseball game, pitch by pitch (ADR 0008 §1, D194, D210):
 *
 * 1. Each player's skill multiplier for the game: position fit, chemistry,
 *    the team matchup and home advantage (`sideMultipliers`), and for each
 *    at-bat the pitcher-against-batter color matchup (`atBatEdges`).
 * 2. Every pitch: the pitcher aims by their location profile and control
 *    sets how close it lands; eye decides swing or take; contact against
 *    velocity and movement decides miss, foul or ball in play, with the
 *    batter's hot and cold zones.
 * 3. A ball in play: power against velocity sets how hard it's hit, which
 *    sets its kind (ground ball, line drive, fly ball, pop-up) and depth;
 *    the spray profile sets its direction. The fielder whose range covers
 *    the landing cell best fields it: out, hit or error, and their arm
 *    against the runner's speed decides extra bases and double plays.
 * 4. Steals before a pitch, on the runner's speed against the catcher's arm.
 * 5. Nine innings, the home side batting last. Level after nine: extra
 *    innings, each half starting with a runner on second (D194).
 *
 * Pitchers don't tire yet and nobody comes off the bench: step 6 adds
 * fatigue, the bullpen plan and bench roles. Everything random comes from
 * the seed, one fork per kind of roll, so a game always replays exactly.
 */
import {
  createRng,
  type MatchInput,
  type MatchOutput,
  type MatchResult,
  type Seed,
  type Side,
} from "@lfs/core";
import type { Attribute } from "./attributes";
import {
  type BenchPlayer,
  type BenchRole,
  type BenchTuning,
  chooseDefense,
  chooseInjuryCover,
  choosePinchHitter,
  choosePinchRunner,
  DEFAULT_BENCH_TUNING,
} from "./bench";
import {
  type BullpenPlan,
  bullpenDecision,
  type ChangeReason,
  DEFAULT_FATIGUE,
  defaultBullpenPlan,
  type FatigueTuning,
  fatigueFactor,
  pitchBudget,
} from "./pitching";
import { type BaseballPlayer, battingSide, type Throws } from "./player";
import type { BatterPosition, FieldPosition } from "./positions";
import {
  DEFAULT_FIELDING_RANGES,
  DEPTHS,
  DIRECTIONS,
  type FieldRange,
  inZone,
  LOCATION_PRESETS,
  mirrorGrid,
  mirrorSpray,
  SPRAY_PRESETS,
  ZONE_PRESETS,
  ZONE_SIZE,
  type ZoneGrid,
} from "./profiles";
import {
  atBatEdges,
  DEFAULT_SKILL_TUNING,
  type GameSide,
  platoonEdges,
  type SideMultipliers,
  type SkillTuning,
  sideMultipliers,
} from "./skill";

export interface BaseballTeam {
  id: string;
  /** The batting order: 9 with the DH, and where each one plays. */
  batters: readonly { player: BaseballPlayer; slot: BatterPosition }[];
  /** The starting pitcher. */
  pitcher: BaseballPlayer;
  /** Relievers, up to 8 (D196). */
  bullpen?: readonly BaseballPlayer[];
  /** When relievers come in; a default plan when left out. */
  plan?: BullpenPlan;
  /** Relievers who still need rest (D213): they're skipped. */
  unavailable?: readonly string[];
  /** Up to 5 bench players, each with a role (D212). */
  bench?: readonly BenchPlayer[];
}

/** The pitch-by-pitch tuning. Starting values; the harness tunes them (step 8). */
export interface PitchTuning {
  /** Chance a pitch misses its target cell, at control 0 and at 100. */
  missAtZero: number;
  missAtHundred: number;
  /** Swing chances at strikes and at balls, for an average eye. */
  swingInZone: number;
  swingOutOfZone: number;
  /** How much eye moves them, per point above 50. */
  eyeEffect: number;
  /** Contact on a swing, in and out of the zone, when contact equals stuff. */
  contactInZone: number;
  contactOutOfZone: number;
  /** How much contact against velocity and movement moves it, per point. */
  contactEffect: number;
  /** Share of contact that goes foul. */
  foulShare: number;
  /** How hard a ball is hit: power against velocity, per point, and its spread. */
  powerEffect: number;
  hitSpread: number;
  /** Fly balls hit at least this hard leave the park. */
  homeRunAt: number;
  /** Chance a ball in play becomes an out when fielded squarely, by kind. */
  outChance: Record<BattedKind, number>;
  /** How much the fielder's fielding (per point above 50) adds to the out chance. */
  fieldingEffect: number;
  /** Chance an out becomes an error, for an average fielder. */
  errorRate: number;
  /** A runner's chance to take an extra base on a hit when speed equals arm. */
  extraBase: number;
  /** How much speed against arm moves it (per point). */
  runnerEffect: number;
  /** Steals: tried when the runner's speed is at least this, and how often. */
  stealSpeed: number;
  stealTry: number;
}

export const DEFAULT_PITCH_TUNING: PitchTuning = {
  missAtZero: 0.8,
  missAtHundred: 0.32,
  swingInZone: 0.66,
  swingOutOfZone: 0.3,
  eyeEffect: 0.003,
  contactInZone: 0.82,
  contactOutOfZone: 0.62,
  contactEffect: 0.0018,
  foulShare: 0.45,
  powerEffect: 0.0055,
  hitSpread: 0.25,
  homeRunAt: 0.86,
  outChance: { ground: 0.81, line: 0.39, fly: 0.83, popup: 0.97 },
  fieldingEffect: 0.002,
  errorRate: 0.045,
  extraBase: 0.68,
  runnerEffect: 0.006,
  stealSpeed: 62,
  stealTry: 0.035,
};

export interface BaseballConfig {
  skill: SkillTuning;
  pitch: PitchTuning;
  fatigue: FatigueTuning;
  bench: BenchTuning;
  fielding: Record<FieldPosition | "P", FieldRange>;
}

export function defaultBaseballConfig(): BaseballConfig {
  return {
    skill: DEFAULT_SKILL_TUNING,
    pitch: DEFAULT_PITCH_TUNING,
    fatigue: DEFAULT_FATIGUE,
    bench: DEFAULT_BENCH_TUNING,
    fielding: DEFAULT_FIELDING_RANGES,
  };
}

export type BattedKind = "ground" | "line" | "fly" | "popup";

export type PitchCall = "ball" | "called" | "swinging" | "foul" | "inPlay";

export type PlayResult =
  | "strikeout"
  | "walk"
  | "single"
  | "double"
  | "triple"
  | "homeRun"
  | "out"
  | "doublePlay"
  | "sacFly"
  | "error";

/**
 * A run (D214): the pitcher charged is the one who let the runner on, and
 * it's unearned if the runner reached on an error (or was placed on second
 * in extra innings), or if it scored after the inning would have ended
 * without errors.
 */
export interface ScoredRun {
  runner: string;
  pitcher: string;
  earned: boolean;
}

/** Runners on first, second and third: each base's runner id, or null. */
export type Bases = [string | null, string | null, string | null];

interface Situation {
  inning: number;
  /** "away" bats in the top, "home" in the bottom. */
  batting: Side;
  outs: number;
  bases: Bases;
}

/**
 * What happened, in order. Pitch and steal events carry the situation as
 * the pitch is thrown or the runner goes; play events carry it after the
 * play (the outs and runners it left), with the runs it scored.
 */
export type BaseballEvent =
  | (Situation & {
      type: "pitch";
      batter: string;
      pitcher: string;
      balls: number;
      strikes: number;
      /** Where it crossed the plate on the 5 × 5 grid. */
      row: number;
      col: number;
      call: PitchCall;
    })
  | (Situation & {
      type: "play";
      batter: string;
      pitcher: string;
      result: PlayResult;
      /** The ball in play, when there was one. */
      batted?: { kind: BattedKind; direction: number; depth: number };
      fielder?: FieldPosition | "P";
      runs: number;
      rbi: number;
      /** Who scored on the play, which pitcher is charged and whether it's earned. */
      scored: ScoredRun[];
    })
  | (Situation & {
      type: "pitchingChange";
      /** The fielding side. */
      side: Side;
      out: string;
      in: string;
      reason: ChangeReason;
    })
  | (Situation & {
      type: "substitution";
      /** The side making it. */
      side: Side;
      out: string;
      in: string;
      role: BenchRole;
    })
  | (Situation & {
      type: "injury";
      side: Side;
      player: string;
      days: number;
    })
  | (Situation & {
      type: "steal";
      /** The batter at the plate when the runner went. */
      batter: string;
      runner: string;
      to: 2 | 3;
      safe: boolean;
    });

export interface BaseballResult extends MatchResult {
  /** Runs per inning, by side; a home half not played is left out. */
  lineScore: Record<Side, number[]>;
  hits: Record<Side, number>;
  errors: Record<Side, number>;
  /** Pitches each pitcher threw, by player id. */
  pitches: Record<string, number>;
  /** Outs each pitcher recorded, by player id. */
  pitcherOuts: Record<string, number>;
  /** Players hurt in the game, and the days they're out (D213). */
  injuries: { id: string; days: number }[];
}

export type BaseballOutput = MatchOutput<BaseballEvent, BaseballResult>;

/** Past this many innings the game ends on a coin from the seed (never seen in practice). */
export const MAX_INNINGS = 40;

/** A half-inning stops after this many batters, so no tuning can hang a game. */
export const MAX_BATTERS_PER_HALF = 60;

interface SideState {
  side: Side;
  team: BaseballTeam;
  gameSide: GameSide;
  mult: SideMultipliers;
  next: number;
  /** The pitcher on the mound, and everyone who has pitched. */
  pitcher: BaseballPlayer;
  used: Set<string>;
  plan: BullpenPlan;
  unavailable: ReadonlySet<string>;
  /** Bench players who have come in. */
  subbed: Set<string>;
}

const clamp01 = (p: number) => Math.min(1, Math.max(0, p));

/** Each location preset's aim weights, flat, and more into the zone when behind. */
const aimOf = (grid: ZoneGrid) => ({
  normal: grid.flat(),
  behind: grid.flatMap((r, i) => r.map((w, j) => (inZone(i, j) ? w * 1.4 : w))),
});
type Aim = { normal: number[]; behind: number[] };
/** Aim by preset, for a right-handed pitcher and mirrored for a left-hander (D224). */
const AIM = Object.fromEntries(
  Object.entries(LOCATION_PRESETS).map(([name, grid]) => [
    name,
    { R: aimOf(grid), L: aimOf(mirrorGrid(grid)) },
  ]),
) as Record<keyof typeof LOCATION_PRESETS, Record<Throws, Aim>>;
/** Zones and spray for each side a batter hits from. */
const ZONES = Object.fromEntries(
  Object.entries(ZONE_PRESETS).map(([name, grid]) => [
    name,
    { R: grid, L: mirrorGrid(grid) },
  ]),
) as unknown as Record<keyof typeof ZONE_PRESETS, Record<Throws, ZoneGrid>>;
const SPRAYS = Object.fromEntries(
  Object.entries(SPRAY_PRESETS).map(([name, w]) => [
    name,
    { R: w, L: mirrorSpray(w) },
  ]),
) as unknown as Record<
  keyof typeof SPRAY_PRESETS,
  Record<Throws, readonly number[]>
>;

export function simulateGame(
  input: MatchInput<BaseballTeam, BaseballConfig>,
  seed: Seed,
): BaseballOutput {
  const { skill, pitch: t, fielding, fatigue } = input.config;
  const root = createRng(seed);
  const rng = {
    location: root.fork("location"),
    swing: root.fork("swing"),
    contact: root.fork("contact"),
    batted: root.fork("batted"),
    fielding: root.fork("fielding"),
    running: root.fork("running"),
    steals: root.fork("steals"),
    end: root.fork("end"),
    injuries: root.fork("injuries"),
  };
  const bt = input.config.bench;
  const gameSide = (team: BaseballTeam, home: boolean): GameSide => ({
    // A copy: substitutions change it during the game.
    batters: [...team.batters],
    pitcher: team.pitcher,
    home,
  });
  const homeSide = gameSide(input.home, true);
  const awaySide = gameSide(input.away, false);
  const state = (
    side: Side,
    team: BaseballTeam,
    own: GameSide,
    other: GameSide,
  ): SideState => ({
    side,
    team,
    gameSide: own,
    mult: sideMultipliers(own, other, skill),
    next: 0,
    pitcher: team.pitcher,
    used: new Set([team.pitcher.id]),
    plan: team.plan ?? defaultBullpenPlan(team.bullpen ?? []),
    unavailable: new Set(team.unavailable ?? []),
    subbed: new Set(),
  });
  const states: Record<Side, SideState> = {
    home: state("home", input.home, homeSide, awaySide),
    away: state("away", input.away, awaySide, homeSide),
  };
  const budgets = new Map<string, number>();
  const budgetOf = (p: BaseballPlayer) => {
    let b = budgets.get(p.id);
    if (b === undefined) {
      b = pitchBudget(p, fatigue);
      budgets.set(p.id, b);
    }
    return b;
  };
  const score: Record<Side, number> = { home: 0, away: 0 };
  const hits: Record<Side, number> = { home: 0, away: 0 };
  const errors: Record<Side, number> = { home: 0, away: 0 };
  const lineScore: Record<Side, number[]> = { home: [], away: [] };
  const pitches: Record<string, number> = {};
  const pitcherOuts: Record<string, number> = {};
  const injuries: { id: string; days: number }[] = [];
  const events: BaseballEvent[] = [];

  /** One half-inning; returns when three are out or a walk-off ends it. */
  const half = (inning: number, batting: Side) => {
    const off = states[batting];
    const def = states[batting === "home" ? "away" : "home"];
    const fielders = new Map<
      FieldPosition | "P",
      { p: BaseballPlayer; m: number }
    >();
    const placeFielders = () => {
      fielders.set("P", { p: def.pitcher, m: def.mult.pitcher });
      def.gameSide.batters.forEach((b, i) => {
        if (b.slot !== "DH")
          fielders.set(b.slot, {
            p: b.player,
            m: def.mult.batters[i] as number,
          });
      });
    };
    let outs = 0;
    const bases: Bases = [null, null, null];
    // Who let each runner on, who reached on an error, and errors this half (D214).
    const charged = new Map<string, string>();
    const unearned = new Set<string>();
    let halfErrors = 0;
    let scored: ScoredRun[] = [];
    // Extra innings start with the batter before the leadoff man on second;
    // his run is unearned (MLB's rule) and charged to the pitcher on the mound.
    if (inning > 9) {
      const prev = (off.next + 8) % 9;
      const placed = off.gameSide.batters[prev]?.player.id ?? null;
      bases[1] = placed;
      if (placed) {
        charged.set(placed, def.pitcher.id);
        unearned.add(placed);
      }
    }
    let runs = 0;
    const situation = (): Situation => ({
      inning,
      batting,
      outs,
      bases: [...bases] as Bases,
    });
    const walkOff = () =>
      batting === "home" && inning >= 9 && score.home > score.away;
    const scoreRun = (runner: string) => {
      runs++;
      score[batting]++;
      scored.push({
        runner,
        pitcher: charged.get(runner) ?? def.pitcher.id,
        earned: !unearned.has(runner) && outs + halfErrors < 3,
      });
    };
    /** `to` takes over `from`'s place on base, and what's charged with it. */
    const replaceRunner = (from: string, to: string) => {
      const i = bases.indexOf(from);
      if (i < 0) return;
      bases[i] = to;
      const who = charged.get(from);
      if (who) charged.set(to, who);
      if (unearned.has(from)) unearned.add(to);
    };
    /** A bench player takes over lineup spot `index` for `side`. */
    const substitute = (
      side: SideState,
      index: number,
      sub: BenchPlayer,
      role: BenchRole,
    ) => {
      const lineup = side.gameSide.batters as {
        player: BaseballPlayer;
        slot: BatterPosition;
      }[];
      const was = lineup[index] as {
        player: BaseballPlayer;
        slot: BatterPosition;
      };
      lineup[index] = { player: sub.player, slot: was.slot };
      side.subbed.add(sub.player.id);
      events.push({
        ...situation(),
        type: "substitution",
        side: side.side,
        out: was.player.id,
        in: sub.player.id,
        role,
      });
      def.mult = sideMultipliers(def.gameSide, off.gameSide, skill);
      off.mult = sideMultipliers(off.gameSide, def.gameSide, skill);
      placeFielders();
    };
    // A defensive replacement, at the start of the half.
    const defense = chooseDefense({
      bench: def.team.bench ?? [],
      used: def.subbed,
      lineup: def.gameSide.batters,
      inning,
      leading: score[def.side] > score[batting],
      tuning: bt,
    });
    if (defense) substitute(def, defense.index, defense.sub, "defense");
    placeFielders();
    const speedOf = (id: string) =>
      off.gameSide.batters.find((b) => b.player.id === id)?.player.attributes
        .speed ?? 50;

    for (
      let faced = 0;
      outs < 3 && !walkOff() && faced < MAX_BATTERS_PER_HALF;
      faced++
    ) {
      // The bullpen plan, at the start of each at-bat.
      const change = bullpenDecision({
        plan: def.plan,
        current: def.pitcher,
        starter: def.pitcher.id === def.team.pitcher.id,
        thrown: pitches[def.pitcher.id] ?? 0,
        budget: budgetOf(def.pitcher),
        inning,
        lead: score[def.side] - score[batting],
        bullpen: def.team.bullpen ?? [],
        used: def.used,
        unavailable: def.unavailable,
        noHitter: hits[batting] === 0,
        fatigue,
      });
      if (change) {
        events.push({
          ...situation(),
          type: "pitchingChange",
          side: def.side,
          out: def.pitcher.id,
          in: change.pitcher.id,
          reason: change.reason,
        });
        def.pitcher = change.pitcher;
        def.used.add(change.pitcher.id);
        // Chemistry and the team matchup count the pitcher on both sides.
        def.gameSide = { ...def.gameSide, pitcher: change.pitcher };
        def.mult = sideMultipliers(def.gameSide, off.gameSide, skill);
        off.mult = sideMultipliers(off.gameSide, def.gameSide, skill);
        placeFielders();
      }
      const pitcher = def.pitcher;
      const index = off.next % 9;
      off.next++;
      const due = off.gameSide.batters[index];
      if (!due) break;
      // A pinch hitter, when behind or level late on.
      const ph = choosePinchHitter({
        bench: off.team.bench ?? [],
        used: off.subbed,
        batter: due.player,
        inning,
        needRuns: score[batting] <= score[def.side],
        pitcher: def.pitcher,
        tuning: bt,
        skill,
      });
      if (ph) substitute(off, index, ph, "pinchHitter");
      const batter = (off.gameSide.batters[index] as { player: BaseballPlayer })
        .player;
      const edges = atBatEdges(
        batter.chemistryColor,
        pitcher.chemistryColor,
        skill,
      );
      // The platoon edge (D224), and the side he hits from.
      const side = battingSide(batter.bats, pitcher.throws);
      const platoon = platoonEdges(batter, pitcher, skill);
      const bm =
        (off.mult.batters[index] as number) + edges.batter + platoon.batter;
      const pm = def.mult.pitcher + edges.pitcher + platoon.pitcher;
      const bat = (a: Attribute) => batter.attributes[a] * bm;
      // Velocity, control and movement fade once past the pitch budget.
      const budget = budgetOf(pitcher);
      // Fatigue: worked out once per pitch, as the pitch is thrown.
      let tired = 1;
      const arm = (a: Attribute) =>
        pitcher.attributes[a] * pm * (a === "stamina" ? 1 : tired);
      const zone = ZONES[batter.zoneProfile ?? "even"][side];
      const sprayWeights = SPRAYS[batter.sprayProfile ?? "spray"][side];
      const aim =
        AIM[pitcher.locationProfile ?? "attacks"][pitcher.throws ?? "R"];
      let balls = 0;
      let strikes = 0;
      let result: PlayResult | null = null;
      let batted:
        | { kind: BattedKind; direction: number; depth: number }
        | undefined;
      let fielderPos: FieldPosition | "P" | undefined;
      let rbi = 0;
      const runsBefore = runs;
      const outsBefore = outs;
      scored = [];

      while (result === null) {
        // A steal before the pitch: from first with second open, or second with third open.
        const stealFrom: 0 | 1 | null =
          bases[0] && !bases[1] ? 0 : bases[1] && !bases[2] ? 1 : null;
        if (stealFrom !== null) {
          const runner = bases[stealFrom] as string;
          const speed = speedOf(runner);
          if (speed >= t.stealSpeed && rng.steals.chance(t.stealTry)) {
            const catcher = fielders.get("C");
            const catcherArm =
              (catcher?.p.attributes.arm ?? 50) * (catcher?.m ?? 1);
            const before = situation();
            const safe = rng.steals.chance(
              clamp01(0.72 + (speed * bm - catcherArm) * t.runnerEffect),
            );
            bases[stealFrom] = null;
            if (safe) bases[stealFrom + 1] = runner;
            else outs++;
            events.push({
              ...before,
              type: "steal",
              batter: batter.id,
              runner,
              to: (stealFrom + 2) as 2 | 3,
              safe,
            });
            if (outs >= 3) break;
          }
        }
        // 1. Location: aim by profile, scatter by control.
        pitches[pitcher.id] = (pitches[pitcher.id] ?? 0) + 1;
        tired = fatigueFactor(pitches[pitcher.id] ?? 0, budget, fatigue);
        // Behind in the count, the pitcher comes into the zone.
        const behind = balls === 3 || balls - strikes >= 2;
        const target = rng.location.weightedIndex(
          behind ? aim.behind : aim.normal,
        );
        let row = Math.floor(target / ZONE_SIZE);
        let col = target % ZONE_SIZE;
        const control = Math.min(100, arm("control"));
        const miss =
          t.missAtZero + (t.missAtHundred - t.missAtZero) * (control / 100);
        if (rng.location.chance(miss)) {
          row = Math.min(
            ZONE_SIZE - 1,
            Math.max(0, row + rng.location.int(-1, 1)),
          );
          col = Math.min(
            ZONE_SIZE - 1,
            Math.max(0, col + rng.location.int(-1, 1)),
          );
        }
        const strike = inZone(row, col);
        // 2. Swing or take, on eye; movement makes balls look like strikes.
        const eye = bat("eye") - 50;
        const deception = (arm("movement") - 50) * t.eyeEffect * 0.5;
        const swingP = strike
          ? t.swingInZone + eye * t.eyeEffect * 0.5
          : t.swingOutOfZone - eye * t.eyeEffect + deception;
        let call: PitchCall;
        if (!rng.swing.chance(clamp01(swingP))) {
          call = strike ? "called" : "ball";
        } else {
          // 3. Contact: contact against stuff, and the batter's hot or cold zone.
          const stuff = (arm("velocity") + arm("movement")) / 2;
          const hot = zone[row]?.[col] ?? 1;
          const contactP =
            ((strike ? t.contactInZone : t.contactOutOfZone) +
              (bat("contact") - stuff) * t.contactEffect) *
            hot;
          if (!rng.contact.chance(clamp01(contactP))) call = "swinging";
          else if (rng.contact.chance(t.foulShare)) call = "foul";
          else call = "inPlay";
        }
        events.push({
          ...situation(),
          type: "pitch",
          batter: batter.id,
          pitcher: pitcher.id,
          balls,
          strikes,
          row,
          col,
          call,
        });
        if (call === "ball") balls++;
        else if (call === "called" || call === "swinging") strikes++;
        else if (call === "foul") strikes = Math.min(2, strikes + 1);
        if (balls === 4) result = "walk";
        else if (strikes === 3) result = "strikeout";
        else if (call === "inPlay") {
          // 4. The ball in play: how hard, what kind, where.
          const hot = zone[row]?.[col] ?? 1;
          const quality =
            0.5 +
            (bat("power") - arm("velocity")) * t.powerEffect * 0.25 +
            (hot - 1) * 0.5 +
            rng.batted.normal(0, t.hitSpread);
          const kind: BattedKind =
            quality > 0.75
              ? rng.batted.chance(0.5)
                ? "fly"
                : "line"
              : quality > 0.45
                ? rng.batted.chance(0.55)
                  ? "ground"
                  : "line"
                : quality > 0.2
                  ? rng.batted.chance(0.6)
                    ? "ground"
                    : "fly"
                  : rng.batted.chance(0.6)
                    ? "popup"
                    : "ground";
          const direction = rng.batted.weightedIndex(sprayWeights);
          const depth =
            kind === "ground"
              ? rng.batted.int(1, 2)
              : kind === "popup"
                ? rng.batted.int(0, 2)
                : kind === "line"
                  ? Math.min(DEPTHS - 1, 3 + Math.floor(quality * 3))
                  : Math.min(DEPTHS - 1, 3 + Math.floor(quality * 4));
          batted = { kind, direction, depth };
          if (kind === "fly" && quality >= t.homeRunAt) {
            result = "homeRun";
            break;
          }
          // 5. Fielding: the best-placed fielder, by reach times fielding.
          let best: {
            pos: FieldPosition | "P";
            reach: number;
            skill: number;
          } | null = null;
          for (const [pos, f] of fielders) {
            const reach = fielding[pos]?.[direction]?.[depth] ?? 0;
            const score2 = reach * f.p.attributes.fielding * f.m;
            if (!best || score2 > best.reach * best.skill)
              best = { pos, reach, skill: f.p.attributes.fielding * f.m };
          }
          const fielder = best as {
            pos: FieldPosition | "P";
            reach: number;
            skill: number;
          };
          fielderPos = fielder.pos;
          const outP = clamp01(
            t.outChance[kind] * Math.min(1, fielder.reach * 1.4) +
              (fielder.skill - 50) * t.fieldingEffect -
              (kind === "ground" ? (bat("speed") - 50) * t.fieldingEffect : 0),
          );
          if (rng.fielding.chance(outP)) {
            if (
              rng.fielding.chance(
                clamp01(
                  t.errorRate * (100 / Math.max(20, fielder.skill)) * 0.5,
                ),
              )
            ) {
              result = "error";
            } else if (
              kind === "ground" &&
              bases[0] &&
              outs < 2 &&
              rng.fielding.chance(0.35)
            ) {
              result = "doublePlay";
            } else if (
              (kind === "fly" || kind === "line") &&
              bases[2] &&
              outs < 2 &&
              depth >= 4
            ) {
              result = "sacFly";
            } else result = "out";
          } else {
            // Down the lines, a ground ball can go for two.
            const line = direction === 0 || direction === DIRECTIONS - 1;
            result =
              kind === "popup"
                ? "single"
                : kind === "ground"
                  ? line && rng.batted.chance(0.4)
                    ? "double"
                    : "single"
                  : kind === "line"
                    ? depth >= 4 && rng.batted.chance(0.35)
                      ? "double"
                      : "single"
                    : depth >= 6
                      ? rng.batted.chance(0.18 + (bat("speed") - 50) * 0.005)
                        ? "triple"
                        : "double"
                      : rng.batted.chance(0.5)
                        ? "double"
                        : "single";
          }
        }
      }
      if (result === null) {
        // Caught stealing for the third out: this batter leads off next time.
        pitcherOuts[pitcher.id] =
          (pitcherOuts[pitcher.id] ?? 0) + outs - outsBefore;
        off.next--;
        break;
      }
      // Settle the play: outs, runners, runs.
      const fielderArm = fielderPos
        ? (fielders.get(fielderPos)?.p.attributes.arm ?? 50) *
          (fielders.get(fielderPos)?.m ?? 1)
        : 50;
      const extra = (id: string) =>
        rng.running.chance(
          clamp01(
            t.extraBase + (speedOf(id) * bm - fielderArm) * t.runnerEffect,
          ),
        );
      const advance = (n: number, forced: boolean) => {
        // Runners from third down, so nobody passes anyone.
        for (let i = 2; i >= 0; i--) {
          const r = bases[i];
          if (!r) continue;
          let to = i + n;
          if (!forced && to < 3 && extra(r)) to++;
          bases[i] = null;
          if (to >= 3) {
            scoreRun(r);
            rbi++;
          } else bases[to] = r;
        }
      };
      switch (result) {
        case "strikeout":
        case "out":
          outs++;
          break;
        case "doublePlay":
          outs += 2;
          bases[0] = null;
          if (outs < 3) {
            // The others move up a base on the ground ball.
            for (let i = 2; i >= 1; i--) {
              const r = bases[i];
              if (!r) continue;
              bases[i] = null;
              if (i + 1 >= 3) scoreRun(r);
              else bases[i + 1] = r;
            }
          }
          break;
        case "sacFly":
          outs++;
          scoreRun(bases[2] as string);
          bases[2] = null;
          rbi++;
          break;
        case "walk": {
          // Forced runners only.
          if (bases[0]) {
            if (bases[1]) {
              if (bases[2]) {
                scoreRun(bases[2]);
                rbi++;
              }
              bases[2] = bases[1];
            }
            bases[1] = bases[0];
          }
          bases[0] = batter.id;
          break;
        }
        case "error":
          errors[def.side]++;
          halfErrors++;
          advance(1, true);
          bases[0] = batter.id;
          unearned.add(batter.id);
          rbi = 0;
          break;
        case "single":
          hits[batting]++;
          advance(1, false);
          bases[0] = batter.id;
          break;
        case "double":
          hits[batting]++;
          advance(2, false);
          bases[1] = batter.id;
          break;
        case "triple":
          hits[batting]++;
          advance(3, true);
          bases[2] = batter.id;
          break;
        case "homeRun":
          hits[batting]++;
          advance(3, true);
          charged.set(batter.id, pitcher.id);
          scoreRun(batter.id);
          rbi++;
          break;
      }
      // The batter on base is this pitcher's runner; the outs are his.
      if (bases.includes(batter.id) && !charged.has(batter.id))
        charged.set(batter.id, pitcher.id);
      pitcherOuts[pitcher.id] =
        (pitcherOuts[pitcher.id] ?? 0) + outs - outsBefore;
      events.push({
        ...situation(),
        type: "play",
        batter: batter.id,
        pitcher: pitcher.id,
        result: result as PlayResult,
        ...(batted ? { batted } : {}),
        ...(fielderPos ? { fielder: fielderPos } : {}),
        runs: runs - runsBefore,
        rbi,
        scored,
      });
      if (outs < 3 && !walkOff())
        afterPlay(
          inning,
          off,
          def,
          bases,
          batter.id,
          situation,
          substitute,
          replaceRunner,
        );
    }
    lineScore[batting].push(runs);
  };

  /** After a play: injuries, then a pinch runner in a close game. */
  const afterPlay = (
    inning: number,
    off: SideState,
    def: SideState,
    bases: Bases,
    batterId: string,
    situation: () => Situation,
    substitute: (
      side: SideState,
      index: number,
      sub: BenchPlayer,
      role: BenchRole,
    ) => void,
    replaceRunner: (from: string, to: string) => void,
  ) => {
    const lineup = off.gameSide.batters;
    const indexOf = (id: string) => lineup.findIndex((b) => b.player.id === id);
    if (rng.injuries.chance(bt.injuryPerPlateAppearance)) {
      const at = indexOf(batterId);
      const hurt = lineup[at];
      if (hurt) {
        const days = rng.injuries.int(bt.injuryDays[0], bt.injuryDays[1]);
        injuries.push({ id: batterId, days });
        events.push({
          ...situation(),
          type: "injury",
          side: off.side,
          player: batterId,
          days,
        });
        const cover = chooseInjuryCover({
          bench: off.team.bench ?? [],
          used: off.subbed,
          injured: hurt,
        });
        if (cover) {
          substitute(off, at, cover, "injury");
          replaceRunner(batterId, cover.player.id);
        }
      }
    }
    const close = Math.abs(score[off.side] - score[def.side]) <= bt.closeRuns;
    for (let i = 0; i < 3; i++) {
      const runnerId = bases[i];
      if (!runnerId) continue;
      const at = indexOf(runnerId);
      const runner = lineup[at];
      if (!runner) continue;
      const pr = choosePinchRunner({
        bench: off.team.bench ?? [],
        used: off.subbed,
        runner: runner.player,
        inning,
        close,
        tuning: bt,
      });
      if (pr) {
        substitute(off, at, pr, "pinchRunner");
        replaceRunner(runnerId, pr.player.id);
        break;
      }
    }
  };

  let inning = 1;
  for (; inning <= MAX_INNINGS; inning++) {
    half(inning, "away");
    // The home side doesn't bat in the 9th or later when already ahead.
    if (!(inning >= 9 && score.home > score.away)) half(inning, "home");
    if (inning >= 9 && score.home !== score.away) break;
  }
  if (score.home === score.away) {
    // Never seen in practice: settle it on a coin so there's always a winner.
    score[rng.end.chance(0.5) ? "home" : "away"]++;
  }
  return {
    result: {
      score,
      winner: score.home > score.away ? "home" : "away",
      ...(lineScore.away.length > 9 ? { decidedBy: "extra_innings" } : {}),
      lineScore,
      hits,
      errors,
      pitches,
      pitcherOuts,
      injuries,
    },
    events,
  };
}

/** For tests and the harness: a team of these players at their own positions. */
export function teamAt(
  id: string,
  batters: readonly BaseballPlayer[],
  pitcher: BaseballPlayer,
): BaseballTeam {
  return {
    id,
    batters: batters.map((player) => ({
      player,
      slot: player.primaryPosition as BatterPosition,
    })),
    pitcher,
  };
}
