"use server";

import { normalizeTeamName, resalePrice, teamNameError } from "@lfs/core";
import {
  BOUGHT_TIERS,
  PACK_FOCUSES,
  packChoiceError,
  packPrice,
  ROSTER_MIN,
  removalError,
  squadProblems,
  starterPackPlan,
  starterSelectionError,
} from "@lfs/sport-soccer";
import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { playerRow } from "@/lib/scouting";
import { liveGenerationSettings, liveSoccerConfig } from "@/lib/season";
import { createServiceClient } from "@/lib/supabase/service";
import {
  loadMyTeam,
  loadOpenBoughtPack,
  loadRoster,
  loadStarterPacks,
  openedContents,
  SOCCER,
} from "@/lib/team";

export type CreateTeamState =
  | { status: "idle" }
  | { status: "error"; name: string; message: string };

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Server actions are public endpoints: find the manager on every call. */
async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in first.");
  return user;
}

async function requireTeam() {
  const user = await requireUser();
  const team = await loadMyTeam(user.id);
  if (!team) throw new Error("Create your team first.");
  return team;
}

const fail = (e: unknown): { ok: false; error: string } => ({
  ok: false,
  error: e instanceof Error ? e.message : "Something went wrong.",
});

/** Creates the manager's soccer team with its 22 starter packs (D83). */
export async function createTeam(
  _prev: CreateTeamState,
  formData: FormData,
): Promise<CreateTeamState> {
  const name = normalizeTeamName(String(formData.get("name") ?? ""));
  const error = (message: string): CreateTeamState => ({
    status: "error",
    name,
    message,
  });
  const problem = teamNameError(name);
  if (problem) return error(problem);
  try {
    const user = await requireUser();
    if (await loadMyTeam(user.id)) {
      refresh();
      return { status: "idle" };
    }
    const { error: rpcError } = await createServiceClient().rpc(
      "create_team_with_starter_packs",
      {
        p_owner: user.id,
        p_sport: SOCCER,
        p_name: name,
        p_packs: starterPackPlan(),
      },
    );
    if (rpcError) {
      if (rpcError.message.includes("teams_sport_name"))
        return error("That name is taken. Try another.");
      if (rpcError.message.includes("teams_owner_sport")) {
        refresh();
        return { status: "idle" };
      }
      throw new Error(rpcError.message);
    }
  } catch (e) {
    return error(fail(e).error);
  }
  refresh();
  return { status: "idle" };
}

const packIdsSchema = z.array(z.uuid()).min(1).max(22);

/** Opens starter packs: their players become visible to scout. */
export async function openPacks(packIds: string[]): Promise<ActionResult> {
  try {
    const ids = packIdsSchema.parse(packIds);
    const team = await requireTeam();
    const { error } = await createServiceClient()
      .from("packs")
      .update({ opened_at: new Date().toISOString() })
      .eq("team_id", team.id)
      .eq("kind", "starter")
      .is("opened_at", null)
      .in("id", ids);
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const selectionSchema = z.record(
  z.uuid(),
  z.array(z.number().int().min(0).max(4)).max(5),
);

/**
 * Keeps the chosen players and releases the rest for free (D83). The
 * players are regenerated from the pack seeds here, so the browser only
 * says which ones to keep, never what they are.
 */
export async function confirmStarterSquad(
  selection: Record<string, number[]>,
): Promise<ActionResult> {
  try {
    const chosen = selectionSchema.parse(selection);
    const team = await requireTeam();
    const packs = await loadStarterPacks(team.id);
    const problem = starterSelectionError(packs, chosen);
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
    refresh();
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError)
      return fail(new Error("That pick isn't valid."));
    return fail(e);
  }
}

/** Turns a database refusal into something a manager can act on. */
function friendly(message: string): string {
  if (message.includes("not enough funds"))
    return "You can't afford that pack.";
  if (message.includes("finish your open pack"))
    return "Keep or sell the players in your open pack first.";
  if (message.includes("pack is not open"))
    return "That pack has already been sorted.";
  if (message.includes("roster would drop below"))
    return `Keep at least ${ROSTER_MIN} players.`;
  if (message.includes("player is not on this team"))
    return "That player has already left.";
  return message;
}

async function requireSquadPicked(teamId: string) {
  const starter = await loadStarterPacks(teamId);
  if (starter.some((p) => !p.resolved))
    throw new Error("Pick your starting squad before buying packs.");
}

const buySchema = z.object({
  tier: z.enum(BOUGHT_TIERS.map((t) => t.id) as [string, ...string[]]),
  focus: z.enum(PACK_FOCUSES),
});

/** Buys a pack (D47); it opens straight away for keep-or-sell choices. */
export async function buyPack(input: {
  tier: string;
  focus: string;
}): Promise<ActionResult> {
  try {
    const { tier, focus } = buySchema.parse(input);
    const team = await requireTeam();
    await requireSquadPicked(team.id);
    const { error } = await createServiceClient().rpc("buy_pack", {
      p_team: team.id,
      p_focus: focus,
      p_tier: tier,
      // Today's prices from the live settings version (M5).
      p_price: packPrice(tier, focus, (await liveSoccerConfig()).balance.packs),
    });
    if (error) throw new Error(friendly(error.message));
    refresh();
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError)
      return fail(new Error("That pack isn't for sale."));
    return fail(e);
  }
}

