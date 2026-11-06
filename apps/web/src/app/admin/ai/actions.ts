"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import {
  aiClubTurn,
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
  poolSize: z.number().int().min(0).max(1000),
  runsPerDay: z.number().int().min(1).max(48),
});

/** Saves the AI world's pool size and runs a day (D113, D114). */
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
 * Gives AI clubs one turn of up to `weeks` weeks now, like a scheduled run
 * (D114) but without using their energy (D160). A page request has a
 * minute, so it stops starting turns after 40 seconds. `done` lists the
 * clubs that already had a turn since the admin started clicking, so the
 * next click carries on with the rest; once everyone has played it starts
 * again.
 */
export async function runTurn(
  weeks: number,
  done: readonly string[] = [],
): Promise<AiResult & { ranIds: string[]; finished: boolean }> {
  try {
    const adminId = await requireAdminId();
    const w = z.number().int().min(1).max(6).parse(weeks);
    const skip = new Set(z.array(z.uuid()).max(5_000).parse(done));
    const all = await listAiClubs();
    const clubs = all.filter((c) => !skip.has(c.id));
    const run = await runAiTurns(clubs, () => w, {
      budgetMs: 40_000,
      turn: (id, n) => aiClubTurn(id, n, { useEnergy: false }),
    });
    const errors = run.turns
      .filter((t) => t.error)
      .map((t) => {
        const name = all.find((c) => c.id === t.teamId)?.name ?? t.teamId;
        return `${name}: ${t.error}`;
      });
    await log(adminId, "ai_run_turn", {
      clubs: clubs.length,
      energy: false,
      ran: run.ran,
      weeks: w,
      played: run.weeksPlayed,
      errors,
    });
    refresh();
    const summary = `${run.ran} clubs played ${run.weeksPlayed} weeks.${run.skipped > 0 ? ` ${run.skipped} still to go: click again to carry on.` : ` Every AI club has had a turn.`}`;
    const extra = {
      ranIds: run.turns.map((t) => t.teamId),
      finished: run.skipped === 0,
    };
    return errors.length > 0
      ? {
          ok: false,
          error: `${summary} Problems: ${errors.join("; ")}`,
          ...extra,
        }
      : { ok: true, message: summary, ...extra };
  } catch (e) {
    return { ...failed(e), ranIds: [], finished: false };
  }
}
