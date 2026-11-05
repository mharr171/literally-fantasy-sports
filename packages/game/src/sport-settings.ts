import { DEFAULT_ENERGY_SETTINGS, type EnergySettings } from "@lfs/core";
import { DEFAULT_ROSTER_LIMITS, type RosterLimits } from "@lfs/sport-soccer";
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

/** A sport's roster limits (D182), or soccer's defaults if none are stored. */
export async function loadRosterLimits(
  sport: SportKey = "soccer",
): Promise<RosterLimits> {
  const { data, error } = await createServiceClient()
    .from("sport_settings")
    .select("roster_min, roster_max, bench_max")
    .eq("sport", sport)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return DEFAULT_ROSTER_LIMITS;
  return {
    min: data.roster_min as number,
    max: data.roster_max as number,
    benchMax: data.bench_max as number,
  };
}
