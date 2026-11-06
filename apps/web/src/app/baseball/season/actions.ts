"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { playWeekFor } from "@/lib/play-week";
import { endSeasonFor, startSeasonFor, takeYouthFor } from "@/lib/season-steps";
import { loadMyTeam } from "@/lib/team";
import { canSeeSport } from "@/lib/visible-sports";

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Server actions are public endpoints: find the manager's baseball club on every call. */
async function requireBaseballTeam() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in first.");
  if (!(await canSeeSport("baseball")))
    throw new Error("Baseball isn't open yet.");
  const team = await loadMyTeam(user.id, "baseball");
  if (!team) throw new Error("Create your baseball club first.");
  return team;
}

async function run(step: () => Promise<unknown>): Promise<ActionResult> {
  try {
    await step();
    refresh();
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof z.ZodError
          ? "That choice isn't valid."
          : e instanceof Error
            ? e.message
            : "Something went wrong.",
    };
  }
}

/** Starts the next season; the week-0 bye plays straight away (ADR 0009 §2). */
export async function startBaseballSeason(): Promise<ActionResult> {
  return run(async () => startSeasonFor(await requireBaseballTeam()));
}

/** Plays the week's 3-game series and every other series in the league (1 energy). */
export async function playBaseballWeekAction(): Promise<ActionResult> {
  return run(async () =>
    playWeekFor(await requireBaseballTeam(), { useEnergy: true }),
  );
}

/** Season end: aging, growth, decline and retirements (D35). */
export async function endBaseballSeason(): Promise<ActionResult> {
  return run(async () => endSeasonFor(await requireBaseballTeam()));
}

/** Takes the chosen youth prospects, by index, into the squad for free (D53). */
export async function takeBaseballYouth(
  picks: number[],
): Promise<ActionResult> {
  return run(async () =>
    takeYouthFor(
      await requireBaseballTeam(),
      z.array(z.number().int().min(0).max(40)).max(40).parse(picks),
    ),
  );
}
