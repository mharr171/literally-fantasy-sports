import {
  type BalanceSettings,
  balanceFromValues,
  DEFAULT_BALANCE,
  DEFAULT_GENERATION_SETTINGS,
  defaultSoccerConfig,
  type GenerationSettings,
  type GhostCandidate,
  generationSettingsFromValues,
  ghostTeam,
  type LeagueSlot,
  type MatchdaySquad,
  type MatchSummary,
  type SeasonFixture,
  type SeasonStats,
  type SeasonStatus,
  type SnapshotPlayer,
  type SoccerConfig,
  type SoccerTeam,
  type Stage,
  snapshotTeam,
  soccerConfigFromValues,
} from "@lfs/sport-soccer";
import { createServiceClient } from "./db";
import { SOCCER } from "./team";

/** What season end did (stored on the season, shown to the manager). */
export interface SeasonReview {
  retired: { name: string; position: string; age: number; overall: number }[];
  changes: {
    name: string;
    position: string;
    age: number;
    from: number;
    to: number;
  }[];
}

export interface LoadedSeason {
  id: string;
  number: number;
  status: SeasonStatus;
  week: number;
  /** Server only: decides every match. Never send it to the browser. */
  seed: string;
  configVersion: string;
  closed: boolean;
  review: SeasonReview | null;
  intakeResolved: boolean;
  slots: (LeagueSlot & { elo: number; colors: string[] })[];
  fixtures: (SeasonFixture & { summary: MatchSummary | null })[];
}

/** The team's latest season (in progress or finished), or null. */
export async function loadLatestSeason(
  teamId: string,
): Promise<LoadedSeason | null> {
  const db = createServiceClient();
  const { data: season, error } = await db
    .from("seasons")
    .select(
      "id, number, status, week, seed, config_version, closed_at, review, intake_resolved_at",
    )
    .eq("team_id", teamId)
    .order("number", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!season) return null;
  const [slots, fixtures] = await Promise.all([
    db
      .from("season_teams")
      .select("slot, kind, name, start_rating, elo, source_team_id, colors")
      .eq("season_id", season.id)
      .order("slot"),
    db
      .from("fixtures")
      .select(
        "id, week, stage, home_slot, away_slot, home_score, away_score, winner, summary",
      )
      .eq("season_id", season.id)
      .order("week")
      .order("id"),
  ]);
  if (slots.error) throw new Error(slots.error.message);
  if (fixtures.error) throw new Error(fixtures.error.message);
  return {
    id: season.id,
    number: season.number,
    status: season.status as SeasonStatus,
    week: season.week,
    seed: season.seed,
    configVersion: season.config_version,
    closed: season.closed_at !== null,
    review: season.review as SeasonReview | null,
    intakeResolved: season.intake_resolved_at !== null,
    slots: (slots.data ?? []).map((s) => ({
      slot: s.slot,
      kind: s.kind as LeagueSlot["kind"],
      name: s.name,
      startRating: s.start_rating,
      elo: s.elo,
      ghostId: s.source_team_id as string | null,
      colors: (s.colors as string[] | null) ?? [],
    })),
    fixtures: (fixtures.data ?? []).map((f) => ({
      id: f.id,
      week: f.week,
      stage: f.stage as Stage,
      homeSlot: f.home_slot,
      awaySlot: f.away_slot,
      homeScore: f.home_score,
      awayScore: f.away_score,
      winner: f.winner as SeasonFixture["winner"],
      summary: f.summary as MatchSummary | null,
    })),
  };
}

/** A settings version as the game uses it: match config and balance (M5). */
export interface LoadedConfig {
  label: string;
  config: SoccerConfig;
  balance: BalanceSettings;
}

/** The live soccer settings and their label, e.g. "soccer:3", or the defaults. */
export async function liveSoccerConfig(): Promise<LoadedConfig> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("game_config_versions")
    .select("version")
    .eq("scope", SOCCER)
    .not("published_at", "is", null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data)
    return {
      label: "defaults",
      config: defaultSoccerConfig(),
      balance: DEFAULT_BALANCE,
    };
  return configFor(`soccer:${data.version}`);
}

/** The settings a season was started with, so every week plays the same way. */
export async function configFor(label: string): Promise<LoadedConfig> {
  if (label === "defaults")
    return { label, config: defaultSoccerConfig(), balance: DEFAULT_BALANCE };
  const version = Number(label.split(":")[1]);
  const { data, error } = await createServiceClient()
    .from("game_config")
    .select("key, value")
    .eq("scope", SOCCER)
    .eq("version", version);
  if (error) throw new Error(error.message);
  const values = Object.fromEntries(
    (data ?? []).map((r) => [r.key as string, r.value]),
  );
  return {
    label,
    config: soccerConfigFromValues(label, values),
    balance: balanceFromValues(values),
  };
}

/**
 * Clubs that could join a new league (D115): AI clubs as they are now and
 * other real clubs' best ghosts (D116), the nearest few above and below
 * this Elo of each. A club is never its own candidate.
 */
