/**
 * Account progress (D206.9, ADR 0007 §9): each manager's milestones per
 * sport, written by the database at every season close. Only the admin
 * view reads it for now; cross-sport bonuses will later.
 */
import type { SportId } from "@lfs/core";
import { createServiceClient } from "./db";

export interface ProgressLine {
  ownerId: string;
  /** The manager's display name, or null if their profile is gone. */
  name: string | null;
  sport: SportId;
  seasons: number;
  titles: number;
  finals: number;
  bestElo: number | null;
  /** When their latest season in the sport ended. */
  lastAt: string;
}

/** Every manager's totals per sport, most seasons first. */
export async function loadAccountProgress(): Promise<ProgressLine[]> {
  const { data, error } = await createServiceClient().rpc(
    "account_progress_summary",
  );
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    ownerId: r.owner_id as string,
    name: (r.display_name as string | null) ?? null,
    sport: r.sport as SportId,
    seasons: r.seasons as number,
    titles: r.titles as number,
    finals: r.finals as number,
    bestElo: (r.best_elo as number | null) ?? null,
    lastAt: r.last_at as string,
  }));
}
