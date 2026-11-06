/**
 * Baseball's season part behind the sport-neutral interface (ADR 0009 §1,
 * §2): a league of 15, the week-0 bye played as the season starts, a
 * 3-game series a week with rest days, injuries, Elo and pay per game, and
 * season end with aging and youth. The postseason comes in step 9; until
 * then a season finishes after week 14.
 */
import { packEloShift, playerWorth, rosterWarning } from "@lfs/core";
import {
  type BaseballSquadPlayer,
  liveBaseballConfig,
  loadBaseballSquad,
  loadBaseballSquadPlayers,
  loadBaseballStarterPacks,
} from "../baseball-squad";
import { createServiceClient } from "../db";
import type { LoadedSeason } from "../season";
import { loadLeagueCandidates } from "../season";
import { MANAGER_SLOT, type SeasonModule } from "../season-module";
import { loadLeagueSize, loadRosterLimits } from "../sport-settings";
import type { MyTeam } from "../team";
import {
  type Attributes,
  aiBaseballClub,
  autoPickSquad,
  type BaseballPlayer,
  type BaseballSquad,
  type BatterPosition,
  baseballLeague,
  baseballStandings,
  DEFAULT_SEASON_END_SETTINGS,
  endOfSeason,
  generationSettings,
  type PitcherRole,
  type Position,
  playBaseballWeek,
  squadFromData,
  squadFromPicked,
  squadProblems,
  type WeekClub,
  youthIntake,
} from "./baseball";
import { type BaseballTraits, baseballPlayerRow } from "./baseball-players";

const BASEBALL = "baseball";

interface BaseballReady {
  players: BaseballSquadPlayer[];
  squad: BaseballSquad;
}

/** A game's stored summary: the box score for the club's own, the score and starters for the rest (D120). */
interface StoredSummary {
  score: { home: number; away: number };
  starters: { home: string; away: string };
  box?: unknown;
}

/** A copied club's player as `start_season` stores it. */
interface ClonePlayer {
  id: string;
  displayName: string;
  attributes: Attributes;
  primaryPosition: Position;
  secondaryPosition: BatterPosition | null;
  chemistryColor: number;
  overall: number;
  traits?: Partial<BaseballTraits>;
}

const fromClone = (p: ClonePlayer): BaseballPlayer => {
  const t = p.traits ?? {};
  return {
    id: p.id,
    attributes: p.attributes,
    primaryPosition: p.primaryPosition,
    secondaryPosition: p.secondaryPosition,
    pitcherRole:
      p.primaryPosition === "P" ? ((t.role ?? "starter") as PitcherRole) : null,
    chemistryColor: p.chemistryColor,
    bats: t.bats ?? "R",
    throws: t.throws ?? "R",
  };
};

/** A copied club's squad: its saved one if it still fits, else auto-pick. */
export function cloneSquad(
  players: BaseballPlayer[],
  squad: unknown,
): BaseballSquad {
  const saved = squadFromData(squad);
  if (saved && squadProblems(saved, players).length === 0) return saved;
  return squadFromPicked(autoPickSquad(players));
}

async function loadClones(
  seasonId: string,
): Promise<Map<number, { players: ClonePlayer[]; squad: unknown }>> {
  const { data, error } = await createServiceClient()
    .from("season_teams")
    .select("slot, clone")
    .eq("season_id", seasonId)
    .not("clone", "is", null);
  if (error) throw new Error(error.message);
  return new Map(
    (data ?? []).map((r) => {
      const c = r.clone as { players?: ClonePlayer[]; squad?: unknown };
      return [r.slot as number, { players: c.players ?? [], squad: c.squad }];
    }),
  );
}

/** Who started each club's latest game, from the stored summaries. */
export function lastStarters(season: LoadedSeason): Map<number, string> {
  const out = new Map<number, string>();
  const played = season.fixtures
    .filter((f) => f.homeScore !== null && f.summary)
    .sort((a, b) => a.week - b.week || (a.gameNo ?? 1) - (b.gameNo ?? 1));
  for (const f of played) {
    const s = f.summary as unknown as StoredSummary;
    if (s.starters?.home) out.set(f.homeSlot, s.starters.home);
    if (s.starters?.away) out.set(f.awaySlot, s.starters.away);
  }
  return out;
}

