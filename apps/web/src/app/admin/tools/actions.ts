"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { playOneWeek } from "@/lib/play-week";
import {
  previewSoftReset,
  runSoftReset,
  type SoftResetCounts,
} from "@/lib/soft-reset";
import { loadEnergySettings } from "@/lib/sport-settings";
import { createServiceClient } from "@/lib/supabase/service";
import { loadTeamById, type MyTeam } from "@/lib/team";

export type ToolResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/**
 * Admin testing tools. Server actions are public endpoints, so every call
 * re-checks that the caller is an admin, and every use is logged.
 */
async function adminTeam(
  teamId: string,
): Promise<{ adminId: string; team: MyTeam }> {
  const profile = await getCurrentProfile();
  if (!profile?.isAdmin) throw new Error("Only admins can use testing tools.");
  const id = z.uuid().parse(teamId);
  const team = await loadTeamById(id);
  if (!team) throw new Error("That team doesn't exist.");
  return { adminId: profile.id, team };
}

async function log(
  adminId: string,
  team: MyTeam,
  action: string,
  details: object,
) {
  const { error } = await createServiceClient().from("admin_actions").insert({
    admin_id: adminId,
    team_id: team.id,
    team_name: team.name,
    action,
    details,
  });
  if (error) throw new Error(`Couldn't log the action: ${error.message}`);
}

const done = (message: string): ToolResult => {
  refresh();
  return { ok: true, message };
};
const failed = (e: unknown): ToolResult => ({
  ok: false,
  error:
    e instanceof z.ZodError
      ? "That value isn't allowed."
      : e instanceof Error
        ? e.message
        : "Something went wrong.",
});

/** Fills the team's energy to the maximum. */
export async function refillEnergy(teamId: string): Promise<ToolResult> {
  try {
    const { adminId, team } = await adminTeam(teamId);
    const { max } = await loadEnergySettings("soccer");
    const { error } = await createServiceClient()
      .from("teams")
      .update({ energy: max, energy_updated_at: new Date().toISOString() })
      .eq("id", team.id);
    if (error) throw new Error(error.message);
    await log(adminId, team, "refill_energy", { energy: max });
    return done(`${team.name} has full energy (${max}).`);
  } catch (e) {
    return failed(e);
  }
}

/** Adds funds, e.g. to test bought packs. */
export async function addFunds(
  teamId: string,
  amount: number,
): Promise<ToolResult> {
  try {
    const value = z.number().int().min(1).max(1_000_000).parse(amount);
    const { adminId, team } = await adminTeam(teamId);
    const { error } = await createServiceClient()
      .from("teams")
      .update({ funds: team.funds + value })
      .eq("id", team.id);
    if (error) throw new Error(error.message);
    await log(adminId, team, "add_funds", { amount: value });
    return done(`Added ${value.toLocaleString("en-US")} to ${team.name}.`);
  } catch (e) {
    return failed(e);
  }
}

/** Full fitness, no injuries, no bans (yellow-card counts stay). */
export async function healSquad(teamId: string): Promise<ToolResult> {
  try {
    const { adminId, team } = await adminTeam(teamId);
    const { error } = await createServiceClient()
      .from("players")
      .update({ fitness: 100, injured_weeks: 0, suspended_weeks: 0 })
      .eq("team_id", team.id);
    if (error) throw new Error(error.message);
    await log(adminId, team, "heal_squad", {});
    return done(`${team.name}'s squad is fit, with no injuries or bans.`);
  } catch (e) {
    return failed(e);
  }
}

/** Plays up to `weeks` weeks without spending energy, stopping at season end. */
export async function playAhead(
  teamId: string,
  weeks: number,
): Promise<ToolResult> {
  try {
    const count = z.number().int().min(1).max(20).parse(weeks);
    const { adminId, team } = await adminTeam(teamId);
    let played = 0;
    let status: string = "regular";
    try {
      while (played < count && status !== "finished") {
        // Reload each time: Elo and funds change every week.
        const current = await loadTeamById(team.id);
        if (!current) throw new Error("That team no longer exists.");
        status = await playOneWeek(current, { useEnergy: false });
        played++;
      }
    } finally {
      if (played > 0) await log(adminId, team, "play_ahead", { weeks: played });
    }
    return done(
      `Played ${played} week${played === 1 ? "" : "s"} for ${team.name}${status === "finished" ? "; the season is over" : ""}.`,
    );
  } catch (e) {
    return failed(e);
  }
}

/** Deletes the team and everything it owns, so its manager can start over. */
export async function deleteTeam(
  teamId: string,
  confirmName: string,
): Promise<ToolResult> {
  try {
    const { adminId, team } = await adminTeam(teamId);
    if (confirmName.trim() !== team.name)
      throw new Error(
        `Type the team's name exactly ("${team.name}") to delete it.`,
      );
    await log(adminId, team, "delete_team", {});
    const { error } = await createServiceClient()
      .from("teams")
      .delete()
      .eq("id", team.id);
    if (error) throw new Error(error.message);
    return done(`Deleted ${team.name}. Its manager can create a new team.`);
  } catch (e) {
    return failed(e);
  }
}

const scopeSchema = z.enum(["ai", "real", "all"]);

async function requireAdminId() {
  const profile = await getCurrentProfile();
  if (!profile?.isAdmin) throw new Error("Only admins can use testing tools.");
  return profile.id;
}

/** Counts what a soft reset of this scope would touch (D142). */
export async function softResetPreview(
  scope: string,
): Promise<
  { ok: true; counts: SoftResetCounts } | { ok: false; error: string }
> {
  try {
    await requireAdminId();
    return {
      ok: true,
      counts: await previewSoftReset(scopeSchema.parse(scope)),
    };
  } catch (e) {
    return failed(e) as { ok: false; error: string };
  }
}

/** Runs the soft reset (D142, ADR 0004) once the phrase is typed. */
export async function softReset(
  scope: string,
  confirm: string,
): Promise<ToolResult> {
  try {
    const adminId = await requireAdminId();
    const s = scopeSchema.parse(scope);
    const counts = await runSoftReset(
      adminId,
      s,
      z.string().max(40).parse(confirm),
    );
    return done(
      `Soft reset done: ${counts.clubs} clubs back to the start, ${counts.players} players kept, ${counts.seasons} seasons, ${counts.season_records} season records, ${counts.ghosts} ghosts and ${counts.careers} careers removed.`,
    );
  } catch (e) {
    return failed(e);
  }
}
