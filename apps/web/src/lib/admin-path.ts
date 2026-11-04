/** Paths that only admins may open (D21). */
export function isAdminPath(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

/**
 * Where non-admins are sent instead. A path with no page renders the normal
 * "not found" page with a 404, so the admin area doesn't reveal it exists.
 */
export const ADMIN_DENIED_PATH = "/not-found";
