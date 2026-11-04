"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { assertAdminAction } from "@/lib/auth";
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
    // Server actions are public endpoints: re-check admin and two-factor.
    await assertAdminAction();
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
