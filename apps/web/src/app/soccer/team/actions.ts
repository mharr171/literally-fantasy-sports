"use server";

import { clubColorsError, normalizeTeamName, teamNameError } from "@lfs/core";
import { BOUGHT_TIERS, PACK_FOCUSES } from "@lfs/sport-soccer";
import { refresh } from "next/cache";
import { z } from "zod";
import type { CreateClubState } from "@/components/create-club-form";
import { getCurrentUser } from "@/lib/auth";
import { loadMyTeam } from "@/lib/team";
import {
  buyPackFor,
  confirmStarterSquadFor,
  createClub,
  openRewardPackFor,
  openStarterPacks,
  removePlayerFor,
  resolvePackFor,
  saveSquadFor,
  setClubColorsFor,
} from "@/lib/team-steps";

export type CreateTeamState = CreateClubState;

export type ActionResult = { ok: true } | { ok: false; error: string };

/** Server actions are public endpoints: find the manager on every call. */
async function requireUser() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in first.");
  return user;
}

async function requireTeam() {
  const user = await requireUser();
  const team = await loadMyTeam(user.id);
  if (!team) throw new Error("Create your team first.");
  return team;
}

const fail = (e: unknown): { ok: false; error: string } => ({
  ok: false,
  error: e instanceof Error ? e.message : "Something went wrong.",
});

/** Runs a step for the manager's team, then refreshes the page. */
async function run(
  step: () => Promise<void>,
  invalid = "That choice isn't valid.",
): Promise<ActionResult> {
  try {
    await step();
    refresh();
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError) return fail(new Error(invalid));
    return fail(e);
  }
}

/** Creates the manager's soccer team with its 22 starter packs (D83). */
export async function createTeam(
  _prev: CreateTeamState,
  formData: FormData,
): Promise<CreateTeamState> {
  const name = normalizeTeamName(String(formData.get("name") ?? ""));
  const colors = formData.getAll("colors").map(String);
  const problem = teamNameError(name) ?? clubColorsError(colors);
  if (problem) return { status: "error", name, colors, message: problem };
  try {
    const user = await requireUser();
    if (!(await loadMyTeam(user.id))) await createClub(user.id, name, colors);
  } catch (e) {
    return { status: "error", name, colors, message: fail(e).error };
  }
  refresh();
  return { status: "idle" };
}

/** Changes the club's colors (D107). */
export async function setClubColors(colors: string[]): Promise<ActionResult> {
  return run(async () => {
    const picked = z.array(z.string().max(20)).max(5).parse(colors);
    await setClubColorsFor(await requireTeam(), picked);
  }, "Those aren't colors.");
}

const packIdsSchema = z.array(z.uuid()).min(1).max(22);

/** Opens starter packs: their players become visible to scout. */
export async function openPacks(packIds: string[]): Promise<ActionResult> {
  return run(async () => {
    const ids = packIdsSchema.parse(packIds);
    await openStarterPacks(await requireTeam(), ids);
  });
}

const selectionSchema = z.record(
  z.uuid(),
  z.array(z.number().int().min(0).max(4)).max(5),
);

/** Keeps the chosen starter-pack players and releases the rest for free (D83). */
export async function confirmStarterSquad(
  selection: Record<string, number[]>,
): Promise<ActionResult> {
  return run(async () => {
    const chosen = selectionSchema.parse(selection);
    await confirmStarterSquadFor(await requireTeam(), chosen);
  }, "That pick isn't valid.");
}

const buySchema = z.object({
  tier: z.enum(BOUGHT_TIERS.map((t) => t.id) as [string, ...string[]]),
  focus: z.enum(PACK_FOCUSES),
  // Chemistry colors to leave out (D180), checked again in the game step.
  excluded: z.array(z.number().int().min(0).max(4)).max(3).default([]),
});

/** Buys a pack (D47); it opens straight away for keep-or-sell choices. */
export async function buyPack(input: {
  tier: string;
  focus: string;
  excluded?: number[];
}): Promise<ActionResult> {
  return run(async () => {
    const { tier, focus, excluded } = buySchema.parse(input);
    await buyPackFor(await requireTeam(), tier, focus, excluded);
  }, "That pack isn't for sale.");
}

const rewardSchema = z.object({ packId: z.uuid() });

/** Opens one of the club's reward packs from the playoffs (D181). */
export async function openRewardPack(input: {
  packId: string;
}): Promise<ActionResult> {
  return run(async () => {
    const { packId } = rewardSchema.parse(input);
    await openRewardPackFor(await requireTeam(), packId);
  }, "That reward pack can't be opened.");
}

const resolveSchema = z.object({
  packId: z.uuid(),
  kept: z.array(z.number().int().min(0).max(4)).max(5),
});

/** Keeps the chosen players from the open pack and bulk-resells the rest (D49). */
export async function resolvePack(input: {
  packId: string;
  kept: number[];
}): Promise<ActionResult> {
  return run(async () => {
    const { packId, kept } = resolveSchema.parse(input);
    await resolvePackFor(await requireTeam(), packId, kept);
  });
}

const removeSchema = z.object({
  playerId: z.uuid(),
  mode: z.enum(["release", "sell"]),
});

/** Releases a player for free or bulk-sells them for 25% of worth (D49, D85). */
export async function removePlayer(input: {
  playerId: string;
  mode: "release" | "sell";
}): Promise<ActionResult> {
  return run(async () => {
    const { playerId, mode } = removeSchema.parse(input);
    await removePlayerFor(await requireTeam(), playerId, mode);
  });
}

const squadSchema = z.object({
  formation: z.string().max(20),
  lineup: z.array(z.uuid()).max(11),
  bench: z.array(z.uuid()).max(11),
  subPlan: z
    .array(
      z.object({
        minute: z.number().int(),
        outId: z.uuid(),
        inId: z.uuid(),
      }),
    )
    .max(5),
});

/** Saves the matchday squad after checking it with the engine (D88). */
export async function saveSquad(
  input: z.input<typeof squadSchema>,
): Promise<ActionResult> {
  return run(async () => {
    const squad = squadSchema.parse(input);
    await saveSquadFor(await requireTeam(), squad);
  }, "That squad isn't valid.");
}
