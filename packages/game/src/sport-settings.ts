import type { SportId } from "@lfs/core";
import { DEFAULT_ENERGY_SETTINGS, type EnergySettings } from "@lfs/core";
import { createServiceClient } from "./db";
import { SOCCER, SPORTS } from "./sports";
import { DEFAULT_ROSTER_LIMITS, type RosterLimits } from "./sports/soccer";

/** The sports with settings to show: every sport in the registry. */
export { SPORTS };
export type SportKey = SportId;

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
  sport: SportKey = SOCCER,
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

/** A sport's league size (ADR 0007 §4), the manager's club included. */
export async function loadLeagueSize(
  sport: SportKey = SOCCER,
): Promise<number> {
  const { data, error } = await createServiceClient()
    .from("sport_settings")
    .select("league_size")
    .eq("sport", sport)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data?.league_size as number | undefined) ?? 12;
}

/** A sport's two switches (D207): seen by players, and its AI world on. */
export interface SportSwitches {
  sport: SportKey;
  public: boolean;
  aiEnabled: boolean;
}

/** Every registered sport's switches; a sport with no row is hidden and off. */
export async function loadSportSwitches(): Promise<SportSwitches[]> {
  const { data, error } = await createServiceClient()
    .from("sport_settings")
    .select("sport, public, ai_enabled");
  if (error) throw new Error(error.message);
  const rows = new Map((data ?? []).map((r) => [r.sport as string, r]));
  return SPORTS.map((sport) => {
    const r = rows.get(sport);
    return {
      sport,
      public: r?.public === true,
      aiEnabled: r?.ai_enabled === true,
    };
  });
}

/** Sets a sport's two switches (D207); admins only, checked by the caller. */
export async function saveSportSwitches(s: SportSwitches): Promise<void> {
  const { error } = await createServiceClient()
    .from("sport_settings")
    .update({
      public: s.public,
      ai_enabled: s.aiEnabled,
      updated_at: new Date().toISOString(),
    })
    .eq("sport", s.sport);
  if (error) throw new Error(error.message);
}
