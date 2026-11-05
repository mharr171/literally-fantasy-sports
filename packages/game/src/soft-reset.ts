/**
 * Admin soft reset (D142, ADR 0004): previews and runs the database's
 * soft reset for AI clubs, real clubs or all. The database checks the admin
 * and the typed confirmation again, and logs the run.
 */
import { createServiceClient } from "./db";

export type SoftResetScope = "ai" | "real" | "all";

export const SOFT_RESET_SCOPES: readonly SoftResetScope[] = [
  "ai",
  "real",
  "all",
];

/** What has to be typed to confirm a scope, e.g. "RESET AI". */
export const softResetPhrase = (scope: SoftResetScope) =>
  `RESET ${scope === "ai" ? "AI" : scope === "real" ? "REAL" : "ALL"}`;

export interface SoftResetCounts {
  clubs: number;
  players: number;
  seasons: number;
  season_records: number;
  ghosts: number;
  careers: number;
}

export async function previewSoftReset(
  scope: SoftResetScope,
): Promise<SoftResetCounts> {
  const { data, error } = await createServiceClient().rpc(
    "admin_soft_reset_preview",
    { p_scope: scope },
  );
  if (error) throw new Error(error.message);
  return data as SoftResetCounts;
}

export async function runSoftReset(
  adminId: string,
  scope: SoftResetScope,
  confirm: string,
): Promise<SoftResetCounts> {
  const { data, error } = await createServiceClient().rpc("admin_soft_reset", {
    p_admin: adminId,
    p_scope: scope,
    p_confirm: confirm,
  });
  if (error) {
    if (error.message.includes("to confirm"))
      throw new Error(`Type ${softResetPhrase(scope)} exactly to confirm.`);
    throw new Error(error.message);
  }
  return data as SoftResetCounts;
}
