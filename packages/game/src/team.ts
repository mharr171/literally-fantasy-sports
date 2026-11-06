import { createServiceClient } from "./db";
import { ensureFormations } from "./formations";
import { sortPacks } from "./scouting";
import { SOCCER } from "./sports";
import type { GeneratedPlayer } from "./sports/soccer";
import {
  type Attributes,
  type GenerationSettings,
  isPackFocus,
  type MatchdaySquad,
  type PackFocus,
  type PlayerCondition,
  type PlayerStats,
  type Position,
  packContents,
  squadFromGroups,
} from "./sports/soccer";

export { SOCCER };

export interface MyTeam {
  id: string;
  name: string;
  elo: number;
  funds: number;
  energy: number;
  energyUpdatedAt: string;
  /** Team morale after recent results, −1 to 1 (M4). */
  morale: number;
  /** Club color keys, main first; empty for clubs from before (D107). */
  colors: string[];
  /** "ai" for an AI club (D113); only the server and admins see this. */
  kind: "human" | "ai";
  /** Weeks without the club's own match play by themselves (D134). */
  skipIdleWeeks: boolean;
}

/**
 * Game data is read with the service role so the server can see pack seeds;
 * every query here is filtered to the signed-in manager's own team.
 */
const toTeam = (data: {
  id: string;
  name: string;
  elo: number;
  funds: number;
  energy: number;
  energy_updated_at: string;
  morale: number;
  colors: string[] | null;
  kind: string;
  skip_idle_weeks: boolean;
}): MyTeam => ({
  id: data.id,
  name: data.name,
  elo: data.elo,
  funds: data.funds,
  energy: data.energy,
  energyUpdatedAt: data.energy_updated_at,
  morale: data.morale,
  colors: data.colors ?? [],
  kind: data.kind === "ai" ? "ai" : "human",
  skipIdleWeeks: data.skip_idle_weeks,
});

/** Any team, by id (admin tools). */
export async function loadTeamById(teamId: string): Promise<MyTeam | null> {
  const { data, error } = await createServiceClient()
    .from("teams")
    .select(
      "id, name, elo, funds, energy, energy_updated_at, morale, colors, kind, skip_idle_weeks",
    )
    .eq("id", teamId)
    .eq("sport", SOCCER)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toTeam(data) : null;
}

/** Every soccer team, by name (admin tools). */
export async function listTeams(): Promise<
  { id: string; name: string; kind: string }[]
