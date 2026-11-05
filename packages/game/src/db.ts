/**
 * The game's database client: Supabase as the server itself (service role),
 * bypassing row-level security. Used by the web app's server code and by
 * the AI runner (ADR 0002). Only code that has already checked who is
 * acting, and validated the change with the engine, may use it.
 *
 * SUPABASE_SECRET_KEY must never reach a browser: no NEXT_PUBLIC_ prefix,
 * and this module refuses to load in one.
 */
import { createClient } from "@supabase/supabase-js";

if ("window" in globalThis)
  throw new Error("The game's database client is server-only.");

export function createServiceClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url)
    throw new Error(
      "Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL (or SUPABASE_URL).",
    );
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
