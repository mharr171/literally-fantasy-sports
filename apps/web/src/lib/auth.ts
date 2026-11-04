import "server-only";
import { notFound, redirect } from "next/navigation";
import { ADMIN_SECURITY_PATH } from "./admin-path";
import { getSupabaseEnv } from "./supabase/env";
import { createClient } from "./supabase/server";

export type CurrentUser = {
  id: string;
  email: string | null;
  /** True when this session signed in with a second factor (aal2, M5). */
  twoFactor: boolean;
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
  const { sub, email, aal } = data.claims;
  return {
    id: sub,
    email: typeof email === "string" ? email : null,
    twoFactor: aal === "aal2",
  };
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

/**
 * For admin pages: the admin's profile, or a 404 for everyone else. An
 * admin who hasn't entered a two-factor code this session is sent to do so
 * first (the database ignores their admin flag until they have).
 */
export async function requireAdmin(): Promise<CurrentProfile> {
  const profile = await requireAdminAccount();
  if (!profile.twoFactor) redirect(ADMIN_SECURITY_PATH);
  return profile;
}

/** An admin account, with or without two-factor this session (the security page). */
export async function requireAdminAccount(): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!profile?.isAdmin) notFound();
  return profile;
}

/**
 * For admin server actions, which are public endpoints: throws unless the
 * caller is an admin signed in with two-factor.
 */
export async function assertAdminAction(): Promise<CurrentProfile> {
  const profile = await getCurrentProfile();
  if (!profile?.isAdmin) throw new Error("Only admins can do that.");
  if (!profile.twoFactor)
    throw new Error("Enter your two-factor code first (Admin → Security).");
  return profile;
}