> {
  const { data, error } = await createServiceClient()
    .from("teams")
    .select("id, name, kind")
    .eq("sport", SOCCER)
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function loadMyTeam(
  ownerId: string,
  /** The sport's club (D192); soccer by default. */
  sport: string = SOCCER,
): Promise<MyTeam | null> {
  const { data, error } = await createServiceClient()
    .from("teams")
    .select(
      "id, name, elo, funds, energy, energy_updated_at, morale, colors, kind, skip_idle_weeks",
    )
    .eq("owner_id", ownerId)
    .eq("sport", sport)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toTeam(data) : null;
}

/** A manager's club in one sport, for copying its name and colors (D192). */
export interface ClubSummary {
  sport: string;
  name: string;
  colors: string[];
}

/** Every club the manager has, one per sport (D192). */
export async function loadMyClubs(ownerId: string): Promise<ClubSummary[]> {
  const { data, error } = await createServiceClient()
    .from("teams")
    .select("sport, name, colors")
    .eq("owner_id", ownerId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((t) => ({
    sport: t.sport as string,
    name: t.name as string,
    colors: (t.colors as string[] | null) ?? [],
  }));
}

export interface StarterPack {
  id: string;
  focus: PackFocus;
  tier: string;
  seed: string;
  opened: boolean;
  resolved: boolean;
}

export async function loadStarterPacks(teamId: string): Promise<StarterPack[]> {
  const { data, error } = await createServiceClient()
    .from("packs")
    .select("id, focus, tier, seed, opened_at, resolved_at")
    .eq("team_id", teamId)
    .eq("kind", "starter");
  if (error) throw new Error(error.message);
  return sortPacks(
    (data ?? []).map((p) => {
      if (!isPackFocus(p.focus)) throw new Error(`Bad pack focus: ${p.focus}`);
      return {
        id: p.id,
        focus: p.focus,
        tier: p.tier,
        seed: p.seed,
        opened: p.opened_at !== null,
        resolved: p.resolved_at !== null,
      };
    }),
  );
}

/** The players inside a pack (server only: includes the true potential). */
export function openedContents(
  pack: {
    seed: string;
    focus: PackFocus;
    tier: string;
    /** The pack's Elo shift and left-out colors (D179, D180). */
    eloShift?: number;
    excludedColors?: readonly number[];
  },
  settings: GenerationSettings,
): GeneratedPlayer[] {
  return packContents(pack.seed, pack.focus, pack.tier, settings, {
    eloShift: pack.eloShift ?? 0,
    excludedColors: pack.excludedColors ?? [],
  });
}

export interface OpenPack {
  id: string;
  /** A bought pack, or a reward for a playoff finish (D181). */
  kind: "bought" | "reward";
  focus: PackFocus;
  tier: string;
  seed: string;
  eloShift: number;
  excludedColors: number[];
}

/**
 * The team's open pack waiting for keep-or-sell choices, if any: a bought
 * pack, or a reward pack it has opened (D181).
 */
export async function loadOpenBoughtPack(
  teamId: string,
): Promise<OpenPack | null> {
  const { data, error } = await createServiceClient()
    .from("packs")
    .select("id, kind, focus, tier, seed, elo_shift, excluded_colors")
    .eq("team_id", teamId)
    .in("kind", ["bought", "reward"])
    .not("opened_at", "is", null)
    .is("resolved_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  if (!isPackFocus(data.focus))
    throw new Error(`Bad pack focus: ${data.focus}`);
  return {
    id: data.id,
    kind: data.kind === "reward" ? "reward" : "bought",
    focus: data.focus,
    tier: data.tier,
    seed: data.seed,
    eloShift: (data.elo_shift as number | null) ?? 0,
    excludedColors: (data.excluded_colors as number[] | null) ?? [],
  };
}

/** A reward pack waiting to be opened (D181). */
export interface RewardPack {
  id: string;
  tier: string;
}

/** The team's unopened reward packs, oldest first (D181). */
export async function loadRewardPacks(teamId: string): Promise<RewardPack[]> {
  const { data, error } = await createServiceClient()
    .from("packs")
    .select("id, tier")
    .eq("team_id", teamId)
    .eq("kind", "reward")
    .is("opened_at", null)
    .order("created_at");
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({ id: p.id, tier: p.tier }));
}

export interface RosterPlayer {
  id: string;
  fromStarterPack: boolean;
  /** Fitness, injuries, bans and yellow cards between game weeks (M4). */
  condition: PlayerCondition;
  /** Recent form, −1 to 1 (M4). */
  form: number;
  /** The template variant the player uses at their primary position (D84). */
  templateVariant: string;
  /** The template variant at their secondary position (D136). */
  secondaryTemplateVariant: string;
  attributes: Attributes;
  displayName: string;
  nationality: string;
  age: number;
  primaryPosition: Position;
  secondaryPosition: Position | null;
  overall: number;
  potentialRange: [number, number];
  worth: number;
  chemistryColor: number;
  /** Career totals (D143), all counted from when player stats started (D147). */
  stats: PlayerStats;
}

/** Soccer's card stats from the stored `stats` object. */
function playerStats(stored: unknown): PlayerStats {
  const s = (stored ?? {}) as Record<string, unknown>;
  const n = (k: string) => (typeof s[k] === "number" ? (s[k] as number) : 0);
  return {
    games: n("games"),
    wins: n("wins"),
    draws: n("draws"),
    losses: n("losses"),
    goals: n("goals"),
    assists: n("assists"),
    tackles: n("tackles"),
    saves: n("saves"),
  };
}

export async function loadRoster(teamId: string): Promise<RosterPlayer[]> {
  const { data, error } = await createServiceClient()
    .from("players")
    .select(
      "id, from_starter_pack, attributes, fitness, injured_days, suspended_games, yellow_cards, form, template_variant, secondary_template_variant, display_name, nationality, age, primary_position, secondary_position, overall, potential_low, potential_high, worth, chemistry_color, stats",
    )
    .eq("team_id", teamId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({
    id: p.id,
    fromStarterPack: p.from_starter_pack,
    condition: {
      fitness: p.fitness,
      injuredDays: p.injured_days,
      suspendedGames: p.suspended_games,
      yellowCards: p.yellow_cards,
    },
    attributes: p.attributes as Attributes,
    form: p.form,
    templateVariant: p.template_variant,
    secondaryTemplateVariant: p.secondary_template_variant,
    displayName: p.display_name,
    nationality: p.nationality,
    age: p.age,
    primaryPosition: p.primary_position as Position,
    secondaryPosition: p.secondary_position as Position | null,
    overall: p.overall,
    potentialRange: [p.potential_low, p.potential_high],
    worth: p.worth,
    chemistryColor: p.chemistry_color,
    // Stats by key (ADR 0007 §2), 0 for any not yet kept.
    stats: playerStats(p.stats),
  }));
}

/** The team's saved matchday squad, if any (D88). */
export async function loadSquad(teamId: string): Promise<MatchdaySquad | null> {
  const { data, error } = await createServiceClient()
    .from("matchday_squads")
    .select("lineup_data")
    .eq("team_id", teamId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  // The squad as its sport's named groups (ADR 0007 §3).
  const squad = squadFromGroups(data.lineup_data);
  if (!squad) throw new Error("This club's saved squad can't be read.");
  await ensureFormations([squad.formation]);
  return squad;
}

/**
 * The formation the club's squad was moved off because an admin turned it
 * off (D140), until the manager saves the squad again; else null.
 */
export async function loadMovedFrom(teamId: string): Promise<string | null> {
  const { data, error } = await createServiceClient()
    .from("matchday_squads")
    .select("moved_from")
    .eq("team_id", teamId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.moved_from as string | null) ?? null;
}

/** Everything season end needs, true potential included (server only, D48). */
export async function loadAgingPlayers(teamId: string) {
  const { data, error } = await createServiceClient()
    .from("players")
    .select(
      "id, display_name, age, attributes, primary_position, overall, potential, potential_low, potential_high, season_minutes",
    )
    .eq("team_id", teamId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({
    id: p.id as string,
    displayName: p.display_name as string,
    age: p.age as number,
    attributes: p.attributes as Attributes,
    primaryPosition: p.primary_position as Position,
    overall: p.overall as number,
    potential: p.potential as number,
    potentialRange: [p.potential_low, p.potential_high] as [number, number],
    seasonMinutes: (p.season_minutes as number | null) ?? 0,
  }));
}
