/**
 * A club's squad steps (ADR 0002): create the club, pick its first squad,
 * buy and sort packs, release players and save the matchday squad. The
 * same code runs for managers and AI clubs. Callers check who is acting
 * (and the shape of the input) first; these check the game rules.
 */
import { clubColorsError, resalePrice, teamNameError } from "@lfs/core";
import { createServiceClient } from "./db";
import { loadFormations } from "./formations";
import { playerRow } from "./scouting";
import { liveGenerationSettings, liveSoccerConfig } from "./season";
import { loadRosterLimits } from "./sport-settings";
import {
  excludedColorsError,
  type MatchdaySquad,
  type PackFocus,
  packChoiceError,
  packEloShift,
  packPrice,
  removalError,
  squadProblems,
  starterPackPlan,
  starterSelectionError,
} from "./sports/soccer";
import {
  loadOpenBoughtPack,
  loadRoster,
  loadSquad,
  loadStarterPacks,
  type MyTeam,
  openedContents,
  SOCCER,
} from "./team";

/** Turns a database refusal into something a manager can act on. */
function friendly(message: string): string {
  if (message.includes("not enough funds"))
    return "You can't afford that pack.";
  if (message.includes("finish your open pack"))
    return "Keep or sell the players in your open pack first.";
  if (message.includes("pack is not open"))
    return "That pack has already been sorted.";
  if (message.includes("roster would drop below"))
    return "You can't go below the minimum roster.";
  if (message.includes("player is not on this team"))
    return "That player has already left.";
  return message;
}

/**
 * Creates an owner's soccer club with its 22 starter packs (D83). Returns
 * "exists" if they already have one.
 */
export async function createClub(
  ownerId: string,
  name: string,
  colors: string[],
): Promise<"created" | "exists"> {
  const problem = teamNameError(name) ?? clubColorsError(colors);
  if (problem) throw new Error(problem);
  const { error } = await createServiceClient().rpc(
    "create_team_with_starter_packs",
    {
      p_owner: ownerId,
      p_sport: SOCCER,
      p_name: name,
      p_packs: starterPackPlan(),
      p_colors: colors,
    },
  );
  if (error) {
    if (error.message.includes("teams_sport_name"))
      throw new Error("That name is taken. Try another.");
    if (error.message.includes("teams_owner_sport")) return "exists";
    throw new Error(error.message);
  }
  return "created";
}

/** Changes the club's colors (D107). */
export async function setClubColorsFor(
  team: MyTeam,
  colors: string[],
): Promise<void> {
  const problem = clubColorsError(colors);
  if (problem) throw new Error(problem);
  const { error } = await createServiceClient().rpc("set_team_colors", {
    p_team: team.id,
    p_colors: colors,
  });
  if (error) throw new Error(error.message);
}

/** Opens starter packs: their players become visible to scout. */
export async function openStarterPacks(
  team: MyTeam,
  packIds: string[],
): Promise<void> {
  const { error } = await createServiceClient()
    .from("packs")
    .update({ opened_at: new Date().toISOString() })
    .eq("team_id", team.id)
    .eq("kind", "starter")
    .is("opened_at", null)
    .in("id", packIds);
  if (error) throw new Error(error.message);
}

/**
 * Keeps the chosen players and releases the rest for free (D83). The
 * players are regenerated from the pack seeds here, so the caller only
 * says which ones to keep, never what they are.
 */
export async function confirmStarterSquadFor(
  team: MyTeam,
  chosen: Record<string, number[]>,
): Promise<void> {
  const [packs, limits] = await Promise.all([
    loadStarterPacks(team.id),
    loadRosterLimits(),
  ]);
  const problem = starterSelectionError(packs, chosen, limits);
  if (problem) throw new Error(problem);
  const generation = await liveGenerationSettings();
  const rows = packs.flatMap((pack) => {
    const players = openedContents(pack, generation);
    return (chosen[pack.id] ?? []).map((i) => {
      const player = players[i];
      if (!player) throw new Error("That player isn't in the pack.");
      return playerRow(player);
    });
  });
  const kept = Object.fromEntries(
    packs.map((p) => [p.id, [...(chosen[p.id] ?? [])].sort((a, b) => a - b)]),
  );
  const { error } = await createServiceClient().rpc("resolve_starter_packs", {
    p_team: team.id,
    p_players: rows,
    p_kept: kept,
  });
  if (error) {
    if (error.message.includes("not ready to resolve"))
      throw new Error("Your starting squad is already picked.");
    throw new Error(error.message);
  }
}

/** Buys a pack (D47) at today's price; it opens straight away. */
export async function buyPackFor(
  team: MyTeam,
  tier: string,
  focus: PackFocus,
  excludedColors: readonly number[] = [],
): Promise<void> {
  const starter = await loadStarterPacks(team.id);
  if (starter.some((p) => !p.resolved))
    throw new Error("Pick your starting squad before buying packs.");
  const colorProblem = excludedColorsError(excludedColors);
  if (colorProblem) throw new Error(colorProblem);
  // Today's prices from the live settings version (M5), with the odds and
  // price moved for the club's Elo now (D179) and any colors left out (D180).
  const prices = (await liveSoccerConfig()).balance.packs;
  const eloShift = packEloShift(team.elo, prices);
  const { error } = await createServiceClient().rpc("buy_pack_with_choices", {
    p_team: team.id,
    p_focus: focus,
    p_tier: tier,
    p_price: packPrice(tier, focus, prices, { eloShift, excludedColors }),
    p_elo_shift: eloShift,
    p_excluded: [...excludedColors],
  });
  if (error) throw new Error(friendly(error.message));
}

