/**
 * A baseball club's first squad (ADR 0009 §6, D221): its 16 starter
 * packs, opening them to scout, and keeping 14 to 30 with at least 9
 * pitchers and 9 batters. The same steps for managers and, later, AI
 * clubs. Callers check who is acting first; these check the game rules.
 */
import { type StarterPackState, starterSelectionError } from "@lfs/core";
import { createServiceClient } from "./db";
import { loadRosterLimits } from "./sport-settings";
import {
  type Attributes,
  type BaseballConfig,
  type BaseballPlayer,
  type BaseballSquad,
  type BatterPosition,
  baseballConfigFromValues,
  DEFAULT_SEASON_END_SETTINGS,
  type GeneratedPlayer,
  generationSettings,
  isPackFocus,
  type LocationPreset,
  PACK_FOCUSES,
  type PackFocus,
  type PitcherRole,
  type Position,
  packContents,
  type SprayPreset,
  squadFromData,
  squadProblems,
  starterMixError,
  starterPackPlan,
  youthIntake,
  type ZonePreset,
} from "./sports/baseball";
import {
  type BaseballTraits,
  baseballPlayerRow,
  type ScoutedBaseballPlayer,
  scoutBaseballPlayer,
} from "./sports/baseball-players";
import type { MyTeam } from "./team";

const BASEBALL = "baseball";

/** Baseball's live settings and their label, e.g. "baseball:2", or the defaults. */
export async function liveBaseballConfig(): Promise<{
  label: string;
  config: BaseballConfig;
}> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("game_config_versions")
    .select("version")
    .eq("scope", BASEBALL)
    .not("published_at", "is", null)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return { label: "defaults", config: baseballConfigFromValues({}) };
  const { data: rows, error: rowsError } = await db
    .from("game_config")
    .select("key, value")
    .eq("scope", BASEBALL)
    .eq("version", data.version);
  if (rowsError) throw new Error(rowsError.message);
  return {
    label: `${BASEBALL}:${data.version}`,
    config: baseballConfigFromValues(
      Object.fromEntries((rows ?? []).map((r) => [r.key as string, r.value])),
    ),
  };
}

export interface BaseballStarterPack extends StarterPackState {
  focus: PackFocus;
  tier: string;
  seed: string;
}

/** The club's starter packs, by focus (starters, relievers, infield, outfield). */
export async function loadBaseballStarterPacks(
  teamId: string,
): Promise<BaseballStarterPack[]> {
  const { data, error } = await createServiceClient()
    .from("packs")
    .select("id, focus, tier, seed, opened_at, resolved_at")
    .eq("team_id", teamId)
    .eq("kind", "starter");
  if (error) throw new Error(error.message);
  const rank = (f: PackFocus) => PACK_FOCUSES.indexOf(f);
  return (data ?? [])
    .map((p) => {
      if (!isPackFocus(p.focus)) throw new Error(`Bad pack focus: ${p.focus}`);
      return {
        id: p.id as string,
        focus: p.focus,
        tier: p.tier as string,
        seed: p.seed as string,
        opened: p.opened_at !== null,
        resolved: p.resolved_at !== null,
      };
    })
    .sort((a, b) => rank(a.focus) - rank(b.focus) || a.id.localeCompare(b.id));
}

/** A pack's players (server only: they include the true potential). */
function contents(
  pack: Pick<BaseballStarterPack, "seed" | "focus" | "tier">,
  config: BaseballConfig,
): GeneratedPlayer[] {
  return packContents(
    pack.seed,
    pack.focus,
    pack.tier,
    generationSettings(config.balance),
  );
}

export interface BaseballScoutingPack {
  id: string;
  focus: PackFocus;
  /** Null while the pack is sealed. */
  players: ScoutedBaseballPlayer[] | null;
}

/** What the manager scouts: each starter pack, its players once opened. */
export async function loadBaseballScouting(
  teamId: string,
): Promise<{ packs: BaseballScoutingPack[]; resolved: boolean }> {
  const [packs, { config }] = await Promise.all([
    loadBaseballStarterPacks(teamId),
    liveBaseballConfig(),
  ]);
  return {
    resolved: packs.length > 0 && packs.every((p) => p.resolved),
    packs: packs.map((p) => ({
      id: p.id,
      focus: p.focus,
      players: p.opened ? contents(p, config).map(scoutBaseballPlayer) : null,
    })),
  };
}

/**
 * Gives a club its 16 starter packs (D221) if it has none and no players:
 * for baseball clubs created before the packs existed.
 */
export async function giveBaseballStarterPacksFor(team: MyTeam): Promise<void> {
  if (team.sport !== BASEBALL) throw new Error("That isn't a baseball club.");
  const db = createServiceClient();
  const [packs, players] = await Promise.all([
    db
      .from("packs")
      .select("id", { count: "exact", head: true })
      .eq("team_id", team.id),
    db
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("team_id", team.id),
  ]);
  if (packs.error) throw new Error(packs.error.message);
  if (players.error) throw new Error(players.error.message);
  if ((packs.count ?? 0) > 0 || (players.count ?? 0) > 0)
    throw new Error("Your club already has its starter packs.");
  const { error } = await db.from("packs").insert(
    starterPackPlan().map((p) => ({
      team_id: team.id,
      sport: BASEBALL,
      kind: "starter",
      focus: p.focus,
      tier: p.tier,
      seed: crypto.randomUUID(),
    })),
  );
  if (error) throw new Error(error.message);
}

/**
 * Keeps the chosen players and releases the rest (D221): 14 to 30, with at
 * least 9 pitchers and 9 batters. The players are regenerated from the
 * pack seeds here, so the caller only says which ones to keep.
 */
