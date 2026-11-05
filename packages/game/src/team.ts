import type { GeneratedPlayer } from "@lfs/sport-soccer";
import {
  type Attributes,
  type GenerationSettings,
  isPackFocus,
  type MatchdaySquad,
  type PackFocus,
  type PlayerCondition,
  type Position,
  packContents,
} from "@lfs/sport-soccer";
import { createServiceClient } from "./db";
import { sortPacks } from "./scouting";

export const SOCCER = "soccer";

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
});

/** Any team, by id (admin tools). */
export async function loadTeamById(teamId: string): Promise<MyTeam | null> {
  const { data, error } = await createServiceClient()
    .from("teams")
    .select(
      "id, name, elo, funds, energy, energy_updated_at, morale, colors, kind",
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

export async function loadMyTeam(ownerId: string): Promise<MyTeam | null> {
  const { data, error } = await createServiceClient()
    .from("teams")
    .select(
      "id, name, elo, funds, energy, energy_updated_at, morale, colors, kind",
    )
    .eq("owner_id", ownerId)
    .eq("sport", SOCCER)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? toTeam(data) : null;
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
  },
  settings: GenerationSettings,
): GeneratedPlayer[] {
  return packContents(pack.seed, pack.focus, pack.tier, settings);
}

export interface OpenPack {
  id: string;
  focus: PackFocus;
  tier: string;
  seed: string;
}

/** The team's bought pack waiting for keep-or-sell choices, if any. */
export async function loadOpenBoughtPack(
  teamId: string,
): Promise<OpenPack | null> {
  const { data, error } = await createServiceClient()
    .from("packs")
    .select("id, focus, tier, seed")
    .eq("team_id", teamId)
    .eq("kind", "bought")
    .is("resolved_at", null)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  if (!isPackFocus(data.focus))
    throw new Error(`Bad pack focus: ${data.focus}`);
  return { ...data, focus: data.focus };
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
}

export async function loadRoster(teamId: string): Promise<RosterPlayer[]> {
  const { data, error } = await createServiceClient()
    .from("players")
    .select(
      "id, from_starter_pack, attributes, fitness, injured_weeks, suspended_weeks, yellow_cards, form, template_variant, display_name, nationality, age, primary_position, secondary_position, overall, potential_low, potential_high, worth, chemistry_color",
    )
    .eq("team_id", teamId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({
    id: p.id,
    fromStarterPack: p.from_starter_pack,
    condition: {
      fitness: p.fitness,
      injuredWeeks: p.injured_weeks,
      suspendedWeeks: p.suspended_weeks,
      yellowCards: p.yellow_cards,
    },
    attributes: p.attributes as Attributes,
    form: p.form,
    templateVariant: p.template_variant,
    displayName: p.display_name,
    nationality: p.nationality,
    age: p.age,
    primaryPosition: p.primary_position as Position,
    secondaryPosition: p.secondary_position as Position | null,
    overall: p.overall,
    potentialRange: [p.potential_low, p.potential_high],
    worth: p.worth,
    chemistryColor: p.chemistry_color,
  }));
}

/** The team's saved matchday squad, if any (D88). */
export async function loadSquad(teamId: string): Promise<MatchdaySquad | null> {
  const { data, error } = await createServiceClient()
    .from("matchday_squads")
    .select("formation, lineup, bench, sub_plan")
    .eq("team_id", teamId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  return {
    formation: data.formation,
    lineup: data.lineup as string[],
    bench: data.bench as string[],
    subPlan: data.sub_plan as MatchdaySquad["subPlan"],
  };
}

/** Everything season end needs, true potential included (server only, D48). */
export async function loadAgingPlayers(teamId: string) {
  const { data, error } = await createServiceClient()
    .from("players")
    .select(
      "id, display_name, age, attributes, primary_position, overall, potential, potential_low, potential_high",
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
  }));
}
