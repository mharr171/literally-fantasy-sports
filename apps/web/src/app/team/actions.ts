"use server";

import { normalizeTeamName, teamNameError } from "@lfs/core";
import { starterPackPlan, starterSelectionError } from "@lfs/sport-soccer";
import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { starterPlayerRow } from "@/lib/scouting";
import { createServiceClient } from "@/lib/supabase/service";
import {
  loadMyTeam,
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

    const rows = packs.flatMap((pack) => {
      const players = openedContents(pack);
      return (chosen[pack.id] ?? []).map((i) => {
        const player = players[i];
        if (!player) throw new Error("That player isn't in the pack.");
        return starterPlayerRow(player);
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
