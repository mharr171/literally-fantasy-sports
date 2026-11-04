import "server-only";
import {
  defaultSoccerConfig,
  type LeagueSlot,
  type MatchSummary,
  type SeasonFixture,
  type SeasonStatus,
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
      .select("slot, kind, name, start_rating, elo")
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
