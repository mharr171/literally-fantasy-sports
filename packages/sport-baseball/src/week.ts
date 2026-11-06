/**
 * Playing a week of baseball (ADR 0009 §2, §3, §7; D197, D213): each
 * club's games in day order, its starter from the rotation and relievers
 * still resting left out, injured players covered, rest and injuries
 * counted down day by day (4 days a week: 3 games and a rest day), and Elo
 * after every game. Pure and seeded: every game's seed comes from the
 * season seed and the game's id, so it can be replayed exactly.
 */
import { updateElo } from "@lfs/core";
import type { BaseballConfig, BaseballOutput, BaseballTeam } from "./game";
import { simulateGame } from "./game";
import {
  nextStarter,
  type RestSettings,
  relieverRestDays,
  starterRestDays,
} from "./pitching";
import type { BaseballPlayer } from "./player";
import { DAYS_PER_WEEK } from "./season";
import { type BaseballSquad, squadForGame, squadToTeam } from "./squad";
import { type BoxScore, boxScore, gameStats } from "./stats";

/** A club as it goes into the week. */
export interface WeekClub {
  players: ReadonlyMap<string, BaseballPlayer>;
  squad: BaseballSquad;
  /** Days each pitcher still rests (D213); missing = rested. */
  rest: Readonly<Record<string, number>>;
  /** Days each player is still out injured; missing = fit. */
  injured: Readonly<Record<string, number>>;
  /** Who started the club's last game, for the rotation. */
  lastStarter: string | null;
}

export interface WeekGame {
  id: string;
  gameNo: number;
  homeSlot: number;
  awaySlot: number;
  /** Knockout games can't end level; regular-season ones can't either in baseball. */
  knockout?: boolean;
}

export interface PlayedBaseballWeekGame {
  id: string;
  homeScore: number;
  awayScore: number;
  winner: "home" | "away";
  box: BoxScore;
  /** Who started for each side. */
  starters: { home: string; away: string };
  /** Both teams as they played, so the game can be replayed from its seed (D204). */
  teams: { home: BaseballTeam; away: BaseballTeam };
}

/** A club as it comes out of the week. */
export interface WeekClubResult {
  rest: Record<string, number>;
  injured: Record<string, number>;
  lastStarter: string | null;
  /** Each player's stat totals for the week, by stat key. */
  stats: Record<string, Record<string, number>>;
  won: number;
  lost: number;
}

export interface BaseballWeekResult {
  played: PlayedBaseballWeekGame[];
  /** Elo after the week, by slot. */
  elo: Record<number, number>;
  clubs: Record<number, WeekClubResult>;
}

/** A game's seed: the season seed and the game's id (D204). */
export function baseballGameSeed(seasonSeed: string, gameId: string): string {
  return `${seasonSeed}:${gameId}`;
}

const countDown = (days: Record<string, number>, by: number) => {
  for (const id of Object.keys(days)) {
    const left = (days[id] ?? 0) - by;
    if (left > 0) days[id] = left;
    else delete days[id];
  }
};

