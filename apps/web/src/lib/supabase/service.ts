import "server-only";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseEnv } from "./env";

/**
 * Supabase client that acts as the server itself (service role), bypassing
 * row-level security. Only server code that has already checked who the
 * player is and validated the change with the engine may use it: players
 * can't write game data themselves (roadmap Step 8, "Cheating").
 *
 * SUPABASE_SECRET_KEY must never be exposed to the browser: no NEXT_PUBLIC_
 * prefix, and this module refuses to load in client code.
 */
export function createServiceClient() {
  const { url } = requireSupabaseEnv();
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!key) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not set: add the project's secret key (sb_secret_…) to the server environment.",
    );
  }
  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
