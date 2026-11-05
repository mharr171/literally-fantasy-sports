import "server-only";

/**
 * Supabase client that acts as the server itself (service role), bypassing
 * row-level security. Only server code that has already checked who the
 * player is and validated the change with the engine may use it: players
 * can't write game data themselves (roadmap Step 8, "Cheating").
 *
 * SUPABASE_SECRET_KEY must never be exposed to the browser: no NEXT_PUBLIC_
 * prefix, and this module refuses to load in client code. The client itself
 * lives in @lfs/game, shared with the AI runner (ADR 0002).
 */
export { createServiceClient } from "@lfs/game/db";