export function playBaseballWeek(input: {
  seed: string;
  games: readonly WeekGame[];
  clubs: ReadonlyMap<number, WeekClub>;
  elo: Readonly<Record<number, number>>;
  config: BaseballConfig;
}): BaseballWeekResult {
  const rest = input.config.balance.condition.rest as RestSettings;
  const eloK = input.config.balance.payouts.eloK;
  const elo: Record<number, number> = { ...input.elo };
  const state = new Map<
    number,
    WeekClubResult & { pitchedYesterday: Set<string> }
  >();
  for (const [slot, c] of input.clubs)
    state.set(slot, {
      rest: { ...c.rest },
      injured: { ...c.injured },
      lastStarter: c.lastStarter,
      stats: {},
      won: 0,
      lost: 0,
      pitchedYesterday: new Set(),
    });
  const days = [...new Set(input.games.map((g) => g.gameNo))].sort(
    (a, b) => a - b,
  );
  const played: PlayedBaseballWeekGame[] = [];

  days.forEach((day, d) => {
    // A new day: rest and injuries count down one.
    if (d > 0)
      for (const s of state.values()) {
        countDown(s.rest, 1);
        countDown(s.injured, 1);
      }
    const pitchedToday = new Map<number, Set<string>>();
    for (const game of input.games.filter((g) => g.gameNo === day)) {
      const side = (slot: number) => {
        const club = input.clubs.get(slot);
        const s = state.get(slot);
        if (!club || !s) throw new Error(`No club in slot ${slot}.`);
        const squad = squadForGame(
          club.squad,
          club.players,
          (id) => (s.injured[id] ?? 0) > 0,
        );
        const starter =
          nextStarter(squad.rotation, s.lastStarter, s.rest) ??
          (squad.bullpen[0] as string);
        const unavailable = squad.bullpen.filter((id) => (s.rest[id] ?? 0) > 0);
        return {
          s,
          starter,
          team: squadToTeam(
            `slot${slot}`,
            {
              ...squad,
              bullpen: squad.bullpen.filter((id) => id !== starter),
            },
            club.players,
            starter,
            unavailable,
          ),
        };
      };
      const home = side(game.homeSlot);
      const away = side(game.awaySlot);
      const output: BaseballOutput = simulateGame(
        {
          home: home.team,
          away: away.team,
          mode: game.knockout ? "knockout" : "league",
          config: input.config,
        },
        baseballGameSeed(input.seed, game.id),
      );
      const { result } = output;
      const box = boxScore(output);
      const stats = gameStats(box);
      for (const [slot, c, mine] of [
        [game.homeSlot, home, "home"],
        [game.awaySlot, away, "away"],
      ] as const) {
        const s = c.s;
        const today = pitchedToday.get(slot) ?? new Set<string>();
        pitchedToday.set(slot, today);
        for (const line of box.pitchers[mine]) {
          const pitches = result.pitches[line.id] ?? 0;
          const days =
            line.id === c.starter
              ? starterRestDays(pitches, rest)
              : relieverRestDays(
                  pitches,
                  s.pitchedYesterday.has(line.id),
                  rest,
                );
          if (days > 0) s.rest[line.id] = days;
          today.add(line.id);
        }
        for (const line of [...box.batters[mine], ...box.pitchers[mine]]) {
          const add = stats[line.id];
          if (!add) continue;
          const row = s.stats[line.id] ?? {};
          for (const [k, v] of Object.entries(add)) row[k] = (row[k] ?? 0) + v;
          s.stats[line.id] = row;
        }
        s.lastStarter = c.starter;
        if (result.winner === mine) s.won++;
        else s.lost++;
      }
      for (const hurt of result.injuries) {
        const owner = input.clubs.get(game.homeSlot)?.players.has(hurt.id)
          ? home.s
          : away.s;
        owner.injured[hurt.id] = Math.max(
          owner.injured[hurt.id] ?? 0,
          hurt.days,
        );
      }
      const change = updateElo(
        elo[game.homeSlot] ?? 1500,
        elo[game.awaySlot] ?? 1500,
        result.winner === "home" ? 1 : 0,
        eloK,
      );
      elo[game.homeSlot] = change.rating;
      elo[game.awaySlot] = change.opponent;
      played.push({
        id: game.id,
        homeScore: result.score.home,
        awayScore: result.score.away,
        winner: result.winner === "home" ? "home" : "away",
        box,
        starters: { home: home.starter, away: away.starter },
        teams: { home: home.team, away: away.team },
      });
    }
    for (const [slot, s] of state)
      s.pitchedYesterday = pitchedToday.get(slot) ?? new Set();
  });
  // The rest of the week's days: the rest day, into next week's first game.
  const left = DAYS_PER_WEEK - Math.max(0, days.length - 1);
  for (const s of state.values()) {
    countDown(s.rest, left);
    countDown(s.injured, left);
  }
  return {
    played,
    elo,
    clubs: Object.fromEntries(
      [...state].map(([slot, { pitchedYesterday: _, ...s }]) => [slot, s]),
    ),
  };
}
