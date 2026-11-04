/** Paths that only admins may open (D21). */
export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * Where non-admins are sent instead. A path with no page renders the normal
 * "not found" page with a 404, so the admin area doesn't reveal it exists.
 */
export const ADMIN_DENIED_PATH = "/not-found";

/** Where admins set up or enter their two-factor code (M5). */
export const ADMIN_SECURITY_PATH = "/admin/security";

/** A safe place to go after entering the code: an admin page, else the overview. */
export function adminNextPath(next: string | null | undefined): string {
  if (!next || !isAdminPath(next) || next === ADMIN_SECURITY_PATH)
    return "/admin";
  // Only a plain path: no other host, no protocol tricks.
  return /^\/admin(\/[a-z0-9-]+)*$/.test(next) ? next : "/admin";
}
