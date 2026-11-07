/**
 * A baseball player's page (ADR 0009 §9, D201): what a manager sees of
 * his own player (never the true potential), his charts from his presets,
 * and the pitches and batted balls from his last 5 games, replayed from
 * the club's stored games.
 */
import { baseballConfigFor } from "./baseball-squad";
import { createServiceClient } from "./db";
import {
  type Attributes,
  type BaseballTeam,
  type BatterPosition,
  baseballGameSeed,
  batterSpray,
  batterZoneGrid,
  battingRating,
  type ChartBattedBall,
  type ChartPitch,
  fieldingRating,
  type LocationPreset,
  overallAt,
  type Position,
  pitcherLocationGrid,
  playerChartEvents,
  replayGame,
  type SprayPreset,
  type ZonePreset,
} from "./sports/baseball";
import type { BaseballTraits } from "./sports/baseball-players";

/** How many recent games the charts replay. */
export const CHART_GAMES = 5;

export interface BaseballPlayerPage {
  id: string;
  displayName: string;
  nationality: string;
  age: number;
  primaryPosition: Position;
  secondaryPosition: BatterPosition | null;
  overall: number;
  potentialRange: [number, number];
  worth: number;
  chemistryColor: number;
  traits: Partial<BaseballTraits>;
  attributes: Attributes;
  /** Bat and Field at his position (D212); SP and RP ratings for a pitcher. */
  ratings: { label: string; value: number }[];
  stats: Record<string, number>;
  restDays: number;
  injuredDays: number;
  /** His zone (a batter's hot and cold cells, a pitcher's locations). */
  zone: number[][];
  /** A batter's spray by direction; null for a pitcher. */
  spray: number[] | null;
  /** From his recent games. */
  recent: {
    games: number;
    pitches: ChartPitch[];
    batted: ChartBattedBall[];
  };
}

const inTeam = (t: BaseballTeam, id: string) =>
  t.pitcher.id === id ||
  t.batters.some((b) => b.player.id === id) ||
  (t.bullpen ?? []).some((p) => p.id === id) ||
  (t.bench ?? []).some((b) => b.player.id === id);

/** The club's own player, or null if he isn't the club's. */
export async function loadBaseballPlayerPage(
  teamId: string,
  playerId: string,
): Promise<BaseballPlayerPage | null> {
  const db = createServiceClient();
  const { data: p, error } = await db
    .from("players")
    .select(
      "id, team_id, sport, display_name, nationality, age, primary_position, secondary_position, attributes, overall, potential_low, potential_high, worth, chemistry_color, traits, stats, rest_days, injured_days",
    )
    .eq("id", playerId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!p || p.team_id !== teamId || p.sport !== "baseball") return null;
  const traits = (p.traits ?? {}) as Partial<BaseballTraits>;
  const attributes = p.attributes as Attributes;
  const position = p.primary_position as Position;
  const pitcher = position === "P";
  const engine = {
    bats: traits.bats ?? "R",
    throws: traits.throws ?? "R",
    zoneProfile: (traits.zone ?? null) as ZonePreset | null,
    sprayProfile: (traits.spray ?? null) as SprayPreset | null,
    locationProfile: (traits.location ?? null) as LocationPreset | null,
  };

  // His last games: the club's own stored games he took part in.
  const { data: seasons, error: seasonsError } = await db
    .from("seasons")
    .select("id, seed, config_version")
    .eq("team_id", teamId)
    .order("number", { ascending: false })
    .limit(3);
  if (seasonsError) throw new Error(seasonsError.message);
  const seasonById = new Map((seasons ?? []).map((s) => [s.id, s]));
  const { data: games, error: gamesError } = seasonById.size
    ? await db
        .from("fixtures")
        .select("id, season_id, stage, manager_team, played_at")
        .in("season_id", [...seasonById.keys()])
        .not("manager_team", "is", null)
        .order("played_at", { ascending: false })
        .limit(60)
    : { data: [], error: null };
  if (gamesError) throw new Error(gamesError.message);
  const pitches: ChartPitch[] = [];
  const batted: ChartBattedBall[] = [];
  let used = 0;
  const configs = new Map<
    string,
    Awaited<ReturnType<typeof baseballConfigFor>>
  >();
  for (const g of games ?? []) {
    if (used >= CHART_GAMES) break;
    const kept = g.manager_team as {
      teams?: { home: BaseballTeam; away: BaseballTeam };
    };
    const teams = kept.teams;
    if (
      !teams ||
      !(inTeam(teams.home, playerId) || inTeam(teams.away, playerId))
    )
      continue;
    const season = seasonById.get(g.season_id);
    if (!season) continue;
    const config =
      configs.get(season.config_version) ??
      (await baseballConfigFor(season.config_version));
    configs.set(season.config_version, config);
    const out = replayGame(
      teams,
      config,
      baseballGameSeed(season.seed, g.id),
      g.stage !== "league",
    );
    const chart = playerChartEvents(out.events, playerId);
    if (chart.faced.length + chart.thrown.length === 0) continue;
    used++;
    pitches.push(...(pitcher ? chart.thrown : chart.faced));
    batted.push(...chart.batted);
  }

  return {
    id: p.id,
    displayName: p.display_name,
    nationality: p.nationality,
    age: p.age,
    primaryPosition: position,
    secondaryPosition: p.secondary_position as BatterPosition | null,
    overall: p.overall,
    potentialRange: [p.potential_low, p.potential_high],
    worth: p.worth,
    chemistryColor: p.chemistry_color,
    traits,
    attributes,
    ratings: pitcher
      ? [
          { label: "As a starter", value: overallAt(attributes, "SP") },
          { label: "As a reliever", value: overallAt(attributes, "RP") },
        ]
      : [
          { label: "Bat", value: battingRating(attributes) },
          ...(position === "DH"
            ? []
            : [
                {
                  label: "Field",
                  value:
                    fieldingRating(attributes, position as BatterPosition) ?? 0,
                },
              ]),
        ],
    stats: (p.stats ?? {}) as Record<string, number>,
    restDays: p.rest_days,
    injuredDays: p.injured_days,
    zone: pitcher ? pitcherLocationGrid(engine) : batterZoneGrid(engine),
    spray: pitcher ? null : batterSpray(engine),
    recent: { games: used, pitches, batted },
  };
}
