"use server";

import { clubColorsError, normalizeTeamName, teamNameError } from "@lfs/core";
import { refresh } from "next/cache";
import type { CreateClubState } from "@/components/create-club-form";
import { getCurrentUser } from "@/lib/auth";
import { loadMyTeam } from "@/lib/team";
import { createClub } from "@/lib/team-steps";
import { canSeeSport } from "@/lib/visible-sports";

/**
 * Starts the manager's baseball club (D192). Baseball is a stand-in until
 * M17, so only viewers who may see it (admins, while it's hidden) can.
 */
export async function createBaseballClub(
  _prev: CreateClubState,
  formData: FormData,
): Promise<CreateClubState> {
  const name = normalizeTeamName(String(formData.get("name") ?? ""));
  const colors = formData.getAll("colors").map(String);
  const problem = teamNameError(name) ?? clubColorsError(colors);
  if (problem) return { status: "error", name, colors, message: problem };
  try {
    const user = await getCurrentUser();
    if (!user) throw new Error("Sign in first.");
    if (!(await canSeeSport("baseball")))
      throw new Error("Baseball isn't open yet.");
    if (!(await loadMyTeam(user.id, "baseball")))
      await createClub(user.id, name, colors, "baseball");
  } catch (e) {
    return {
      status: "error",
      name,
      colors,
      message: e instanceof Error ? e.message : "Something went wrong.",
    };
  }
  refresh();
  return { status: "idle" };
}
