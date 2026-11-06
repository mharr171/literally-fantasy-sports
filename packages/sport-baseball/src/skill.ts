/**
 * Effective skill on game day (ADR 0008 §2–§3): how much a player's
 * attributes count in this game. Bonuses add up, then multiply the
 * attributes once, as in soccer:
 * - position fit: primary +25%, secondary +10%, anywhere else the
 *   out-of-position penalty, −50% (D195);
 * - chemistry among the 10 in the game, the 9 batters with the DH and the
 *   pitcher on the mound (core's groups and boosts, D200);
 * - the team matchup: your dominant color against theirs (D119);
 * - home advantage (D194);
 * - the player matchup, the pitcher's color against the batter's, worked
 *   out for each at-bat with `atBatEdges` (D211).
 * Matchups are off (0) until a settings version turns them on.
 */
import {
  type ChemistryBoosts,
  chemistryBoostsByPlayer,
  colorEdge,
  DEFAULT_CHEMISTRY_BOOSTS,
  rankedColors,
} from "@lfs/core";
import { COLOR_COUNT } from "./generation";
import { type BaseballPlayer, battingSide } from "./player";
import type { BatterPosition, Position } from "./positions";

export type PositionFit = "primary" | "secondary" | "other";

export interface SkillTuning {
  positionFit: { primary: number; secondary: number; other: number };
  /** The home side's skill boost (D194); facilities may raise it later. */
  homeBoost: number;
  chemistry: ChemistryBoosts;
  /** Boost for the side whose dominant color beats the other's (D119). */
  teamMatchup: number;
  /** The same for the second colors. */
  teamMatchupSecond: number;
  /** Most a batter or pitcher moves for winning or losing their matchup. */
  playerMatchup: number;
  /** The 4 colors in ring order: each beats the next (D211). */
  colorRing: readonly number[];
  /**
   * The platoon edge (D224): the batter's skill edge when he hits from the
   * side opposite the pitcher's arm; the pitcher's when they're the same.
   */
  platoonEdge: number;
}

export const BASEBALL_COLOR_RING: readonly number[] = [0, 1, 2, 3];

export const DEFAULT_SKILL_TUNING: SkillTuning = {
  positionFit: { primary: 0.25, secondary: 0.1, other: -0.5 },
  homeBoost: 0.03,
  chemistry: DEFAULT_CHEMISTRY_BOOSTS,
  teamMatchup: 0,
  teamMatchupSecond: 0,
  playerMatchup: 0,
  colorRing: BASEBALL_COLOR_RING,
  platoonEdge: 0.08,
};

/** Soccer's matchup strengths (D150), for the harness's matchups run. */
export const PROPOSED_MATCHUPS: Pick<
  SkillTuning,
  "teamMatchup" | "teamMatchupSecond" | "playerMatchup"
> = { teamMatchup: 0.07, teamMatchupSecond: 0.035, playerMatchup: 0.09 };

/**
 * How well a player fits a slot. Pitchers only pitch and batters never
 * do (D195): either way round throws. Any batter can be the DH, at the
 * secondary bonus unless the DH is their primary position.
 */
export function positionFit(
  player: Pick<BaseballPlayer, "primaryPosition" | "secondaryPosition">,
  slot: Position,
): PositionFit {
  const pitcher = player.primaryPosition === "P";
  if (pitcher !== (slot === "P"))
    throw new RangeError(
      pitcher ? "A pitcher can only pitch." : "Only a pitcher can pitch.",
    );
  if (slot === player.primaryPosition) return "primary";
  if (slot === player.secondaryPosition || slot === "DH") return "secondary";
  return "other";
}

export interface GameSide {
  /** The batting order, 9 with the DH, and where each one plays. */
  batters: readonly { player: BaseballPlayer; slot: BatterPosition }[];
  /** The pitcher on the mound. */
  pitcher: BaseballPlayer;
  home: boolean;
}

export interface SideMultipliers {
  /** One per batter, in batting order. */
  batters: number[];
  pitcher: number;
}

/**
 * Each player's skill multiplier for a side, before the at-bat's player
 * matchup: 1 + position fit + chemistry + team matchup + home boost. A
 * pitching change calls this again, as a substitution does in soccer.
 */
export function sideMultipliers(
  side: GameSide,
  opponent: GameSide,
  tuning: SkillTuning = DEFAULT_SKILL_TUNING,
): SideMultipliers {
  const inGame = [...side.batters.map((b) => b.player), side.pitcher];
  const chemistry = chemistryBoostsByPlayer(
    inGame.map((p) => p.chemistryColor),
    COLOR_COUNT,
    tuning.chemistry,
  );
  const shared =
    teamMatchupBonus(side, opponent, tuning) +
    (side.home ? tuning.homeBoost : 0);
  const multiplier = (fit: PositionFit, chem: number) =>
    Math.max(0, 1 + tuning.positionFit[fit] + chem + shared);
  return {
    batters: side.batters.map((b, i) =>
      multiplier(positionFit(b.player, b.slot), chemistry[i] as number),
    ),
    pitcher: multiplier(
      positionFit(side.pitcher, "P"),
      chemistry[inGame.length - 1] as number,
    ),
  };
}

/** The team matchup bonus for `side`: dominant and second colors (D119). */
export function teamMatchupBonus(
  side: GameSide,
  opponent: GameSide,
  tuning: SkillTuning = DEFAULT_SKILL_TUNING,
): number {
  if (!tuning.teamMatchup && !tuning.teamMatchupSecond) return 0;
  const colors = (s: GameSide) =>
    [...s.batters.map((b) => b.player), s.pitcher].map((p) => p.chemistryColor);
  const mine = rankedColors(colors(side), tuning.chemistry.minGroupSize);
  const theirs = rankedColors(colors(opponent), tuning.chemistry.minGroupSize);
  const won = (a: number | null, b: number | null) =>
    a !== null && b !== null && colorEdge(a, b, tuning.colorRing) > 0;
  return (
    (won(mine.first, theirs.first) ? tuning.teamMatchup : 0) +
    (won(mine.second, theirs.second) ? tuning.teamMatchupSecond : 0)
  );
}

/**
 * The player matchup for one at-bat (D211): the batter's and the pitcher's
 * extra multiplier from their colors, one the other's opposite.
 */
export function atBatEdges(
  batterColor: number,
  pitcherColor: number,
  tuning: SkillTuning = DEFAULT_SKILL_TUNING,
): { batter: number; pitcher: number } {
  const ring = tuning.colorRing;
  // + 0 turns −0 (matchups off against a beaten color) into 0.
  const edge = (a: number, b: number) =>
    tuning.playerMatchup * colorEdge(a, b, ring) + 0;
  return {
    batter: edge(batterColor, pitcherColor),
    pitcher: edge(pitcherColor, batterColor),
  };
}

/**
 * The platoon edge for one at-bat (D224): to the batter when he hits from
 * the side opposite the pitcher's arm (a switch hitter always does), to the
 * pitcher otherwise.
 */
export function platoonEdges(
  batter: Pick<BaseballPlayer, "bats">,
  pitcher: Pick<BaseballPlayer, "throws">,
  tuning: SkillTuning = DEFAULT_SKILL_TUNING,
): { batter: number; pitcher: number } {
  const opposite =
    battingSide(batter.bats, pitcher.throws) !== (pitcher.throws ?? "R");
  return opposite
    ? { batter: tuning.platoonEdge, pitcher: 0 }
    : { batter: 0, pitcher: tuning.platoonEdge };
}
