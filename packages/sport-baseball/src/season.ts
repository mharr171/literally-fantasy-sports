/**
 * Baseball's season (ADR 0009 §2, D199): a league of 15 clubs, every club
 * playing every other once in a 3-game series, one club sitting out each
 * week. The manager's bye is week 0, played as the season starts, so the
 * manager plays weeks 1–14 straight through. Pure: the game layer loads
 * the season, calls these, and saves what they return.
 */
import {
  aiOpponentRatings,
  createRng,
  type Fixture,
  type Rng,
  roundRobin,
} from "@lfs/core";
import {
  DEFAULT_GENERATION_SETTINGS,
  type GeneratedPlayer,
  type GenerationSettings,
  generatePlayer,
} from "./generation";
import { autoPickSquad } from "./lineup";
import type { BaseballPlayer } from "./player";
import type { Position } from "./positions";
import type { GhostCandidateLike } from "./season-types";
import { type BaseballSquad, squadFromPicked } from "./squad";

/** Clubs in a baseball league (D199). */
export const BASEBALL_LEAGUE_SIZE = 15;
/** Games in a regular-season series (D197). */
export const GAMES_PER_SERIES = 3;
/** Days a week of games takes: 3 games and a rest day (D197). */
export const DAYS_PER_WEEK = 4;
export const MANAGER_SLOT = 0;

export type BaseballStage =
  | "league"
  | "wildcard"
  | "quarter"
  | "semi"
  | "final";

export const BASEBALL_STAGE_NAMES: Record<BaseballStage, string> = {
  league: "Regular season",
  wildcard: "Wildcard game",
  quarter: "Quarterfinals",
  semi: "Semifinals",
  final: "Final",
};

export interface BaseballLeagueSlot {
  slot: number;
  name: string;
  kind: "manager" | "ai" | "ghost";
  /** Elo at season start; a generated club's players are built from it. */
  startRating: number;
  /** For a copied club: its team id (D115). */
  ghostId?: string | null;
}

/** One game of the schedule; a series is 3 of these with game numbers 1–3. */
export interface BaseballNewGame {
  week: number;
  stage: BaseballStage;
  gameNo: number;
  homeSlot: number;
  awaySlot: number;
}

/**
 * The regular season for these slots: a single round robin, each pairing a
 * 3-game series at one club's park. The week the manager sits out becomes
 * week 0; the other weeks are numbered 1–14 in order.
 */
export function baseballSchedule(
  seed: string,
  slots: readonly number[],
  managerSlot: number = MANAGER_SLOT,
): BaseballNewGame[] {
  const order = createRng(seed).fork("schedule").shuffle(slots.map(String));
  const rounds = roundRobin(order, 1);
  const weeks = [...new Set(rounds.map((f) => f.week))].sort((a, b) => a - b);
  const plays = (w: number) =>
    rounds.some(
      (f) =>
        f.week === w &&
        (f.home === String(managerSlot) || f.away === String(managerSlot)),
    );
  const bye = weeks.find((w) => !plays(w));
  // An even league has no bye: the weeks keep their order from 1.
  const renumber = new Map<number, number>();
  let next = 1;
  for (const w of weeks) renumber.set(w, w === bye ? 0 : next++);
  return rounds
    .flatMap((f: Fixture) =>
      Array.from({ length: GAMES_PER_SERIES }, (_, g) => ({
        week: renumber.get(f.week) as number,
        stage: "league" as const,
        gameNo: g + 1,
        homeSlot: Number(f.home),
        awaySlot: Number(f.away),
      })),
    )
    .sort(
      (a, b) =>
        a.week - b.week || a.homeSlot - b.homeSlot || a.gameNo - b.gameNo,
    );
}

/** How a generated club's level follows its Elo, as soccer's (D32). */
export interface BaseballAiSettings {
  /** Average overall for a club rated 1500. */
  baseOverall: number;
  /** Elo points per overall point. */
  ratingPerOverall: number;
  /** Players vary around the level by this much. */
  spread: number;
}

export const DEFAULT_BASEBALL_AI: BaseballAiSettings = {
  baseOverall: 55,
  ratingPerOverall: 20,
  spread: 4,
};

