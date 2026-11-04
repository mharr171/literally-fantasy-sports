/**
 * AI opponents (D8, D32): a full 22-player squad whose strength matches a
 * rating, and a made-up club name. Generated from a seed, so a league's AI
 * teams can be stored as seeds and rebuilt exactly.
 */
import type { Rng } from "@lfs/core";
import {
  DEFAULT_GENERATION_SETTINGS,
  type GeneratedPlayer,
  type GenerationSettings,
  generatePlayer,
} from "./generation";
import { BENCH_SIZE, formation, type MatchdaySquad } from "./matchday";
import type { Position } from "./positions";

/** How ratings map to player level. Balance defaults: changed only with Gary's OK. */
export interface AiTeamSettings {
  /** Average starter overall for a team rated 1500 (a fresh team's level). */
  baseOverall: number;
  /** Rating points per point of overall. */
  ratingPerOverall: number;
  /** Starters vary around the level by this much. */
  spread: number;
  /** Substitutes sit this far below the starters. */
  benchDrop: number;
  formation: string;
}

export const DEFAULT_AI_TEAM_SETTINGS: AiTeamSettings = {
  baseOverall: 55,
  ratingPerOverall: 20,
  spread: 4,
  benchDrop: 4,
  formation: "4-4-2",
};

/** The average starter overall an AI team gets for its rating. */
export function overallForRating(
  rating: number,
  settings: AiTeamSettings = DEFAULT_AI_TEAM_SETTINGS,
): number {
  const level =
    settings.baseOverall + (rating - 1500) / settings.ratingPerOverall;
  return Math.max(30, Math.min(95, Math.round(level)));
}

// Generic, made-up sounding places: no real club names.
const PLACES = [
  "Ashvale",
  "Brackenford",
  "Caldermoor",
  "Dunhollow",
  "Eastmere",
  "Fallowby",
  "Glenmarsh",
  "Harrowgate",
  "Ironbridge",
  "Kestrel Bay",
  "Larchmont",
  "Millbrook",
  "Northwold",
  "Oakhaven",
  "Pennridge",
  "Quarry Hill",
  "Redcliffe",
  "Saltmarsh",
  "Thornbury",
  "Underwood",
  "Valemouth",
  "Westerfold",
  "Yarrowdale",
  "Copperfield",
  "Blackwater",
  "Stonehaven",
  "Riverton",
  "Highcombe",
  "Elmswick",
  "Fairhaven",
  "Greystone",
  "Hollinsford",
  "Marrowby",
  "Netherby",
  "Oldcastle",
  "Pinecrest",
  "Rookwood",
  "Silverlea",
  "Tidewater",
  "Wyndham Vale",
];
const SUFFIXES = [
  "United",
  "City",
  "Rovers",
  "Athletic",
  "Wanderers",
  "Town",
  "Albion",
  "FC",
  "Rangers",
  "Sporting",
  "Dynamo",
  "County",
];

/** A made-up club name, e.g. "Kestrel Bay Rovers". */
export function aiTeamName(rng: Rng): string {
  return `${rng.pick(PLACES)} ${rng.pick(SUFFIXES)}`;
}

/** Substitute positions: a keeper, then one of each line, then the rest. */
const BENCH_POSITIONS: Position[] = [
  "GK",
  "CB",
  "CM",
  "ST",
  "LB",
  "RB",
  "DM",
  "AM",
  "LW",
  "RW",
  "CB",
];

export interface AiTeam {
  name: string;
  rating: number;
  players: (GeneratedPlayer & { id: string })[];
  squad: MatchdaySquad;
}

/**
 * A complete AI team for a rating: 11 starters in the formation's
 * positions around the rating's level and 11 weaker substitutes.
 */
export function generateAiTeam(
  rng: Rng,
  rating: number,
  idPrefix: string,
  settings: AiTeamSettings = DEFAULT_AI_TEAM_SETTINGS,
  generation: GenerationSettings = DEFAULT_GENERATION_SETTINGS,
): AiTeam {
  const shape = formation(settings.formation);
  if (!shape) throw new Error(`Unknown formation: ${settings.formation}`);
  const level = overallForRating(rating, settings);
  const make = (position: Position, mean: number, key: string) => {
    const r = rng.fork(key);
    const overall = Math.round(r.normal(mean, settings.spread));
    return {
      ...generatePlayer(r, { position, overall, settings: generation }),
      id: `${idPrefix}-${key}`,
    };
  };
  const starters = shape.slots.map((s, i) => make(s.position, level, `s${i}`));
  const bench = BENCH_POSITIONS.slice(0, BENCH_SIZE).map((p, i) =>
    make(p, level - settings.benchDrop, `b${i}`),
  );
  return {
    name: aiTeamName(rng.fork("name")),
    rating,
    players: [...starters, ...bench],
    squad: {
      formation: shape.id,
      lineup: starters.map((p) => p.id),
      bench: bench.map((p) => p.id),
      subPlan: [],
    },
  };
}
