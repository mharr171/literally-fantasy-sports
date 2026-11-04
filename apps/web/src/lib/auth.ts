import "server-only";
import { notFound } from "next/navigation";
import { getSupabaseEnv } from "./supabase/env";
import { createClient } from "./supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
};

/**
 * Returns the signed-in user, or null. Reads cookies, so callers must render
 * behind a <Suspense> boundary (Cache Components).
 */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!getSupabaseEnv()) return null;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;
  const { sub, email } = data.claims;
  return { id: sub, email: typeof email === "string" ? email : null };
}

export type CurrentProfile = CurrentUser & {
  displayName: string;
  isAdmin: boolean;
};

/**
 * The signed-in user with their profile, or null. Row-level security only
 * lets a player read their own profile, so this can't leak anyone else's.
 */
export async function getCurrentProfile(): Promise<CurrentProfile | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("display_name, is_admin")
    .eq("id", user.id)
    .maybeSingle();
  return {
    ...user,
    displayName: data?.display_name ?? user.email ?? "Player",
    isAdmin: data?.is_admin === true,
  };
}

/** For admin pages: the admin's profile, or a 404 for everyone else. */
export async function requireAdmin(): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!profile?.isAdmin) notFound();
  return profile;
}