/** A generated club's average overall for its rating. */
export function overallForRating(
  rating: number,
  s: BaseballAiSettings = DEFAULT_BASEBALL_AI,
): number {
  const level = s.baseOverall + (rating - 1500) / s.ratingPerOverall;
  return Math.max(30, Math.min(95, Math.round(level)));
}

const PLACES = [
  "Ashford",
  "Bramble Creek",
  "Cedar Falls",
  "Dunmore",
  "Eastgate",
  "Fallowfield",
  "Glenhaven",
  "Harrow Bay",
  "Ironbridge",
  "Juniper Hill",
  "Kingsmere",
  "Larkspur",
  "Maple Ridge",
  "Northbrook",
  "Oakvale",
  "Port Ellis",
  "Quill Harbor",
  "Redwater",
  "Sandpoint",
  "Timberline",
  "Upton Lake",
  "Westmoor",
  "Willow Bend",
  "Copper Flats",
  "Stony Brook",
  "Silverton",
  "Pine Hollow",
  "Granite Falls",
] as const;
const NICKNAMES = [
  "Herons",
  "Foxes",
  "Comets",
  "Pioneers",
  "Owls",
  "Bison",
  "Hawks",
  "Lumberjacks",
  "Stallions",
  "Voyagers",
  "Grizzlies",
  "Otters",
  "Thunder",
  "Wolves",
  "Badgers",
  "Kestrels",
] as const;

/** A made-up club name, e.g. "Maple Ridge Herons". */
export function baseballClubName(rng: Rng): string {
  return `${rng.pick(PLACES)} ${rng.pick(NICKNAMES)}`;
}

/** A generated club's roster: one of each batter position and four more, 6 starters and 7 relievers. */
const AI_BATTERS: readonly Position[] = [
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "LF",
  "CF",
  "RF",
  "DH",
  "C",
  "SS",
  "CF",
  "1B",
];

export interface BaseballAiClub {
  name: string;
  rating: number;
  players: (GeneratedPlayer & { id: string })[];
  squad: BaseballSquad;
}

/** A generated club at this rating, rebuilt from the season seed whenever it's needed. */
export function aiBaseballClub(
  seed: string,
  slot: number,
  rating: number,
  generation: GenerationSettings = DEFAULT_GENERATION_SETTINGS,
  settings: BaseballAiSettings = DEFAULT_BASEBALL_AI,
): BaseballAiClub {
  const rng = createRng(seed).fork(`ai-${slot}`);
  const level = overallForRating(rating, settings);
  const make = (
    position: Position,
    key: string,
    role?: "starter" | "reliever",
  ) => {
    const r = rng.fork(key);
    return {
      ...generatePlayer(r, {
        position,
        overall: Math.round(r.normal(level, settings.spread)),
        settings: generation,
        ...(role ? { role } : {}),
      }),
      id: `ai${slot}-${key}`,
    };
  };
  const players = [
    ...AI_BATTERS.map((p, i) => make(p, `b${i}`)),
    ...Array.from({ length: 6 }, (_, i) => make("P", `sp${i}`, "starter")),
    ...Array.from({ length: 7 }, (_, i) => make("P", `rp${i}`, "reliever")),
  ];
  return {
    name: baseballClubName(rng.fork("name")),
    rating,
    players,
    squad: squadFromPicked(autoPickSquad(players as BaseballPlayer[])),
  };
}

/**
 * A new league of the clubs nearest the club's Elo (D115), as soccer's:
 * the `size - 1` candidates closest to its Elo, ties broken at random
 * (seeded); generated clubs fill the places nobody real is near enough
 * for. The club is never its own opponent.
 */