export async function confirmBaseballStarterSquadFor(
  team: MyTeam,
  chosen: Record<string, number[]>,
): Promise<void> {
  const [packs, limits, { config }] = await Promise.all([
    loadBaseballStarterPacks(team.id),
    loadRosterLimits(BASEBALL),
    liveBaseballConfig(),
  ]);
  const problem = starterSelectionError(packs, chosen, limits);
  if (problem) throw new Error(problem);
  const kept = packs.flatMap((pack) => {
    const players = contents(pack, config);
    return (chosen[pack.id] ?? []).map((i) => {
      const player = players[i];
      if (!player) throw new Error("That player isn't in the pack.");
      return player;
    });
  });
  const mix = starterMixError(kept);
  if (mix) throw new Error(mix);
  const { error } = await createServiceClient().rpc("resolve_starter_packs", {
    p_team: team.id,
    p_players: kept.map(baseballPlayerRow),
    p_kept: Object.fromEntries(
      packs.map((p) => [p.id, [...(chosen[p.id] ?? [])].sort((a, b) => a - b)]),
    ),
  });
  if (error) {
    if (error.message.includes("not ready to resolve"))
      throw new Error("Your starting squad is already picked.");
    throw new Error(error.message);
  }
}

/** A baseball player on the roster, as the manager sees him: no true potential. */
export interface BaseballRosterPlayer {
  id: string;
  displayName: string;
  nationality: string;
  age: number;
  primaryPosition: string;
  secondaryPosition: string | null;
  overall: number;
  potentialRange: [number, number];
  worth: number;
  chemistryColor: number;
  traits: Partial<BaseballTraits>;
  restDays: number;
  injuredDays: number;
}

export async function loadBaseballRoster(
  teamId: string,
): Promise<BaseballRosterPlayer[]> {
  const { data, error } = await createServiceClient()
    .from("players")
    .select(
      "id, display_name, nationality, age, primary_position, secondary_position, overall, potential_low, potential_high, worth, chemistry_color, traits, rest_days, injured_days",
    )
    .eq("team_id", teamId)
    .order("overall", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => ({
    id: p.id,
    displayName: p.display_name,
    nationality: p.nationality,
    age: p.age,
    primaryPosition: p.primary_position,
    secondaryPosition: p.secondary_position,
    overall: p.overall,
    potentialRange: [p.potential_low, p.potential_high],
    worth: p.worth,
    chemistryColor: p.chemistry_color,
    traits: (p.traits ?? {}) as Partial<BaseballTraits>,
    restDays: p.rest_days,
    injuredDays: p.injured_days,
  }));
}

/**
 * A rostered player as the squad builder and the engine need him: no true
 * potential, but the attributes, which managers may see (as soccer's).
 */
export interface BaseballSquadPlayer extends BaseballPlayer {
  displayName: string;
  overall: number;
  injuredDays: number;
  restDays: number;
}

export async function loadBaseballSquadPlayers(
  teamId: string,
): Promise<BaseballSquadPlayer[]> {
  const { data, error } = await createServiceClient()
    .from("players")
    .select(
      "id, display_name, primary_position, secondary_position, attributes, overall, chemistry_color, traits, injured_days, rest_days",
    )
    .eq("team_id", teamId)
    .order("overall", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((p) => {
    const t = (p.traits ?? {}) as Partial<BaseballTraits>;
    return {
      id: p.id,
      displayName: p.display_name,
      attributes: p.attributes as Attributes,
      primaryPosition: p.primary_position as Position,
      secondaryPosition: p.secondary_position as BatterPosition | null,
      pitcherRole:
        p.primary_position === "P"
          ? ((t.role ?? "starter") as PitcherRole)
          : null,
      chemistryColor: p.chemistry_color,
      bats: t.bats ?? "R",
      throws: t.throws ?? "R",
      zoneProfile: (t.zone ?? null) as ZonePreset | null,
      sprayProfile: (t.spray ?? null) as SprayPreset | null,
      locationProfile: (t.location ?? null) as LocationPreset | null,
      overall: p.overall,
      injuredDays: p.injured_days,
      restDays: p.rest_days,
    };
  });
}

/** The club's saved game-day squad, or null before one is saved. */
export async function loadBaseballSquad(
  teamId: string,
): Promise<BaseballSquad | null> {
  const { data, error } = await createServiceClient()
    .from("matchday_squads")
    .select("lineup_data")
    .eq("team_id", teamId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? squadFromData(data.lineup_data) : null;
}

/** Saves the game-day squad after the engine checks it (D196, D212). */
export async function saveBaseballSquadFor(
  team: MyTeam,
  squad: BaseballSquad,
): Promise<void> {
  if (team.sport !== BASEBALL) throw new Error("That isn't a baseball club.");
  const [players, limits] = await Promise.all([
    loadBaseballSquadPlayers(team.id),
    loadRosterLimits(BASEBALL),
  ]);
  const problems = squadProblems(squad, players, limits.benchMax);
  if (problems.length > 0) throw new Error(problems.join(" "));
  const { error } = await createServiceClient().from("matchday_squads").upsert({
    team_id: team.id,
    lineup_data: squad,
    moved_from: null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

/** The season's youth prospects as the manager scouts them: no true potential (D48, D53). */
export async function loadBaseballYouth(
  seed: string,
): Promise<ScoutedBaseballPlayer[]> {
  const { config } = await liveBaseballConfig();
  return youthIntake(
    seed,
    DEFAULT_SEASON_END_SETTINGS,
    generationSettings(config.balance),
  ).map(scoutBaseballPlayer);
}
