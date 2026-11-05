"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import {
  aiClubTurn,
  createAiClub,
  listAiClubs,
  saveAiSettings,
} from "@/lib/ai-clubs";
import { getCurrentProfile } from "@/lib/auth";
import { createServiceClient } from "@/lib/supabase/service";

export type AiResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/** Server actions are public endpoints: check for an admin on every call. */
async function requireAdminId() {
  const profile = await getCurrentProfile();
  if (!profile?.isAdmin) throw new Error("Only admins can manage AI clubs.");
  return profile.id;
}

async function log(adminId: string, action: string, details: object) {
  const { error } = await createServiceClient().from("admin_actions").insert({
    admin_id: adminId,
    team_id: null,
    team_name: "AI clubs",
    action,
    details,
  });
  if (error) throw new Error(`Couldn't log the action: ${error.message}`);
}

const failed = (e: unknown): AiResult => ({
  ok: false,
  error:
    e instanceof z.ZodError
      ? "That value isn't allowed."
      : e instanceof Error
        ? e.message
        : "Something went wrong.",
});

const settingsSchema = z.object({
  enabled: z.boolean(),
  poolSize: z.number().int().min(0).max(1000),
  runsPerDay: z.number().int().min(1).max(48),
});

/** Saves the AI world's switches (D113, D114). */
export async function saveSettings(
  input: z.input<typeof settingsSchema>,
): Promise<AiResult> {
  try {
    const adminId = await requireAdminId();
    const settings = settingsSchema.parse(input);
    await saveAiSettings(settings);
    await log(adminId, "ai_settings", settings);
    refresh();
    return { ok: true, message: "Saved." };
  } catch (e) {
    return failed(e);
  }
}

/** Adds up to 10 AI clubs now, each with its first squad picked. */
export async function addClubs(count: number): Promise<AiResult> {
  try {
    const adminId = await requireAdminId();
    const n = z.number().int().min(1).max(10).parse(count);
    const ids: string[] = [];
    for (let i = 0; i < n; i++) ids.push(await createAiClub());
    await log(adminId, "ai_add_clubs", { count: ids.length });
    refresh();
    return { ok: true, message: `Added ${ids.length} AI clubs.` };
  } catch (e) {
    return failed(e);
  }
}

/**
 * Gives every AI club one turn of up to `weeks` weeks now, as a scheduled
 * run will (D114). For testing on small pools: a page request has a minute.
 */
export async function runTurn(weeks: number): Promise<AiResult> {
  try {
    const adminId = await requireAdminId();
    const w = z.number().int().min(1).max(6).parse(weeks);
    const clubs = await listAiClubs();
    if (clubs.length > 25)
      throw new Error(
        "Too many AI clubs to run from this page; scheduled runs will do it.",
      );
    let played = 0;
    const errors: string[] = [];
    for (const club of clubs) {
      const turn = await aiClubTurn(club.id, w);
      played += turn.weeksPlayed;
      if (turn.error) errors.push(`${club.name}: ${turn.error}`);
    }
    await log(adminId, "ai_run_turn", {
      clubs: clubs.length,
      weeks: w,
      played,
      errors,
    });
    refresh();
    return errors.length > 0
      ? {
          ok: false,
          error: `Played ${played} weeks. Problems: ${errors.join("; ")}`,
        }
      : { ok: true, message: `${clubs.length} clubs played ${played} weeks.` };
  } catch (e) {
    return failed(e);
  }
}
