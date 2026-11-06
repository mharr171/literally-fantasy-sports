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
import type { BaseballPlayer } from "./player";
import type { BatterPosition, FieldPosition } from "./positions";
import {
  DEFAULT_FIELDING_RANGES,
  DEPTHS,
  DIRECTIONS,
  type FieldRange,
  inZone,
  LOCATION_PRESETS,
  SPRAY_PRESETS,
  ZONE_PRESETS,
  ZONE_SIZE,
} from "./profiles";
import {
  atBatEdges,
  DEFAULT_SKILL_TUNING,
  type GameSide,
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
  /** Extra-base chance on a hit, on speed against arm (per point). */
  runnerEffect: number;
  /** Steals: tried when the runner's speed is at least this, and how often. */
  stealSpeed: number;
  stealTry: number;
}

export const DEFAULT_PITCH_TUNING: PitchTuning = {
  missAtZero: 0.6,
  missAtHundred: 0.15,
  swingInZone: 0.66,
  swingOutOfZone: 0.3,
  eyeEffect: 0.004,
  contactInZone: 0.82,
  contactOutOfZone: 0.62,
  contactEffect: 0.004,
  foulShare: 0.45,
  powerEffect: 0.012,
  hitSpread: 0.25,
  homeRunAt: 0.88,
  outChance: { ground: 0.78, line: 0.36, fly: 0.82, popup: 0.97 },
  fieldingEffect: 0.003,
  errorRate: 0.02,
  runnerEffect: 0.006,
  stealSpeed: 62,
  stealTry: 0.09,
};

export interface BaseballConfig {
  skill: SkillTuning;
  pitch: PitchTuning;
  fielding: Record<FieldPosition | "P", FieldRange>;
}

export function defaultBaseballConfig(): BaseballConfig {
  return {
    skill: DEFAULT_SKILL_TUNING,
    pitch: DEFAULT_PITCH_TUNING,
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
}

const clamp01 = (p: number) => Math.min(1, Math.max(0, p));

export function simulateGame(
  input: MatchInput<BaseballTeam, BaseballConfig>,
  seed: Seed,
): BaseballOutput {
  const { skill, pitch: t, fielding } = input.config;
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
  };
  const gameSide = (team: BaseballTeam, home: boolean): GameSide => ({
    batters: team.batters,
    pitcher: team.pitcher,
    home,
  });
  const homeSide = gameSide(input.home, true);
  const awaySide = gameSide(input.away, false);
  const states: Record<Side, SideState> = {
    home: {
      side: "home",
      team: input.home,
      gameSide: homeSide,
      mult: sideMultipliers(homeSide, awaySide, skill),
      next: 0,
    },
    away: {
      side: "away",
      team: input.away,
      gameSide: awaySide,
      mult: sideMultipliers(awaySide, homeSide, skill),
      next: 0,
    },
  };
  const score: Record<Side, number> = { home: 0, away: 0 };
  const hits: Record<Side, number> = { home: 0, away: 0 };
  const errors: Record<Side, number> = { home: 0, away: 0 };
  const lineScore: Record<Side, number[]> = { home: [], away: [] };
  const pitches: Record<string, number> = {};
  const events: BaseballEvent[] = [];

  /** One half-inning; returns when three are out or a walk-off ends it. */
  const half = (inning: number, batting: Side) => {
    const off = states[batting];
    const def = states[batting === "home" ? "away" : "home"];
    const pitcher = def.team.pitcher;
    const fielders = new Map<
      FieldPosition | "P",
      { p: BaseballPlayer; m: number }
    >();
    fielders.set("P", { p: pitcher, m: def.mult.pitcher });
    def.team.batters.forEach((b, i) => {
      if (b.slot !== "DH")
        fielders.set(b.slot, { p: b.player, m: def.mult.batters[i] as number });
    });
    const catcher = fielders.get("C");
    let outs = 0;
    const bases: Bases = [null, null, null];
    // Extra innings start with the batter before the leadoff man on second.
    if (inning > 9) {
      const prev = (off.next + 8) % 9;
      bases[1] = off.team.batters[prev]?.player.id ?? null;
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
    const scoreRun = () => {
      runs++;
      score[batting]++;
    };
    const speedOf = (id: string) =>
      off.team.batters.find((b) => b.player.id === id)?.player.attributes
        .speed ?? 50;

    for (
      let faced = 0;
      outs < 3 && !walkOff() && faced < MAX_BATTERS_PER_HALF;
      faced++
    ) {
      const index = off.next % 9;
      off.next++;
      const slot = off.team.batters[index];
      if (!slot) break;
      const batter = slot.player;
      const edges = atBatEdges(
        batter.chemistryColor,
        pitcher.chemistryColor,
        skill,
      );
      const bm = (off.mult.batters[index] as number) + edges.batter;
      const pm = def.mult.pitcher + edges.pitcher;
      const bat = (a: Attribute) => batter.attributes[a] * bm;
      const arm = (a: Attribute) => pitcher.attributes[a] * pm;
      const zone = ZONE_PRESETS[batter.zoneProfile ?? "even"];
      const sprayWeights = SPRAY_PRESETS[batter.sprayProfile ?? "spray"];
      const aim = LOCATION_PRESETS[pitcher.locationProfile ?? "attacks"];
      let balls = 0;
      let strikes = 0;
      let result: PlayResult | null = null;
      let batted:
        | { kind: BattedKind; direction: number; depth: number }
        | undefined;
      let fielderPos: FieldPosition | "P" | undefined;
      let rbi = 0;
      const runsBefore = runs;

      while (result === null) {
        // A steal before the pitch: from first with second open, or second with third open.
        const stealFrom: 0 | 1 | null =
          bases[0] && !bases[1] ? 0 : bases[1] && !bases[2] ? 1 : null;
        if (stealFrom !== null) {
          const runner = bases[stealFrom] as string;
          const speed = speedOf(runner);
          if (speed >= t.stealSpeed && rng.steals.chance(t.stealTry)) {
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
        // Behind in the count, the pitcher comes into the zone.
        const behind = balls === 3 || balls - strikes >= 2;
        const cells = aim.flatMap((r, i) =>
          r.map((w, j) => (behind && inZone(i, j) ? w * 1.4 : w)),
        );
        const target = rng.location.weightedIndex(cells);
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
          clamp01(0.35 + (speedOf(id) * bm - fielderArm) * t.runnerEffect),
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
            scoreRun();
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
              if (i + 1 >= 3) scoreRun();
              else bases[i + 1] = r;
            }
          }
          break;
        case "sacFly":
          outs++;
          bases[2] = null;
          scoreRun();
          rbi++;
          break;
        case "walk": {
          // Forced runners only.
          if (bases[0]) {
            if (bases[1]) {
              if (bases[2]) {
                scoreRun();
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
          advance(1, true);
          bases[0] = batter.id;
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
          scoreRun();
          rbi++;
          break;
      }
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
      });
    }
    lineScore[batting].push(runs);
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
