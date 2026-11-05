"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { playOneWeek } from "@/lib/play-week";
import { endSeasonFor, startSeasonFor, takeYouthFor } from "@/lib/season-steps";
import { loadMyTeam } from "@/lib/team";

export type ActionResult = { ok: true } | { ok: false; error: string };

const fail = (e: unknown): { ok: false; error: string } => ({
  ok: false,
  error: e instanceof Error ? e.message : "Something went wrong.",
});

/** Server actions are public endpoints: find the manager on every call. */
async function requireTeam() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in first.");
  const team = await loadMyTeam(user.id);
  if (!team) throw new Error("Create your team first.");
  return team;
}

/** Starts the team's next season (D16, D32). */
export async function startSeason(): Promise<ActionResult> {
  try {
    await startSeasonFor(await requireTeam());
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Plays the current week: the manager's match with their saved squad and
 * every other match in the league, then saves results, Elo and earnings.
 */
export async function playNextWeek(): Promise<ActionResult> {
  try {
    await playOneWeek(await requireTeam(), { useEnergy: true });
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Season end (D35): ageing, growth, decline and retirements. */
export async function endSeason(): Promise<ActionResult> {
  try {
    await endSeasonFor(await requireTeam());
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const takenSchema = z.array(z.number().int().min(0).max(21)).max(22);

/** Youth intake (D53): takes the chosen prospects into the squad for free. */
export async function takeYouth(taken: number[]): Promise<ActionResult> {
  try {
    const picks = takenSchema.parse(taken);
    await takeYouthFor(await requireTeam(), picks);
    refresh();
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError)
      return fail(new Error("That pick isn't valid."));
    return fail(e);
  }
}
