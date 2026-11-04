import { sql } from "drizzle-orm";
import {
  boolean,
  check,
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
    ownerId: uuid()
      .notNull()
      .references(() => authUsers.id, { onDelete: "cascade" }),
    sport: text().notNull(),
    name: text().notNull(),
    elo: integer().notNull().default(1500),
    /** Starting funds let a new team buy its first packs (balance default, Gary OKs). */
    funds: integer().notNull().default(10_000),
    energy: integer().notNull().default(3),
    energyUpdatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
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
    /** Came from a free starter pack: can be released but not resold (D83). */
    fromStarterPack: boolean().notNull().default(false),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("players_team").on(t.teamId),
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
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    openedAt: timestamp({ withTimezone: true }),
    resolvedAt: timestamp({ withTimezone: true }),
    kept: jsonb(),
  },
  (t) => [
    index("packs_team").on(t.teamId),
    check("packs_sport", sql`${t.sport} ${SPORT_CHECK}`),
    check("packs_kind", sql`${t.kind} in ('starter', 'bought')`),
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
 * A team frozen at the end of a season (D19, D59): plays as a ghost in other
 * managers' leagues and is the season's leaderboard entry. Rosters stay
 * server-side; the leaderboard is rendered on the server from the public
 * fields.
 */
export const teamSnapshots = pgTable(
  "team_snapshots",
  {
    id: uuid().primaryKey().defaultRandom(),
    teamId: uuid()
      .notNull()
      .references(() => teams.id, { onDelete: "cascade" }),
    seasonId: uuid()
      .notNull()
      .references(() => seasons.id, { onDelete: "cascade" }),
    sport: text().notNull(),
    teamName: text().notNull(),
    seasonNumber: integer().notNull(),
    elo: integer().notNull(),
    /** Players as the match engine needs them (no hidden potential). */
    players: jsonb().notNull(),
    squad: jsonb().notNull(),
    /** League record and playoff result. */
    stats: jsonb().notNull(),
    gameVersion: text().notNull(),
    completedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("team_snapshots_season").on(t.seasonId),
    index("team_snapshots_sport_elo").on(t.sport, t.elo),
    check("team_snapshots_sport", sql`${t.sport} ${SPORT_CHECK}`),
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
    /** For a ghost: the snapshot it plays as. If the snapshot goes, it plays as an AI club. */
    snapshotId: uuid().references(() => teamSnapshots.id, {
      onDelete: "set null",
    }),
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

/** A season's matches: league weeks, then playoff semi-finals and a final (D30). */
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
    playedAt: timestamp({ withTimezone: true }),
  },
  (t) => [
    index("fixtures_season_week").on(t.seasonId, t.week),
    check("fixtures_stage", sql`${t.stage} in ('league', 'semi', 'final')`),
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
    energyMax: integer().notNull().default(3),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check("sport_settings_sport", sql`${t.sport} ${SPORT_CHECK}`),
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

export type Team = typeof teams.$inferSelect;
export type Player = typeof players.$inferSelect;
export type Pack = typeof packs.$inferSelect;
export type MatchdaySquadRow = typeof matchdaySquads.$inferSelect;
