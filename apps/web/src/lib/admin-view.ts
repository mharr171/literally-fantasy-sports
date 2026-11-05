import "server-only";
import { cookies } from "next/headers";
import { getCurrentProfile } from "./auth";

/** Set to "off" when an admin wants to see pages as a player does (D163). */
export const ADMIN_VIEW_COOKIE = "lfs_admin_view";

/**
 * Whether this request should show the admin extras on public pages (D163):
 * only for a signed-in admin who hasn't switched them off. Everything the
 * extras show is loaded only when this is true, so it never reaches anyone
 * else's browser.
 */
export async function adminView(): Promise<boolean> {
  const profile = await getCurrentProfile();
  if (!profile?.isAdmin) return false;
  return (await cookies()).get(ADMIN_VIEW_COOKIE)?.value !== "off";
}
