import "server-only";
import { SPORT_UI, type SportUi } from "@/sports/registry";
import { getCurrentProfile } from "./auth";
import { loadSportSwitches } from "./sport-settings";
import { getSupabaseEnv } from "./supabase/env";

/**
 * The sports this viewer may see (D207): public ones, and every sport for
 * admins, so a sport can be built and tried before launch.
 */
export async function visibleSports(): Promise<SportUi[]> {
  // Without a database (local builds), only soccer, as before D207.
  if (!getSupabaseEnv() || !process.env.SUPABASE_SECRET_KEY)
    return SPORT_UI.soccer ? [SPORT_UI.soccer] : [];
  const [profile, switches] = await Promise.all([
    getCurrentProfile(),
    loadSportSwitches(),
  ]);
  return switches
    .filter((s) => s.public || profile?.isAdmin === true)
    .map((s) => SPORT_UI[s.sport])
    .filter((s): s is SportUi => s !== undefined);
}

/** Whether this viewer may see the sport's pages (D207). */
export async function canSeeSport(sport: string): Promise<boolean> {
  return (await visibleSports()).some((s) => s.id === sport);
}
