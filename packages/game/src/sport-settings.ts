import { DEFAULT_ENERGY_SETTINGS, type EnergySettings } from "@lfs/core";
import { createServiceClient } from "./db";

export const SPORTS = ["soccer"] as const;
export type SportKey = (typeof SPORTS)[number];

/** A sport's live energy switches (D93), or the defaults if none are stored. */
export async function loadEnergySettings(
  sport: SportKey,
): Promise<EnergySettings> {
  const { data, error } = await createServiceClient()
    .from("sport_settings")
    .select("energy_enabled, energy_refill_minutes, energy_max")
    .eq("sport", sport)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return DEFAULT_ENERGY_SETTINGS;
  return {
    enabled: data.energy_enabled,
    refillMinutes: data.energy_refill_minutes,
    max: data.energy_max,
  };
}
