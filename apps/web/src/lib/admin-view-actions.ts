"use server";

import { cookies } from "next/headers";
import { ADMIN_VIEW_COOKIE } from "./admin-view";
import { getCurrentProfile } from "./auth";

/** Turns the admin extras on public pages on or off (D163). */
export async function toggleAdminView(): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile?.isAdmin) return;
  const jar = await cookies();
  const off = jar.get(ADMIN_VIEW_COOKIE)?.value === "off";
  if (off) jar.delete(ADMIN_VIEW_COOKIE);
  else
    jar.set(ADMIN_VIEW_COOKIE, "off", {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
}
