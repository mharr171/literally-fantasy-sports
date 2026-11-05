"use server";

import { rosterLimitsError } from "@lfs/sport-soccer";
import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionResult = { ok: true } | { ok: false; error: string };

const energySchema = z.object({
  sport: z.enum(["soccer"]),
  enabled: z.boolean(),
  refillMinutes: z.number().int().min(1).max(1440),
  max: z.number().int().min(1).max(20),
});

/**
 * Changes a sport's energy switches (D93). Takes effect at once for every
 * manager of that sport. The database also refuses non-admins.
 */
export async function saveEnergySettings(
  input: z.input<typeof energySchema>,
): Promise<ActionResult> {
  try {
    const profile = await getCurrentProfile();
    if (!profile?.isAdmin)
      throw new Error("Only admins can change game settings.");
    const { sport, enabled, refillMinutes, max } = energySchema.parse(input);
    const { data, error } = await (await createClient())
      .from("sport_settings")
      .update({
        energy_enabled: enabled,
        energy_refill_minutes: refillMinutes,
        energy_max: max,
        updated_at: new Date().toISOString(),
      })
      .eq("sport", sport)
      .select("sport");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error(`No settings for ${sport}.`);
    refresh();
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError)
      return {
        ok: false,
        error: "Refill must be 1–1440 minutes and the maximum 1–20.",
      };
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Something went wrong.",
    };
  }
}

const rosterSchema = z.object({
  sport: z.enum(["soccer"]),
  min: z.number().int(),
  max: z.number().int(),
  benchMax: z.number().int(),
});

/**
 * Changes a sport's roster limits (D182): the fewest and most players a club
 * holds and the bench size. Applies at once; clubs over the maximum must
 * trim before their next match. The database also refuses non-admins.
 */
export async function saveRosterLimits(
  input: z.input<typeof rosterSchema>,
): Promise<ActionResult> {
  try {
    const profile = await getCurrentProfile();
    if (!profile?.isAdmin)
      throw new Error("Only admins can change game settings.");
    const { sport, ...limits } = rosterSchema.parse(input);
    const problem = rosterLimitsError(limits);
    if (problem) throw new Error(problem);
    const { data, error } = await (await createClient())
      .from("sport_settings")
      .update({
        roster_min: limits.min,
        roster_max: limits.max,
        bench_max: limits.benchMax,
        updated_at: new Date().toISOString(),
      })
      .eq("sport", sport)
      .select("sport");
    if (error) throw new Error(error.message);
    if (!data?.length) throw new Error(`No settings for ${sport}.`);
    refresh();
    return { ok: true };
  } catch (e) {
    return {
      ok: false,
      error:
        e instanceof z.ZodError
          ? "Use whole numbers."
          : e instanceof Error
            ? e.message
            : "Something went wrong.",
    };
  }
}
