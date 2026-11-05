"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { createFormation, setFormationEnabled } from "@/lib/formations";

export type FormationResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

async function requireAdminId() {
  const profile = await getCurrentProfile();
  if (!profile?.isAdmin) throw new Error("Only admins can manage formations.");
  return profile.id;
}

const failed = (e: unknown): FormationResult => ({
  ok: false,
  error:
    e instanceof z.ZodError
      ? "That formation doesn't look right."
      : e instanceof Error
        ? e.message
        : "Something went wrong.",
});

const idSchema = z.string().trim().min(1).max(16);
const slotsSchema = z
  .array(
    z.object({
      position: z.string().max(3),
      x: z.number().int().min(0).max(100),
      y: z.number().int().min(0).max(100),
    }),
  )
  .max(20);

/** Creates a formation, on for everyone (D140). It can't be changed afterwards. */
export async function addFormation(
  id: string,
  slots: unknown,
): Promise<FormationResult> {
  try {
    const adminId = await requireAdminId();
    const name = idSchema.parse(id);
    await createFormation(adminId, name, slotsSchema.parse(slots));
    revalidatePath("/admin/formations");
    return { ok: true, message: `${name} is created and on for every club.` };
  } catch (e) {
    return failed(e);
  }
}

/** Turns a formation on or off for every club (D140). */
export async function switchFormation(
  id: string,
  enabled: boolean,
): Promise<FormationResult> {
  try {
    const adminId = await requireAdminId();
    const name = idSchema.parse(id);
    await setFormationEnabled(adminId, name, z.boolean().parse(enabled));
    revalidatePath("/admin/formations");
    return {
      ok: true,
      message: enabled ? `${name} is on.` : `${name} is off for new picks.`,
    };
  } catch (e) {
    return failed(e);
  }
}
