import "server-only";
import type { GeneratedPlayer } from "@lfs/sport-soccer";
import {
  type Attributes,
  isPackFocus,
  type MatchdaySquad,
  type PackFocus,
  type Position,
  packContents,
} from "@lfs/sport-soccer";
import { sortPacks } from "./scouting";
import { createServiceClient } from "./supabase/service";

export const SOCCER = "soccer";

export interface MyTeam {
  id: string;
  name: string;
  elo: number;
  funds: number;
}

/**
 * Game data is read with the service role so the server can see pack seeds;
 * every query here is filtered to the signed-in manager's own team.
 */
export async function loadMyTeam(ownerId: string): Promise<MyTeam | null> {
  const { data, error } = await createServiceClient()
    .from("teams")
    .select("id, name, elo, funds")
    .eq("owner_id", ownerId)
    .eq("sport", SOCCER)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
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
export function openedContents(pack: {
  seed: string;
  focus: PackFocus;
  tier: string;
}): GeneratedPlayer[] {
  return packContents(pack.seed, pack.focus, pack.tier);
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
      "id, from_starter_pack, attributes, display_name, nationality, age, primary_position, secondary_position, overall, potential_low, potential_high, worth, chemistry_color",
    )
    .eq("team_id", teamId);
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({
    id: p.id,
    fromStarterPack: p.from_starter_pack,
    attributes: p.attributes as Attributes,
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