const resolveSchema = z.object({
  packId: z.uuid(),
  kept: z.array(z.number().int().min(0).max(4)).max(5),
});

/**
 * Keeps the chosen players from the open pack and bulk-resells the rest
 * (D49). Players and prices are worked out here from the pack's seed.
 */
export async function resolvePack(input: {
  packId: string;
  kept: number[];
}): Promise<ActionResult> {
  try {
    const { packId, kept } = resolveSchema.parse(input);
    const problem = packChoiceError(kept);
    if (problem) throw new Error(problem);
    const team = await requireTeam();
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
    refresh();
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError)
      return fail(new Error("That choice isn't valid."));
    return fail(e);
  }
}

const removeSchema = z.object({
  playerId: z.uuid(),
  mode: z.enum(["release", "sell"]),
});

/** Releases a player for free or bulk-sells them for 25% of worth (D49, D85). */
export async function removePlayer(input: {
  playerId: string;
  mode: "release" | "sell";
}): Promise<ActionResult> {
  try {
    const { playerId, mode } = removeSchema.parse(input);
    const team = await requireTeam();
    const roster = await loadRoster(team.id);
    const player = roster.find((p) => p.id === playerId);
    if (!player) throw new Error("That player has already left.");
    const problem = removalError(roster.length, player, mode);
    if (problem) throw new Error(problem);
    const { error } = await createServiceClient().rpc("remove_player", {
      p_team: team.id,
      p_player: player.id,
      p_refund: mode === "sell" ? resalePrice(player.worth) : 0,
      p_min_roster: ROSTER_MIN,
    });
    if (error) throw new Error(friendly(error.message));
    refresh();
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError)
      return fail(new Error("That choice isn't valid."));
    return fail(e);
  }
}

const squadSchema = z.object({
  formation: z.string().max(20),
  lineup: z.array(z.uuid()).max(11),
  bench: z.array(z.uuid()).max(11),
  subPlan: z
    .array(
      z.object({
        minute: z.number().int(),
        outId: z.uuid(),
        inId: z.uuid(),
      }),
    )
    .max(5),
});

/** Saves the matchday squad after checking it with the engine (D88). */
export async function saveSquad(
  input: z.input<typeof squadSchema>,
): Promise<ActionResult> {
  try {
    const squad = squadSchema.parse(input);
    const team = await requireTeam();
    const roster = await loadRoster(team.id);
    const problems = squadProblems(squad, new Set(roster.map((p) => p.id)));
    if (problems.length > 0) throw new Error(problems.join(" "));
    const { error } = await createServiceClient()
      .from("matchday_squads")
      .upsert({
        team_id: team.id,
        formation: squad.formation,
        lineup: squad.lineup,
        bench: squad.bench,
        sub_plan: squad.subPlan,
        updated_at: new Date().toISOString(),
      });
    if (error) throw new Error(error.message);
    refresh();
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError)
      return fail(new Error("That squad isn't valid."));
    return fail(e);
  }
}