export async function loadLeagueCandidates(
  elo: number,
  excludeTeamId: string,
  each = 11,
): Promise<GhostCandidate[]> {
  const db = createServiceClient();
  const ai = (above: boolean) => {
    const q = db
      .from("teams")
      .select("id, name, elo")
      .eq("sport", SOCCER)
      .eq("kind", "ai")
      .neq("id", excludeTeamId);
    return (above ? q.gte("elo", elo) : q.lt("elo", elo))
      .order("elo", { ascending: above })
      .limit(each);
  };
  const ghost = (above: boolean) => {
    const q = db
      .from("ghosts")
      .select("team_id, team_name, elo")
      .eq("sport", SOCCER)
      .neq("team_id", excludeTeamId);
    return (above ? q.gte("elo", elo) : q.lt("elo", elo))
      .order("elo", { ascending: above })
      .limit(each);
  };
  const results = await Promise.all([
    ai(true),
    ai(false),
    ghost(true),
    ghost(false),
  ]);
  for (const r of results) if (r.error) throw new Error(r.error.message);
  const [aiUp, aiDown, ghostUp, ghostDown] = results;
  const clubs = [...(aiUp?.data ?? []), ...(aiDown?.data ?? [])].map((t) => ({
    id: t.id as string,
    teamId: t.id as string,
    name: t.name as string,
    elo: t.elo as number,
  }));
  const ghosts = [...(ghostUp?.data ?? []), ...(ghostDown?.data ?? [])].map(
    (g) => ({
      id: g.team_id as string,
      teamId: g.team_id as string,
      name: g.team_name as string,
      elo: g.elo as number,
    }),
  );
  return [...clubs, ...ghosts];
}

/** The copy of a club a league plays against: players and matchday squad (D115). */
export interface ClubClone {
  players: SnapshotPlayer[];
  squad: MatchdaySquad;
}

/** A season's league copies of other clubs, by slot. */
export async function loadClones(
  seasonId: string,
): Promise<Map<number, ClubClone>> {
  const { data, error } = await createServiceClient()
    .from("season_teams")
    .select("slot, clone")
    .eq("season_id", seasonId)
    .not("clone", "is", null);
  if (error) throw new Error(error.message);
  return new Map(
    (data ?? []).map((r) => [r.slot as number, r.clone as ClubClone]),
  );
}

/** The ghosts in a season, by slot, as the engine plays them. */
export async function loadGhostTeams(
  seasonId: string,
): Promise<Map<number, ReturnType<typeof ghostTeam>>> {
  const result = new Map<number, ReturnType<typeof ghostTeam>>();
  // A copy's saved squad is checked again; if it no longer works, the best
  // 22 play (as when a ghost is frozen).
  for (const [slot, clone] of await loadClones(seasonId))
    result.set(
      slot,
      ghostTeam(`ghost-${slot}`, snapshotTeam(clone.players, clone.squad)),
    );
  return result;
}

export interface LeaderboardEntry {
  id: string;
  teamId: string;
  teamName: string;
  seasonNumber: number;
  elo: number;
  stats: SeasonStats;
  completedAt: string;
  /** The club's colors that season (D107), else its current ones. */
  colors: string[];
  /** The club whose ghost is this season, for its roster link (D116). */
  ghostTeamId: string | null;
}

/**
 * The soccer leaderboard (D19): finished seasons ranked by Elo, then by
 * that season's points, goal difference and goals. Read from the season
 * records kept forever (D120).
 */
