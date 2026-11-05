"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import {
  createAiClub,
  listAiClubs,
  runAiTurns,
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
    // A page request has a minute: stop starting new clubs after 40 seconds.
    const started = Date.now();
    const ids: string[] = [];
    for (let i = 0; i < n && Date.now() - started < 40_000; i++)
      ids.push(await createAiClub());
    await log(adminId, "ai_add_clubs", { count: ids.length });
    refresh();
    return {
      ok: true,
      message:
        ids.length < n
          ? `Added ${ids.length} AI clubs (out of time for the rest: click again).`
          : `Added ${ids.length} AI clubs.`,
    };
  } catch (e) {
    return failed(e);
  }
}

/**
 * Gives AI clubs one turn of up to `weeks` weeks now, as a scheduled run
 * will (D114). A page request has a minute, so it stops starting turns
 * after 40 seconds; clubs that waited longest go first, so clicking again
 * carries on with the rest.
 */
export async function runTurn(weeks: number): Promise<AiResult> {
  try {
    const adminId = await requireAdminId();
    const w = z.number().int().min(1).max(6).parse(weeks);
    const clubs = await listAiClubs();
    const run = await runAiTurns(clubs, () => w, { budgetMs: 40_000 });
    const errors = run.turns
      .filter((t) => t.error)
      .map((t) => {
        const name = clubs.find((c) => c.id === t.teamId)?.name ?? t.teamId;
        return `${name}: ${t.error}`;
      });
    await log(adminId, "ai_run_turn", {
      clubs: clubs.length,
      ran: run.ran,
      weeks: w,
      played: run.weeksPlayed,
      errors,
    });
    refresh();
    const summary = `${run.ran} of ${clubs.length} clubs played ${run.weeksPlayed} weeks.${run.skipped > 0 ? ` ${run.skipped} left: click again to carry on.` : ""}`;
    return errors.length > 0
      ? { ok: false, error: `${summary} Problems: ${errors.join("; ")}` }
      : { ok: true, message: summary };
  } catch (e) {
    return failed(e);
  }
}
