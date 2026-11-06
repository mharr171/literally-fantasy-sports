import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  doublePrecision,
  foreignKey,
  index,
  integer,
  jsonb,
  pgPolicy,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { authenticatedRole, authUid, authUsers } from "drizzle-orm/supabase";

/**
 * One row per account, created automatically when someone signs up
 * (see the `handle_new_user` trigger migration).
 *
 * `is_admin` is set by hand only (D21): players can change their display
 * name but never this flag.
 */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid()
      .primaryKey()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    displayName: text().notNull(),
    isAdmin: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      "profiles_display_name_length",
      sql`char_length(${t.displayName}) between 1 and 40`,
    ),
    pgPolicy("profiles_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${authUid} = ${t.id}`,
    }),
    pgPolicy("profiles_update_own", {
      for: "update",
      to: authenticatedRole,
      using: sql`${authUid} = ${t.id}`,
      withCheck: sql`${authUid} = ${t.id}`,
    }),
  ],
).enableRLS();

export type Profile = typeof profiles.$inferSelect;

/** Calls the public.is_admin() function (migration 0002). */
const isAdmin = sql`(select public.is_admin())`;

/** Sports that can have their own settings, plus settings shared by all. */
export const CONFIG_SCOPES = [
  "global",
  "soccer",
  "baseball",
  "paintball",
  "football",
  "basketball",
  "hockey",
] as const;

/**
 * Versions of the game settings (D9, D59). Each sport has its own numbered
 * versions. A draft can be edited by admins; once published it is frozen, so
 * every match that recorded a config version can be replayed exactly.
 * The newest published version of a sport is the one new matches use.
 */
export const gameConfigVersions = pgTable(
  "game_config_versions",
  {
    scope: text().notNull(),
    version: integer().notNull(),
    note: text().notNull().default(""),
    createdBy: uuid().references(() => authUsers.id, { onDelete: "set null" }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    publishedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    primaryKey({ columns: [t.scope, t.version] }),
    check(
      "game_config_versions_scope",
      sql`${t.scope} in ('global', 'soccer', 'baseball', 'paintball', 'football', 'basketball', 'hockey')`,
    ),
    check("game_config_versions_version_positive", sql`${t.version} > 0`),
    pgPolicy("game_config_versions_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.publishedAt} is not null or ${isAdmin}`,
    }),
    pgPolicy("game_config_versions_insert_admin", {
      for: "insert",
      to: authenticatedRole,
      withCheck: isAdmin,
    }),
    pgPolicy("game_config_versions_update_admin", {
      for: "update",
      to: authenticatedRole,
      using: isAdmin,
      withCheck: isAdmin,
    }),
    pgPolicy("game_config_versions_delete_admin", {
      for: "delete",
      to: authenticatedRole,
      using: isAdmin,
    }),
  ],
).enableRLS();

/**
 * The settings in each version: one row per key, e.g. "tuning" or
 * "templates", holding JSON. Readable when its version is published.
 */
