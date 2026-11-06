"use server";

import { clubColorsError, normalizeTeamName, teamNameError } from "@lfs/core";
import { refresh } from "next/cache";
import { z } from "zod";
import type { CreateClubState } from "@/components/create-club-form";
import { getCurrentUser } from "@/lib/auth";
import {
  confirmBaseballStarterSquadFor,
  giveBaseballStarterPacksFor,
  saveBaseballSquadFor,
} from "@/lib/baseball-squad";
import { loadMyTeam } from "@/lib/team";
import { createClub, openStarterPacks } from "@/lib/team-steps";
import { canSeeSport } from "@/lib/visible-sports";

export type ActionResult = { ok: true } | { ok: false; error: string };

const fail = (e: unknown): { ok: false; error: string } => ({
  ok: false,
  error:
    e instanceof z.ZodError
      ? "That choice isn't valid."
      : e instanceof Error
        ? e.message
        : "Something went wrong.",
});

/** Server actions are public endpoints: find the manager and check baseball is open to them on every call. */
async function requireBaseballTeam() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in first.");
  if (!(await canSeeSport("baseball")))
    throw new Error("Baseball isn't open yet.");
  const team = await loadMyTeam(user.id, "baseball");
  if (!team) throw new Error("Create your baseball club first.");
  return team;
}

async function run(step: () => Promise<void>): Promise<ActionResult> {
  try {
    await step();
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Starts the manager's baseball club with its 16 starter packs (D192, D221). */
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

/** For a club made before baseball had packs: its 16 starter packs. */
export async function claimStarterPacks(): Promise<ActionResult> {
  return run(async () =>
    giveBaseballStarterPacksFor(await requireBaseballTeam()),
  );
}

const packIds = z.array(z.uuid()).min(1).max(16);

/** Opens starter packs to scout their players. */
export async function openBaseballPacks(ids: string[]): Promise<ActionResult> {
  return run(async () =>
    openStarterPacks(await requireBaseballTeam(), packIds.parse(ids)),
  );
}

const selection = z.record(
  z.uuid(),
  z.array(z.number().int().min(0).max(4)).max(5),
);

/** Keeps the ticked players (14–30, at least 9 pitchers and 9 batters). */
export async function confirmBaseballStarters(
  chosen: Record<string, number[]>,
): Promise<ActionResult> {
  return run(async () =>
    confirmBaseballStarterSquadFor(
      await requireBaseballTeam(),
      selection.parse(chosen),
    ),
  );
}

const id = z.uuid();
const squadSchema = z.object({
  style: z.enum(["balanced", "batFirst", "gloveFirst"]),
  order: z
    .array(
      z.object({
        id,
        slot: z.enum(["C", "1B", "2B", "3B", "SS", "LF", "CF", "RF", "DH"]),
      }),
    )
    .max(9),
  rotation: z.array(id).max(5),
  bullpen: z.array(id).max(8),
  closer: id.nullable(),
  setup: id.nullable(),
  starterPitchLimit: z.number().int(),
  bench: z
    .array(
      z.object({
        id,
        role: z.enum(["pinchHitter", "pinchRunner", "defense", "injury"]),
        replaces: id.optional(),
      }),
    )
    .max(11),
});

/** Saves the game-day squad; the server checks every rule again. */
export async function saveBaseballSquad(squad: unknown): Promise<ActionResult> {
  return run(async () => {
    const parsed = squadSchema.parse(squad);
    await saveBaseballSquadFor(await requireBaseballTeam(), {
      ...parsed,
      bench: parsed.bench.map((b) =>
        b.replaces
          ? { id: b.id, role: b.role, replaces: b.replaces }
          : { id: b.id, role: b.role },
      ),
    });
  });
}
