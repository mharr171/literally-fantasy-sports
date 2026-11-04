import "server-only";
import {
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
  type Stage,
  soccerConfigFromValues,
} from "@lfs/sport-soccer";
import { createServiceClient } from "./supabase/service";
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
  slots: (LeagueSlot & { elo: number })[];
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
      .select("slot, kind, name, start_rating, elo, snapshot_id")
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
      ghostId: s.snapshot_id as string | null,
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

/** The live soccer settings and their label, e.g. "soccer:3", or the defaults. */
export async function liveSoccerConfig(): Promise<{
  label: string;
  config: SoccerConfig;
}> {
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
  if (!data) return { label: "defaults", config: defaultSoccerConfig() };
  return configFor(`soccer:${data.version}`);
}

/** The settings a season was started with, so every week plays the same way. */
export async function configFor(
  label: string,
): Promise<{ label: string; config: SoccerConfig }> {
  if (label === "defaults") return { label, config: defaultSoccerConfig() };
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
  return { label, config: soccerConfigFromValues(label, values) };
}

/** Ghosts that could join a new league: the latest snapshot of each team near this Elo. */
export async function loadGhostCandidates(
  elo: number,
  window: number,
): Promise<GhostCandidate[]> {
  const { data, error } = await createServiceClient()
    .from("team_snapshots")
    .select("id, team_id, team_name, elo")
    .eq("sport", SOCCER)
    .gte("elo", elo - window)
    .lte("elo", elo + window)
    .order("completed_at", { ascending: false })
    .limit(300);
  if (error) throw new Error(error.message);
  const latest = new Map<string, GhostCandidate>();
  for (const s of data ?? [])
    if (!latest.has(s.team_id))
      latest.set(s.team_id, {
        id: s.id,
        teamId: s.team_id,
        name: s.team_name,
        elo: s.elo,
      });
  return [...latest.values()];
}

/** The rosters of the ghosts in a season, by slot. */
export async function loadGhostTeams(
  slots: readonly LeagueSlot[],
): Promise<Map<number, ReturnType<typeof ghostTeam>>> {
  const wanted = slots.filter((s) => s.kind === "ghost" && s.ghostId);
  const result = new Map<number, ReturnType<typeof ghostTeam>>();
  if (wanted.length === 0) return result;
  const { data, error } = await createServiceClient()
    .from("team_snapshots")
    .select("id, players, squad")
    .in(
      "id",
      wanted.map((s) => s.ghostId as string),
    );
  if (error) throw new Error(error.message);
  for (const slot of wanted) {
    const snap = (data ?? []).find((d) => d.id === slot.ghostId);
    if (snap)
      result.set(
        slot.slot,
        ghostTeam(`ghost-${slot.slot}`, {
          players: snap.players as SnapshotPlayer[],
          squad: snap.squad as MatchdaySquad,
        }),
      );
  }
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
}

/**
 * The soccer leaderboard (D19): finished seasons ranked by Elo, then by
 * that season's points, goal difference and goals.
 */
export async function loadLeaderboard(
  limit = 100,
): Promise<LeaderboardEntry[]> {
  const { data, error } = await createServiceClient()
    .from("team_snapshots")
    .select("id, team_id, team_name, season_number, elo, stats, completed_at")
    .eq("sport", SOCCER)
    .order("elo", { ascending: false })
    .limit(limit * 3);
  if (error) throw new Error(error.message);
  return (data ?? [])
    .map((s) => ({
      id: s.id as string,
      teamId: s.team_id as string,
      teamName: s.team_name as string,
      seasonNumber: s.season_number as number,
      elo: s.elo as number,
      stats: s.stats as SeasonStats,
      completedAt: s.completed_at as string,
    }))
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