async function readyToPlay(team: MyTeam): Promise<BaseballReady> {
  const packs = await loadBaseballStarterPacks(team.id);
  if (packs.length === 0 || packs.some((p) => !p.resolved))
    throw new Error("Pick your starting squad first.");
  const [players, squad, limits] = await Promise.all([
    loadBaseballSquadPlayers(team.id),
    loadBaseballSquad(team.id),
    loadRosterLimits(BASEBALL),
  ]);
  const warning = rosterWarning(players.length, limits);
  if (warning) throw new Error(warning);
  if (!squad) throw new Error("Save a game-day squad first.");
  const problems = squadProblems(squad, players, limits.benchMax);
  if (problems.length > 0)
    throw new Error(`Fix your game-day squad first: ${problems.join(" ")}`);
  return { players, squad };
}

export const baseballSeason: SeasonModule<BaseballReady> = {
  playsOpeningWeek: true,
  readyToPlay,

  async newSeason(team, seed) {
    const [{ label }, candidates, size] = await Promise.all([
      liveBaseballConfig(),
      loadLeagueCandidates(team.elo, team.id, 14, BASEBALL),
      loadLeagueSize(BASEBALL),
    ]);
    const league = baseballLeague(
      seed,
      { name: team.name, elo: team.elo, teamId: team.id },
      candidates,
      size,
    );
    return {
      configVersion: label,
      slots: league.slots.map((s) => ({
        slot: s.slot,
        kind: s.kind,
        name: s.name,
        start_rating: s.startRating,
        source_team_id: s.ghostId ?? null,
      })),
      fixtures: league.games.map((g) => ({
        week: g.week,
        stage: g.stage,
        game_no: g.gameNo,
        home_slot: g.homeSlot,
        away_slot: g.awaySlot,
      })),
    };
  },

  async playWeek(team, { players, squad }, season) {
    const [{ config }, clones] = await Promise.all([
      liveBaseballConfig(),
      loadClones(season.id),
    ]);
    const generation = generationSettings(config.balance);
    const starters = lastStarters(season);
    const games = season.fixtures.filter(
      (f) => f.week === season.week && f.homeScore === null,
    );
    const inWeek = new Set(games.flatMap((g) => [g.homeSlot, g.awaySlot]));
    const clubs = new Map<number, WeekClub>();
    for (const slot of inWeek) {
      if (slot === MANAGER_SLOT) {
        clubs.set(slot, {
          players: new Map(players.map((p) => [p.id, p])),
          squad,
          rest: Object.fromEntries(
            players
              .filter((p) => p.restDays > 0)
              .map((p) => [p.id, p.restDays]),
          ),
          injured: Object.fromEntries(
            players
              .filter((p) => p.injuredDays > 0)
              .map((p) => [p.id, p.injuredDays]),
          ),
          lastStarter: starters.get(slot) ?? null,
        });
        continue;
      }
      const clone = clones.get(slot);
      const info = season.slots.find((s) => s.slot === slot);
      const roster = clone
        ? clone.players.map(fromClone)
        : (aiBaseballClub(
            season.seed,
            slot,
            info?.startRating ?? 1500,
            generation,
          ).players as BaseballPlayer[]);
      clubs.set(slot, {
        players: new Map(roster.map((p) => [p.id, p])),
        squad: cloneSquad(roster, clone?.squad),
        rest: {},
        injured: {},
        lastStarter: starters.get(slot) ?? null,
      });
    }
    const elo = Object.fromEntries(season.slots.map((s) => [s.slot, s.elo]));
    elo[MANAGER_SLOT] = team.elo;
    const week = playBaseballWeek({
      seed: season.seed,
      games: games.map((g) => ({
        id: g.id,
        gameNo: g.gameNo ?? 1,
        homeSlot: g.homeSlot,
        awaySlot: g.awaySlot,
      })),
      clubs,
      elo,
      config,
    });
    const names = Object.fromEntries(players.map((p) => [p.id, p.displayName]));
    const mine = (g: { homeSlot: number; awaySlot: number }) =>
      g.homeSlot === MANAGER_SLOT || g.awaySlot === MANAGER_SLOT;
    const me = week.clubs[MANAGER_SLOT];
    const remaining = season.fixtures.some(
      (f) => f.week > season.week && f.homeScore === null,
    );
    const pay = config.balance.payouts;
    return {
      status: remaining ? "regular" : "finished",
      args: {
        p_results: week.played.map((p) => {
          const g = games.find((x) => x.id === p.id) as (typeof games)[number];
          const own = mine(g);
          return {
            id: p.id,
            home_score: p.homeScore,
            away_score: p.awayScore,
            winner: null,
            summary: {
              score: { home: p.homeScore, away: p.awayScore },
              starters: p.starters,
              // The club's own games keep their box score (D120).
              ...(own ? { box: p.box } : {}),
            },
            // AI clubs never keep replay details (ADR 0002).
            manager_team:
              own && team.kind === "human" ? { teams: p.teams, names } : null,
          };
        }),
        p_elo: week.elo,
        p_funds: me ? (me.won + me.lost) * pay.perMatch + me.won * pay.win : 0,
        p_new_fixtures: [],
        p_status: remaining ? "regular" : "finished",
        p_next_week: remaining ? season.week + 1 : season.week,
        p_morale: null,
        p_players: players.map((p) => {
          const stats = me?.stats[p.id];
          return {
            id: p.id,
            rest_days: me?.rest[p.id] ?? 0,
            injured_days: me?.injured[p.id] ?? 0,
            appeared: Boolean(stats),
            ...(stats ? { stats } : {}),
          };
        }),
      },
    };
  },

  async closeSeason(team, season) {
    const db = createServiceClient();
    const [{ data, error }, squad, { config }] = await Promise.all([
      db
        .from("players")
        .select(
          "id, display_name, age, attributes, primary_position, secondary_position, overall, potential, potential_low, potential_high, chemistry_color, traits",
        )
        .eq("team_id", team.id),
      loadBaseballSquad(team.id),
      liveBaseballConfig(),
    ]);
    if (error) throw new Error(error.message);
    const rows = data ?? [];
    const role = (r: (typeof rows)[number]) =>
      r.primary_position === "P"
        ? (((r.traits ?? {}) as Partial<BaseballTraits>).role ?? "starter")
        : null;
    const result = endOfSeason(
      season.seed,
      rows.map((r) => ({
        id: r.id,
        age: r.age,
        attributes: r.attributes as Attributes,
        primaryPosition: r.primary_position as Position,
        pitcherRole: role(r) as PitcherRole | null,
        overall: r.overall,
        potential: r.potential,
      })),
      DEFAULT_SEASON_END_SETTINGS,
    );
    const byId = new Map(rows.map((r) => [r.id, r]));
    // The club's line: standings in the regular season (ADR 0009 §2).
    const games = season.fixtures.filter(
      (f) => f.homeScore !== null && f.awayScore !== null,
    );
    const table = baseballStandings(
      season.slots.map((s) => s.slot),
      games.map((f) => ({
        homeSlot: f.homeSlot,
        awaySlot: f.awaySlot,
        homeScore: f.homeScore as number,
        awayScore: f.awayScore as number,
      })),
    );
    const position = table.findIndex((r) => r.slot === MANAGER_SLOT) + 1;
    const line = table.find((r) => r.slot === MANAGER_SLOT);
    return {
      p_updates: result.aged.map((a) => {
        const p = byId.get(a.id) as (typeof rows)[number];
        return {
          id: a.id,
          age: a.age,
          attributes: a.attributes,
          overall: a.overall,
          worth: playerWorth({
            overall: a.overall,
            age: a.age,
            potentialRange: [p.potential_low, p.potential_high],
          }),
        };
      }),
      p_retired: result.retired,
      p_review: {
        retired: result.retired.map((id) => {
          const p = byId.get(id) as (typeof rows)[number];
          return {
            name: p.display_name,
            position: p.primary_position,
            age: p.age + 1,
            overall: p.overall,
          };
        }),
        changes: result.aged
          .map((a) => {
            const p = byId.get(a.id) as (typeof rows)[number];
            return {
              name: p.display_name,
              position: p.primary_position,
              age: a.age,
              from: p.overall,
              to: a.overall,
            };
          })
          .filter((c) => c.from !== c.to)
          .sort((x, y) => y.to - y.from - (x.to - x.from)),
      },
      p_snapshot: {
        // The club as it finished: its copy in other clubs' leagues (D116).
        players: rows.map((r) => ({
          id: r.id,
          displayName: r.display_name,
          attributes: r.attributes,
          primaryPosition: r.primary_position,
          secondaryPosition: r.secondary_position,
          chemistryColor: r.chemistry_color,
          overall: r.overall,
          traits: r.traits ?? {},
        })),
        squad,
        stats: {
          position,
          played: (line?.won ?? 0) + (line?.lost ?? 0),
          won: line?.won ?? 0,
          drawn: 0,
          lost: line?.lost ?? 0,
          scored: line?.runsScored ?? 0,
          conceded: line?.runsAllowed ?? 0,
          points: line?.won ?? 0,
          playoffs: "none",
        },
        game_version: process.env.GAME_VERSION ?? "unknown",
      },
      p_elo_shift: packEloShift(team.elo, config.balance.packs),
    };
  },

  async youthRows(seed) {
    const { config } = await liveBaseballConfig();
    return youthIntake(
      seed,
      DEFAULT_SEASON_END_SETTINGS,
      generationSettings(config.balance),
    ).map(baseballPlayerRow);
  },
};