export const gameConfig = pgTable(
  "game_config",
  {
    scope: text().notNull(),
    version: integer().notNull(),
    key: text().notNull(),
    value: jsonb().notNull(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.scope, t.version, t.key] }),
    foreignKey({
      columns: [t.scope, t.version],
      foreignColumns: [gameConfigVersions.scope, gameConfigVersions.version],
    }).onDelete("cascade"),
    check("game_config_key_format", sql`${t.key} ~ '^[a-z][a-z0-9_.]{0,63}$'`),
    pgPolicy("game_config_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`${isAdmin} or exists (
        select 1 from public.game_config_versions v
        where v.scope = ${t.scope} and v.version = ${t.version} and v.published_at is not null
      )`,
    }),
    pgPolicy("game_config_insert_admin", {
      for: "insert",
      to: authenticatedRole,
      withCheck: isAdmin,
    }),
    pgPolicy("game_config_update_admin", {
      for: "update",
      to: authenticatedRole,
      using: isAdmin,
      withCheck: isAdmin,
    }),
    pgPolicy("game_config_delete_admin", {
      for: "delete",
      to: authenticatedRole,
      using: isAdmin,
    }),
  ],
).enableRLS();

export type GameConfigVersion = typeof gameConfigVersions.$inferSelect;
export type GameConfigRow = typeof gameConfig.$inferSelect;

const SPORT_CHECK = sql`in ('soccer', 'baseball', 'paintball', 'football', 'basketball', 'hockey')`;

/**
 * A manager's team in one sport: at most one per sport per account (D5).
 * Players read their own team; every change goes through the server, which
 * validates it and writes with the service role (no direct writes, Step 8).
 */
export const teams = pgTable(
  "teams",
  {
    id: uuid().primaryKey().defaultRandom(),
    /** The manager's account; null for an AI club (D113). */
    ownerId: uuid().references(() => authUsers.id, { onDelete: "cascade" }),
    sport: text().notNull(),
    name: text().notNull(),
    /** Weeks without the club's own match play by themselves (D134). */
    skipIdleWeeks: boolean().notNull().default(false),
    /** "human" or "ai" (D113). Only admins can tell them apart. */
    kind: text().notNull().default("human"),
    /** An AI club's invented manager. */
    managerName: text(),
    /** An AI club's profile: personality, pace and formation (server only). */
    ai: jsonb(),
    elo: integer().notNull().default(1500),
    /** Starting funds let a new team buy its first packs (balance default, Gary OKs). */
    funds: integer().notNull().default(10_000),
    energy: integer().notNull().default(6),
    energyUpdatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    /** Team morale after recent results, −1 to 1 (M4). */
    morale: doublePrecision().notNull().default(0),
    /**
     * Club colors (D107): 2 or 3 palette keys, main color first. Empty for
     * clubs from before, which show colors worked out from their name.
     */
    colors: text().array().notNull().default(sql`'{}'::text[]`),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("teams_owner_sport").on(t.ownerId, t.sport),
    uniqueIndex("teams_sport_name").on(t.sport, sql`lower(${t.name})`),
    check("teams_sport", sql`${t.sport} ${SPORT_CHECK}`),
    check(
      "teams_name_length",
      sql`char_length(btrim(${t.name})) between 3 and 30`,
    ),
    check("teams_funds_nonnegative", sql`${t.funds} >= 0`),
    check("teams_energy_nonnegative", sql`${t.energy} >= 0`),
    check("teams_morale_range", sql`${t.morale} between -1 and 1`),
    check(
      "teams_kind",
      sql`(${t.kind} = 'human' and ${t.ownerId} is not null and ${t.ai} is null) or (${t.kind} = 'ai' and ${t.ownerId} is null and ${t.managerName} is not null and ${t.ai} is not null)`,
    ),
    check(
      "teams_colors",
      sql`cardinality(${t.colors}) = 0 or (cardinality(${t.colors}) between 2 and 3 and array_position(${t.colors}, null) is null)`,
    ),
    pgPolicy("teams_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`${t.ownerId} = ${authUid}`,
    }),
  ],
).enableRLS();

/**
 * Players on a team. `potential` is the hidden true potential (D48): no
 * player can read that column, only the shown range.
 */
export const players = pgTable(
  "players",
  {
    id: uuid().primaryKey().defaultRandom(),
    teamId: uuid()
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    sport: text().notNull(),
    firstName: text().notNull(),
    lastName: text().notNull(),
    displayName: text().notNull(),
    nationality: text().notNull(),
    age: integer().notNull(),
    primaryPosition: text().notNull(),
    secondaryPosition: text(),
    attributes: jsonb().notNull(),
    overall: integer().notNull(),
    potential: integer().notNull(),
    potentialLow: integer().notNull(),
    potentialHigh: integer().notNull(),
    worth: integer().notNull(),
    chemistryColor: integer().notNull(),
    templateVariant: text().notNull().default("default"),
    /** Template variant at the secondary position (D136). */
    secondaryTemplateVariant: text().notNull().default("default"),
    /** Came from a free starter pack: can be released but not resold (D83). */
    fromStarterPack: boolean().notNull().default(false),
    /** Match fitness at the next kickoff, 0–100 (D45, M4). */
    fitness: integer().notNull().default(100),
    /** Game weeks still out injured. */
    injuredWeeks: integer().notNull().default(0),
    /** Matches still to sit out. */
    suspendedWeeks: integer().notNull().default(0),
    /** Yellow cards this season (every 5th earns a ban). */
    yellowCards: integer().notNull().default(0),
    /** Recent form, −1 to 1 (M4). */
    form: doublePrecision().notNull().default(0),
    /** Career totals for the retirement record (D120). */
    appearances: integer().notNull().default(0),
    goals: integer().notNull().default(0),
    /** More career totals (D143), counted from the club's own matches. */
    /** Games and goals counted from when player stats started (D147), so
     * they agree with the wins, draws and losses on the card. */
    /** Minutes in the club's own matches this season, reset at season end (D154). */
    seasonMinutes: integer().notNull().default(0),
    statGames: integer().notNull().default(0),
    statGoals: integer().notNull().default(0),
    wins: integer().notNull().default(0),
    draws: integer().notNull().default(0),
    losses: integer().notNull().default(0),
    assists: integer().notNull().default(0),
    tackles: integer().notNull().default(0),
    /**
     * Career stats by key (ADR 0007 §2), e.g. {"goals": 12}. For soccer a
     * trigger keeps it in step with the stat columns until M17 drops them.
     */
    stats: jsonb().notNull().default({}),
    saves: integer().notNull().default(0),
    /** Season ends the player has been through. */
    seasons: integer().notNull().default(0),
    /** Highest overall so far (null until the first season end). */
    bestOverall: integer(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("players_team").on(t.teamId),
    // The hall of fame's all-time lists (ADR 0005).
    index("players_stat_games").on(t.sport, t.statGames.desc()),
    index("players_stat_goals").on(t.sport, t.statGoals.desc()),
    index("players_assists").on(t.sport, t.assists.desc()),
    index("players_tackles").on(t.sport, t.tackles.desc()),
    index("players_saves").on(t.sport, t.saves.desc()),
    check("players_sport", sql`${t.sport} ${SPORT_CHECK}`),
    check(
      "players_overall_range",
      sql`${t.overall} between 1 and 99 and ${t.potential} between 1 and 99`,
    ),
    check(
      "players_potential_range",
      sql`${t.potentialLow} <= ${t.potentialHigh} and ${t.potentialHigh} <= 99`,
    ),
    check("players_age_range", sql`${t.age} between 14 and 50`),
    check("players_worth_nonnegative", sql`${t.worth} >= 0`),
    check(
      "players_condition",
      sql`${t.fitness} between 0 and 100 and ${t.injuredWeeks} >= 0 and ${t.suspendedWeeks} >= 0 and ${t.yellowCards} >= 0 and ${t.form} between -1 and 1`,
    ),
    pgPolicy("players_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`exists (select 1 from public.teams tm where tm.id = ${t.teamId} and tm.owner_id = ${authUid})`,
    }),
  ],
).enableRLS();

/**
 * Packs a team owns (D47, D83). The contents come from `seed`, so opening a
 * pack always shows the same 5 players. `kept` records which of them (by
 * index 0–4) the manager kept once the pack is resolved.
 */
export const packs = pgTable(
  "packs",
  {
    id: uuid().primaryKey().defaultRandom(),
    teamId: uuid()
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    sport: text().notNull(),
    kind: text().notNull(),
    focus: text().notNull(),
    tier: text().notNull(),
    seed: text().notNull(),
    /** Overall points the odds moved with the club's Elo when bought (D179). */
    eloShift: integer().notNull().default(0),
    /** Chemistry colors left out of the pack (D180). */
    excludedColors: integer().array().notNull().default(sql`'{}'::integer[]`),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    openedAt: timestamp({ withTimezone: true }),
    resolvedAt: timestamp({ withTimezone: true }),
    kept: jsonb(),
  },
  (t) => [
    index("packs_team").on(t.teamId),
    check("packs_sport", sql`${t.sport} ${SPORT_CHECK}`),
    check("packs_kind", sql`${t.kind} in ('starter', 'bought', 'reward')`),
    check(
      "packs_choice",
      sql`${t.eloShift} between -10 and 15 and cardinality(${t.excludedColors}) <= 3`,
    ),
    check(
      "packs_focus",
      sql`${t.focus} in ('attack', 'midfield', 'defence', 'goal', 'any')`,
    ),
    check(
      "packs_resolved_after_opened",
      sql`${t.resolvedAt} is null or (${t.openedAt} is not null and ${t.resolvedAt} >= ${t.openedAt})`,
    ),
    pgPolicy("packs_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`exists (select 1 from public.teams tm where tm.id = ${t.teamId} and tm.owner_id = ${authUid})`,
    }),
  ],
).enableRLS();

/**
 * Each team's saved matchday squad (D15, D88): a formation, the 11 starters
 * by slot, the bench and a sub plan, all as player ids. The server checks it
 * with the engine before saving; a player leaving the team makes it invalid
 * until the manager fixes it.
 */
export const matchdaySquads = pgTable(
  "matchday_squads",
  {
    teamId: uuid()
      .primaryKey()
      .references(() => teams.id, { onDelete: "cascade" }),
    formation: text().notNull(),
    lineup: jsonb().notNull(),
    bench: jsonb().notNull(),
    subPlan: jsonb().notNull().default([]),
    /**
     * The formation this squad was moved off because an admin turned it off
     * (D140), until the manager saves the squad again.
     */
    movedFrom: text(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    pgPolicy("matchday_squads_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`exists (select 1 from public.teams tm where tm.id = ${t.teamId} and tm.owner_id = ${authUid})`,
    }),
  ],
).enableRLS();

/**
 * A team's seasons (D16, D18). One unfinished season per team at a time.
 * `seed` decides every AI squad and match, so managers can't read it
 * (knowing it would let them test lineups against the real results).
 */
export const seasons = pgTable(
  "seasons",
  {
    id: uuid().primaryKey().defaultRandom(),
    teamId: uuid()
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    sport: text().notNull(),
    number: integer().notNull(),
    status: text().notNull().default("regular"),
    /** The next week to play (or the last one, once finished). */
    week: integer().notNull().default(1),
    seed: text().notNull(),
    startElo: integer().notNull(),
    /** Game settings version the matches use, e.g. "soccer:3" or "defaults". */
    configVersion: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp({ withTimezone: true }),
    /** Season end applied: players aged, retirements made (D35). */
    closedAt: timestamp({ withTimezone: true }),
    /** What season end did, for the manager: retirements and rating changes. */
    review: jsonb(),
    /** Youth intake answered (D53): which prospects (by index) were taken. */
    intakeTaken: jsonb(),
    intakeResolvedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    uniqueIndex("seasons_team_number").on(t.teamId, t.number),
    uniqueIndex("seasons_one_active")
      .on(t.teamId)
      .where(sql`${t.status} <> 'finished'`),
    check("seasons_sport", sql`${t.sport} ${SPORT_CHECK}`),
    check(
      "seasons_status",
      sql`${t.status} in ('regular', 'playoffs', 'finished')`,
    ),
    pgPolicy("seasons_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`exists (select 1 from public.teams tm where tm.id = ${t.teamId} and tm.owner_id = ${authUid})`,
    }),
  ],
).enableRLS();

/**
 * One line per club per season, kept forever (D120): the season's leaderboard
 * entry and the club's history. Written when the season is closed. Only the
 * server reads it; pages show the public fields.
 */
export const seasonRecords = pgTable(
  "season_records",
  {
    id: uuid().primaryKey().defaultRandom(),
    teamId: uuid()
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    seasonId: uuid().references(() => seasons.id, { onDelete: "set null" }),
    sport: text().notNull(),
    seasonNumber: integer().notNull(),
    /** The club's name and colors that season. */
    teamName: text().notNull(),
    colors: text().array().notNull().default(sql`'{}'::text[]`),
    eloBefore: integer().notNull(),
    eloAfter: integer().notNull(),
    position: integer().notNull(),
    played: integer().notNull(),
    won: integer().notNull(),
    drawn: integer().notNull(),
    lost: integer().notNull(),
    scored: integer().notNull(),
    conceded: integer().notNull(),
    points: integer().notNull(),
    /** How far the club got in the playoffs. */
    playoffs: text().notNull(),
    completedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("season_records_season").on(t.seasonId),
    index("season_records_sport_elo").on(t.sport, t.eloAfter),
    index("season_records_team").on(t.teamId),
    check("season_records_sport", sql`${t.sport} ${SPORT_CHECK}`),
    check(
      "season_records_playoffs",
      sql`${t.playoffs} in ('none', 'quarter', 'semi', 'final', 'champion')`,
    ),
  ],
).enableRLS();

/** A retired player's career, kept forever (D120). */
export const playerCareers = pgTable(
  "player_careers",
  {
    id: uuid().primaryKey().defaultRandom(),
    teamId: uuid()
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    sport: text().notNull(),
    firstName: text().notNull(),
    lastName: text().notNull(),
    displayName: text().notNull(),
    nationality: text().notNull(),
    primaryPosition: text().notNull(),
    retiredAge: integer().notNull(),
    seasons: integer().notNull(),
    appearances: integer().notNull(),
    goals: integer().notNull(),
    /** Totals added by D143; zero for careers that ended before. */
    statGames: integer().notNull().default(0),
    statGoals: integer().notNull().default(0),
    wins: integer().notNull().default(0),
    draws: integer().notNull().default(0),
    losses: integer().notNull().default(0),
    assists: integer().notNull().default(0),
    tackles: integer().notNull().default(0),
    /** Career stats by key (ADR 0007 §2); kept in step as on `players`. */
    stats: jsonb().notNull().default({}),
    saves: integer().notNull().default(0),
    bestOverall: integer().notNull(),
    /** Clubs played for, as named when the player retired. */
    clubs: text().array().notNull(),
    retiredSeason: integer().notNull(),
    retiredAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("player_careers_team").on(t.teamId),
    // The hall of fame's all-time lists (ADR 0005).
    index("player_careers_stat_games").on(t.sport, t.statGames.desc()),
    index("player_careers_stat_goals").on(t.sport, t.statGoals.desc()),
    index("player_careers_assists").on(t.sport, t.assists.desc()),
    index("player_careers_tackles").on(t.sport, t.tackles.desc()),
    index("player_careers_saves").on(t.sport, t.saves.desc()),
    check("player_careers_sport", sql`${t.sport} ${SPORT_CHECK}`),
  ],
).enableRLS();

/**
 * Each real club's ghost (D116): the club frozen as it finished its best
 * season by Elo, before ageing. Replaced at season end only when the club
 * finishes with a higher Elo. Leagues copy it when they start (D115), so a
 * newer best season never changes a league already under way. Rosters stay
 * server-side.
 */
export const ghosts = pgTable(
  "ghosts",
  {
    teamId: uuid()
      .primaryKey()
      .references(() => teams.id, { onDelete: "cascade" }),
    seasonId: uuid().references(() => seasons.id, { onDelete: "set null" }),
    sport: text().notNull(),
    teamName: text().notNull(),
    seasonNumber: integer().notNull(),
    elo: integer().notNull(),
    /** Players as the match engine needs them (no hidden potential). */
    players: jsonb().notNull(),
    squad: jsonb().notNull(),
    gameVersion: text().notNull(),
    frozenAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("ghosts_sport_elo").on(t.sport, t.elo),
    check("ghosts_sport", sql`${t.sport} ${SPORT_CHECK}`),
  ],
).enableRLS();

/** The teams in a season's league, by slot (0 = the manager's team). */
export const seasonTeams = pgTable(
  "season_teams",
  {
    seasonId: uuid()
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    slot: integer().notNull(),
    kind: text().notNull(),
    name: text().notNull(),
    startRating: integer().notNull(),
    elo: integer().notNull(),
    /** The copied club's colors (D107), so the league shows them. */
    colors: text().array().notNull().default(sql`'{}'::text[]`),
    /** The club this place copies (D115): an AI club, or a real club's ghost. */
    sourceTeamId: uuid().references(() => teams.id, { onDelete: "set null" }),
    /**
     * The copy it plays as, frozen for the season (D115): players (no hidden
     * potential) and matchday squad. Cleared once the season's replays go
     * (D120); without it the place plays as an AI club.
     */
    clone: jsonb(),
  },
  (t) => [
    primaryKey({ columns: [t.seasonId, t.slot] }),
    check("season_teams_kind", sql`${t.kind} in ('manager', 'ai', 'ghost')`),
    pgPolicy("season_teams_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`exists (select 1 from public.seasons s join public.teams tm on tm.id = s.team_id where s.id = ${t.seasonId} and tm.owner_id = ${authUid})`,
    }),
  ],
).enableRLS();

/** A season's matches: league weeks, then the playoffs: a play-in and an 8-club bracket (D117), or semi-finals and a final in 8-team seasons from before (D30). */
export const fixtures = pgTable(
  "fixtures",
  {
    id: uuid().primaryKey().defaultRandom(),
    seasonId: uuid()
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    week: integer().notNull(),
    stage: text().notNull(),
    homeSlot: integer().notNull(),
    awaySlot: integer().notNull(),
    homeScore: integer(),
    awayScore: integer(),
    /** Knockout winner; null for league matches. */
    winner: text(),
    /** Possession, shots and key events with player names. */
    summary: jsonb(),
    /**
     * The manager's team as it played this match (lineup, bench, sub plan,
     * fitness, form and morale) and its players' names, so the match can be
     * replayed from its seed (M5). Null for matches the manager wasn't in.
     */
    managerTeam: jsonb(),
    playedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("fixtures_season_week").on(t.seasonId, t.week),
    check(
      "fixtures_stage",
      sql`${t.stage} in ('league', 'play_in', 'quarter', 'semi', 'final')`,
    ),
    check(
      "fixtures_winner",
      sql`${t.winner} is null or ${t.winner} in ('home', 'away')`,
    ),
    check("fixtures_two_teams", sql`${t.homeSlot} <> ${t.awaySlot}`),
    pgPolicy("fixtures_select_own", {
      for: "select",
      to: authenticatedRole,
      using: sql`exists (select 1 from public.seasons s join public.teams tm on tm.id = s.team_id where s.id = ${t.seasonId} and tm.owner_id = ${authUid})`,
    }),
  ],
).enableRLS();

/**
 * Live per-sport switches (D93), changed by admins without publishing a new
 * settings version: energy on or off, its refill time and its maximum.
 */
export const sportSettings = pgTable(
  "sport_settings",
  {
    sport: text().primaryKey(),
    energyEnabled: boolean().notNull().default(true),
    energyRefillMinutes: integer().notNull().default(15),
    energyMax: integer().notNull().default(6),
    /** Roster limits (D182): the fewest and most players, and the bench size. */
    rosterMin: integer().notNull().default(11),
    rosterMax: integer().notNull().default(33),
    benchMax: integer().notNull().default(11),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("sport_settings_sport", sql`${t.sport} ${SPORT_CHECK}`),
    check(
      "sport_settings_roster",
      sql`${t.rosterMin} between 11 and 30 and ${t.rosterMax} between 22 and 50 and ${t.rosterMin} <= ${t.rosterMax} and ${t.benchMax} between 0 and 11`,
    ),
    check(
      "sport_settings_energy",
      sql`${t.energyRefillMinutes} between 1 and 1440 and ${t.energyMax} between 1 and 20`,
    ),
    pgPolicy("sport_settings_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),
    pgPolicy("sport_settings_update_admin", {
      for: "update",
      to: authenticatedRole,
      using: isAdmin,
      withCheck: isAdmin,
    }),
  ],
).enableRLS();

/**
 * Formations (D140): the built-in presets (defined in code, so `slots` is
 * null) and those admins create. Admins turn any of them on or off for
 * every club. A formation's slots can't change once it exists and it can't
 * be deleted, so every match that used one still replays the same.
 * Everyone signed in can read them; only the server writes.
 */
export const formations = pgTable(
  "formations",
  {
    sport: text().notNull(),
    id: text().notNull(),
    /** [{position, x, y}], keeper first; null for built-in presets. */
    slots: jsonb(),
    builtIn: boolean().notNull().default(false),
    enabled: boolean().notNull().default(true),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.sport, t.id] }),
    check("formations_sport", sql`${t.sport} ${SPORT_CHECK}`),
    check(
      "formations_id",
      sql`${t.id} ~ '^[0-9]([0-9-]*[0-9])?[a-z]{0,2}$' and length(${t.id}) <= 16`,
    ),
    check(
      "formations_slots",
      sql`(${t.builtIn} and ${t.slots} is null) or (not ${t.builtIn} and jsonb_typeof(${t.slots}) = 'array' and jsonb_array_length(${t.slots}) = 11)`,
    ),
    pgPolicy("formations_select", {
      for: "select",
      to: authenticatedRole,
      using: sql`true`,
    }),
  ],
).enableRLS();

/**
 * The AI world's switches (D113, D114), per sport: how many AI clubs to
 * keep and whether scheduled runs play them. Only the server reads it.
 */
export const aiSettings = pgTable(
  "ai_settings",
  {
    sport: text().primaryKey(),
    /** Scheduled runs play AI clubs only when this is on. */
    enabled: boolean().notNull().default(false),
    /** AI clubs to keep; runs add clubs up to this. */
    poolSize: integer().notNull().default(250),
    /** Scheduled runs a day, for working out each club's weeks per run. */
    runsPerDay: integer().notNull().default(12),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("ai_settings_sport", sql`${t.sport} ${SPORT_CHECK}`),
    check(
      "ai_settings_limits",
      sql`${t.poolSize} between 0 and 1000 and ${t.runsPerDay} between 1 and 48`,
    ),
  ],
).enableRLS();

/**
 * Each scheduled AI run (D114): what it did, for the admin page and for
 * spotting failures. Only the server reads it; kept for two weeks.
 */
export const aiRuns = pgTable(
  "ai_runs",
  {
    id: uuid().primaryKey().defaultRandom(),
    sport: text().notNull(),
    startedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    finishedAt: timestamp({ withTimezone: true }),
    /** AI clubs at the start, and how many were added to reach the pool size. */
    clubs: integer().notNull().default(0),
    created: integer().notNull().default(0),
    /** Clubs that had their turn, and those left for the next run. */
    ran: integer().notNull().default(0),
    skipped: integer().notNull().default(0),
    weeksPlayed: integer().notNull().default(0),
    /** Problems by club, at most a few dozen. */
    errors: jsonb().notNull().default([]),
  },
  (t) => [
    index("ai_runs_started").on(t.startedAt),
    check("ai_runs_sport", sql`${t.sport} ${SPORT_CHECK}`),
  ],
).enableRLS();

/**
 * Every admin testing action (refill energy, add funds, play ahead, ...),
 * so test boosts stay visible. Written by the server; admins can read it.
 */
export const adminActions = pgTable(
  "admin_actions",
  {
    id: uuid().primaryKey().defaultRandom(),
    adminId: uuid().references(() => authUsers.id, { onDelete: "set null" }),
    /** The team acted on; kept as text so the log survives the team's deletion. */
    teamId: uuid(),
    teamName: text().notNull(),
    action: text().notNull(),
    details: jsonb().notNull().default({}),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("admin_actions_created").on(t.createdAt),
    pgPolicy("admin_actions_select_admin", {
      for: "select",
      to: authenticatedRole,
      using: isAdmin,
    }),
  ],
).enableRLS();

export type Team = typeof teams.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Pack = typeof packs.$inferSelect;
export type MatchdaySquadRow = typeof matchdaySquads.$inferSelect;