export async function loadLeaderboard(
  limit = 100,
): Promise<LeaderboardEntry[]> {
  const { data, error } = await createServiceClient()
    .from("season_records")
    .select(
      "id, team_id, season_id, team_name, season_number, elo_after, position, played, won, drawn, lost, scored, conceded, points, playoffs, colors, completed_at",
    )
    .eq("sport", SOCCER)
    .order("elo_after", { ascending: false })
    .limit(limit * 3);
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  // Seasons that are their club's ghost link to its roster (D116).
  const ghostSeasons = new Set<string>();
  const teamIds = [...new Set(rows.map((r) => r.team_id as string))];
  if (teamIds.length > 0) {
    const { data: ghosts, error: ghostsError } = await createServiceClient()
      .from("ghosts")
      .select("season_id")
      .in("team_id", teamIds);
    if (ghostsError) throw new Error(ghostsError.message);
    for (const g of ghosts ?? [])
      if (g.season_id) ghostSeasons.add(g.season_id as string);
  }
  const missing = [
    ...new Set(
      rows
        .filter((r) => ((r.colors as string[] | null) ?? []).length === 0)
        .map((r) => r.team_id as string),
    ),
  ];
  const current = new Map<string, string[]>();
  if (missing.length > 0) {
    const { data: teams, error: teamsError } = await createServiceClient()
      .from("teams")
      .select("id, colors")
      .in("id", missing);
    if (teamsError) throw new Error(teamsError.message);
    for (const t of teams ?? [])
      current.set(t.id as string, (t.colors as string[] | null) ?? []);
  }
  return rows
    .map((r) => {
      const colors = (r.colors as string[] | null) ?? [];
      return {
        id: r.id as string,
        teamId: r.team_id as string,
        teamName: r.team_name as string,
        seasonNumber: r.season_number as number,
        elo: r.elo_after as number,
        stats: {
          position: r.position as number,
          played: r.played as number,
          won: r.won as number,
          drawn: r.drawn as number,
          lost: r.lost as number,
          scored: r.scored as number,
          conceded: r.conceded as number,
          points: r.points as number,
          playoffs: r.playoffs as SeasonStats["playoffs"],
        },
        completedAt: r.completed_at as string,
        colors:
          colors.length > 0 ? colors : (current.get(r.team_id as string) ?? []),
        ghostTeamId: ghostSeasons.has(r.season_id as string)
          ? (r.team_id as string)
          : null,
      };
    })
    .sort(
      (a, b) =>
        b.elo - a.elo ||
        b.stats.points - a.stats.points ||
        b.stats.scored -
          b.stats.conceded -
          (a.stats.scored - a.stats.conceded) ||
        b.stats.scored - a.stats.scored,
    )
    .slice(0, limit);
}

/** Settings for generating new players: the live version's enabled template variants (D84). */
export async function liveGenerationSettings(): Promise<GenerationSettings> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("game_config_versions")
    .select("version")
    .eq("scope", SOCCER)
    .not("published_at", "is", null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return DEFAULT_GENERATION_SETTINGS;
  const { data: rows, error: rowsError } = await db
    .from("game_config")
    .select("key, value")
    .eq("scope", SOCCER)
    .eq("version", data.version)
    .like("key", "variants.%");
  if (rowsError) throw new Error(rowsError.message);
  return generationSettingsFromValues(
    Object.fromEntries((rows ?? []).map((r) => [r.key as string, r.value])),
  );
}

/** The manager's team as it played a match, kept with the result (M5). */
export interface StoredManagerTeam {
  team: SoccerTeam;
  /** Names of everyone in the matchday squad, by player id. */
  names: Record<string, string>;
}

/** Everyone in a team's matchday squad: starters and bench. */
export function playedIds(team: SoccerTeam): string[] {
  return [
    ...team.lineup.map((s) => s.player.id),
    ...(team.bench ?? []).map((p) => p.id),
  ];
}

/** One of the team's matches with what it takes to replay it, or null. */
export async function loadMatch(teamId: string, fixtureId: string) {
  const db = createServiceClient();
  const { data: fixture, error } = await db
    .from("fixtures")
    .select(
      "id, season_id, week, stage, home_slot, away_slot, home_score, away_score, winner, summary, manager_team",
    )
    .eq("id", fixtureId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!fixture || fixture.home_score === null) return null;
  const { data: season, error: seasonError } = await db
    .from("seasons")
    .select("id, number, seed, config_version, team_id")
    .eq("id", fixture.season_id)
    .maybeSingle();
  if (seasonError) throw new Error(seasonError.message);
  // Only the team's own seasons: a manager can't open another's matches.
  if (!season || season.team_id !== teamId) return null;
  const { data: slots, error: slotsError } = await db
    .from("season_teams")
    .select("slot, kind, name, start_rating, source_team_id")
    .eq("season_id", season.id)
    .order("slot");
  if (slotsError) throw new Error(slotsError.message);
  return {
    seasonId: season.id as string,
    seasonNumber: season.number as number,
    /** Server only: never send it to the browser. */
    seed: season.seed as string,
    configVersion: season.config_version as string,
    slots: (slots ?? []).map((s) => ({
      slot: s.slot as number,
      kind: s.kind as LeagueSlot["kind"],
      name: s.name as string,
      startRating: s.start_rating as number,
      ghostId: s.source_team_id as string | null,
    })),
    fixture: {
      id: fixture.id as string,
      week: fixture.week as number,
      stage: fixture.stage as Stage,
      homeSlot: fixture.home_slot as number,
      awaySlot: fixture.away_slot as number,
      homeScore: fixture.home_score as number,
      awayScore: fixture.away_score as number,
      winner: fixture.winner as SeasonFixture["winner"],
      summary: fixture.summary as MatchSummary | null,
    },
    managerTeam: fixture.manager_team as StoredManagerTeam | null,
  };
}

/**
 * The out-of-position penalty the club plays by now (D135): its season's
 * settings while one is under way, else the live settings.
 */
export async function currentOutOfPosition(teamId: string): Promise<number> {
  const season = await loadLatestSeason(teamId);
  const { config } =
    season && season.status !== "finished"
      ? await configFor(season.configVersion)
      : await liveSoccerConfig();
  return config.tuning.outOfPosition;
}
