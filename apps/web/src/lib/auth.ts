import "server-only";
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