export function baseballLeague(
  seed: string,
  club: { name: string; elo: number; teamId: string },
  candidates: readonly GhostCandidateLike[],
  size: number = BASEBALL_LEAGUE_SIZE,
): { slots: BaseballLeagueSlot[]; games: BaseballNewGame[] } {
  const seen = new Set<string>([club.teamId]);
  const unique = candidates.filter((c) => {
    if (seen.has(c.teamId)) return false;
    seen.add(c.teamId);
    return true;
  });
  const nearest = createRng(seed)
    .fork("nearest")
    .shuffle(unique)
    .sort((a, b) => Math.abs(a.elo - club.elo) - Math.abs(b.elo - club.elo))
    .slice(0, size - 1)
    .sort((a, b) => a.elo - b.elo || a.teamId.localeCompare(b.teamId));
  const place = (name: string) =>
    name.slice(0, Math.max(0, name.lastIndexOf(" "))).toLowerCase();
  const used = new Set([club.name.toLowerCase()]);
  const places = new Set([place(club.name)]);
  const slots: BaseballLeagueSlot[] = [
    {
      slot: MANAGER_SLOT,
      name: club.name,
      kind: "manager",
      startRating: club.elo,
    },
  ];
  nearest.forEach((c, i) => {
    used.add(c.name.toLowerCase());
    places.add(place(c.name));
    slots.push({
      slot: i + 1,
      name: c.name,
      kind: "ghost",
      startRating: c.elo,
      ghostId: c.teamId,
    });
  });
  aiOpponentRatings(club.elo, size - 1 - nearest.length).forEach(
    (rating, i) => {
      const slot = nearest.length + i + 1;
      let name = baseballClubName(
        createRng(seed).fork(`ai-${slot}`).fork("name"),
      );
      for (
        let k = 0;
        used.has(name.toLowerCase()) || places.has(place(name));
        k++
      )
        name = baseballClubName(createRng(seed).fork(`name-${slot}-${k}`));
      used.add(name.toLowerCase());
      places.add(place(name));
      slots.push({ slot, name, kind: "ai", startRating: rating });
    },
  );
  return {
    slots,
    games: baseballSchedule(
      seed,
      slots.map((s) => s.slot),
    ),
  };
}

/** A played game, as the standings need it. */
export interface PlayedBaseballGame {
  homeSlot: number;
  awaySlot: number;
  homeScore: number;
  awayScore: number;
}

export interface BaseballStanding {
  slot: number;
  won: number;
  lost: number;
  /** Winning percentage, 0–1; 0 before the first game. */
  pct: number;
  /** Games behind the leader. */
  gamesBehind: number;
  runsScored: number;
  runsAllowed: number;
  difference: number;
}

/**
 * The standings (ADR 0008 §7): winning percentage, then head-to-head wins
 * among the tied clubs, then run difference, then slot order.
 */
export function baseballStandings(
  slots: readonly number[],
  games: readonly PlayedBaseballGame[],
): BaseballStanding[] {
  const rows = new Map<number, BaseballStanding>(
    slots.map((slot) => [
      slot,
      {
        slot,
        won: 0,
        lost: 0,
        pct: 0,
        gamesBehind: 0,
        runsScored: 0,
        runsAllowed: 0,
        difference: 0,
      },
    ]),
  );
  const add = (slot: number, scored: number, allowed: number) => {
    const r = rows.get(slot);
    if (!r) throw new Error(`Slot ${slot} isn't in this league.`);
    r.runsScored += scored;
    r.runsAllowed += allowed;
    r.difference = r.runsScored - r.runsAllowed;
    if (scored > allowed) r.won++;
    else r.lost++;
  };
  for (const g of games) {
    add(g.homeSlot, g.homeScore, g.awayScore);
    add(g.awaySlot, g.awayScore, g.homeScore);
  }
  for (const r of rows.values())
    r.pct = r.won + r.lost === 0 ? 0 : r.won / (r.won + r.lost);
  // Head-to-head wins against the other clubs on the same percentage.
  const headToHead = (slot: number, tied: ReadonlySet<number>) =>
    games.filter(
      (g) =>
        tied.has(g.homeSlot) &&
        tied.has(g.awaySlot) &&
        ((g.homeSlot === slot && g.homeScore > g.awayScore) ||
          (g.awaySlot === slot && g.awayScore > g.homeScore)),
    ).length;
  const all = [...rows.values()];
  const tiedWith = (r: BaseballStanding) =>
    new Set(all.filter((x) => x.pct === r.pct).map((x) => x.slot));
  const sorted = all.sort(
    (a, b) =>
      b.pct - a.pct ||
      headToHead(b.slot, tiedWith(b)) - headToHead(a.slot, tiedWith(a)) ||
      b.difference - a.difference ||
      a.slot - b.slot,
  );
  const leader = sorted[0];
  if (leader)
    for (const r of sorted)
      r.gamesBehind = (leader.won - r.won + (r.lost - leader.lost)) / 2;
  return sorted;
}
