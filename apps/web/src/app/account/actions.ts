"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { resetAccountFor } from "@/lib/team-steps";

/**
 * Starts the account over (D141): deletes the club and everything that
 * belongs to it, then sends the manager to name a new club. The typed club
 * name confirms it, checked again in the database.
 */
export async function resetAccount(
  confirmName: string,
): Promise<{ ok: false; error: string }> {
  let done = false;
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Sign in first.");
    const name = z.string().max(100).parse(confirmName);
    await resetAccountFor(user.id, name);
    done = true;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Something went wrong.",
    };
  }
  if (done) redirect("/team");
  return { ok: false, error: "Something went wrong." };
}