/** Opens one of the club's reward packs (D181), once any open pack is sorted. */
export async function openRewardPackFor(
  team: MyTeam,
  packId: string,
): Promise<void> {
  const { error } = await createServiceClient().rpc("open_reward_pack", {
    p_team: team.id,
    p_pack: packId,
  });
  if (error) {
    if (error.message.includes("finish your open pack"))
      throw new Error("Keep or sell the players in your open pack first.");
    if (error.message.includes("not waiting"))
      throw new Error("That reward pack is already open.");
    throw new Error(error.message);
  }
}

/**
 * Keeps the chosen players from the open pack and bulk-resells the rest
 * (D49). Players and prices are worked out here from the pack's seed.
 */
export async function resolvePackFor(
  team: MyTeam,
  packId: string,
  kept: number[],
): Promise<void> {
  const problem = packChoiceError(kept);
  if (problem) throw new Error(problem);
  const pack = await loadOpenBoughtPack(team.id);
  if (!pack || pack.id !== packId)
    throw new Error("That pack has already been sorted.");
  const players = openedContents(pack, await liveGenerationSettings());
  const keep = new Set(kept);
  const refund = players
    .filter((_, i) => !keep.has(i))
    .reduce((total, p) => total + resalePrice(playerRow(p).worth), 0);
  const { error } = await createServiceClient().rpc("resolve_bought_pack", {
    p_team: team.id,
    p_pack: pack.id,
    p_players: players.filter((_, i) => keep.has(i)).map(playerRow),
    p_kept: [...keep].sort((a, b) => a - b),
    p_refund: refund,
  });
  if (error) throw new Error(friendly(error.message));
}

/** Releases a player for free or bulk-sells them for 25% of worth (D49, D85). */
export async function removePlayerFor(
  team: MyTeam,
  playerId: string,
  mode: "release" | "sell",
): Promise<void> {
  const [roster, limits] = await Promise.all([
    loadRoster(team.id),
    loadRosterLimits(),
  ]);
  const player = roster.find((p) => p.id === playerId);
  if (!player) throw new Error("That player has already left.");
  const problem = removalError(roster.length, player, mode, limits);
  if (problem) throw new Error(problem);
  const { error } = await createServiceClient().rpc("remove_player", {
    p_team: team.id,
    p_player: player.id,
    p_refund: mode === "sell" ? resalePrice(player.worth) : 0,
    p_min_roster: limits.min,
  });
  if (error) throw new Error(friendly(error.message));
}

/** Saves the matchday squad after checking it with the engine (D88). */
export async function saveSquadFor(
  team: MyTeam,
  squad: MatchdaySquad,
): Promise<void> {
  const [roster, saved, formations] = await Promise.all([
    loadRoster(team.id),
    loadSquad(team.id),
    loadFormations(),
  ]);
  // A formation that's off can't be newly picked; a squad already in it can
  // still be saved until the club moves off it (D140).
  const picked = formations.find((f) => f.id === squad.formation);
  if (picked && !picked.enabled && saved?.formation !== squad.formation)
    throw new Error(
      `${squad.formation} is turned off. Pick another formation.`,
    );
  const { benchMax } = await loadRosterLimits();
  const problems = squadProblems(
    squad,
    new Set(roster.map((p) => p.id)),
    undefined,
    benchMax,
  );
  if (problems.length > 0) throw new Error(problems.join(" "));
  const { error } = await createServiceClient().from("matchday_squads").upsert({
    team_id: team.id,
    formation: squad.formation,
    lineup: squad.lineup,
    bench: squad.bench,
    sub_plan: squad.subPlan,
    moved_from: null,
    updated_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
}

/** Whether weeks without the club's own match play by themselves (D134). */
export async function setSkipIdleWeeksFor(
  team: MyTeam,
  on: boolean,
): Promise<void> {
  const { error } = await createServiceClient()
    .from("teams")
    .update({ skip_idle_weeks: on })
    .eq("id", team.id);
  if (error) throw new Error(error.message);
}

/**
 * Account reset (D141, ADR 0004): deletes the manager's club and everything
 * that belongs to it, so they can start again from naming a club. The
 * club's exact name confirms it; the database checks it again.
 */
export async function resetAccountFor(
  ownerId: string,
  confirmName: string,
): Promise<void> {
  const { error } = await createServiceClient().rpc("reset_account", {
    p_owner: ownerId,
    p_confirm: confirmName,
  });
  if (error) {
    if (error.message.includes("does not match"))
      throw new Error("That isn't your club's name: type it exactly.");
    if (error.message.includes("no club"))
      throw new Error("You don't have a club to reset.");
    throw new Error(error.message);
  }
}
