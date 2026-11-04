"use server";

import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export type ActionResult<T = null> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const fail = (e: unknown): { ok: false; error: string } => ({
  ok: false,
  error:
    e instanceof z.ZodError
      ? "Enter the 6-digit code from your authenticator app."
      : e instanceof Error
        ? e.message
        : "Something went wrong.",
});

const code = z
  .string()
  .trim()
  .regex(/^\d{6}$/);
const factorId = z.uuid();

/** Server actions are public endpoints: only admin accounts may use these. */
async function adminSession() {
  const profile = await getCurrentProfile();
  if (!profile?.isAdmin) throw new Error("Only admins can do that.");
  return { profile, supabase: await createClient() };
}

async function verifiedFactors(
  supabase: Awaited<ReturnType<typeof createClient>>,
) {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw new Error(error.message);
  return { verified: data.totp, all: data.all };
}

/** Friendlier wording for the codes Supabase sends back. */
function codeError(message: string): Error {
  return /invalid|expired|code/i.test(message)
    ? new Error(
        "That code didn't work. Check the time on your phone and try the newest code.",
      )
    : new Error(message);
}

/**
 * Starts adding an authenticator app: returns a QR code and the secret to
 * type in by hand. The first one can be added with just a sign-in; adding
 * another needs a two-factor sign-in, so a stolen password can't add one.
 */
export async function startEnrollment(): Promise<
  ActionResult<{ factorId: string; qrCode: string; secret: string }>
> {
  try {
    const { profile, supabase } = await adminSession();
    const { verified, all } = await verifiedFactors(supabase);
    if (verified.length > 0 && !profile.twoFactor)
      throw new Error("Enter your current code before adding another app.");
    // Throw away any set-up that was started and never finished.
    for (const f of all)
      if (f.status !== "verified")
        await supabase.auth.mfa.unenroll({ factorId: f.id });
    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      // Names must be unique per account; the minute it was added will do.
      friendlyName: `Authenticator app, ${new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
      })} UTC`,
      issuer: "LiterallyFantasySports",
    });
    if (error) throw new Error(error.message);
    return {
      ok: true,
      data: {
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
      },
    };
  } catch (e) {
    return fail(e);
  }
}

/** Finishes adding an authenticator with its first code; the session becomes two-factor. */
export async function confirmEnrollment(input: {
  factorId: string;
  code: string;
}): Promise<ActionResult> {
  try {
    const { supabase } = await adminSession();
    const id = factorId.parse(input.factorId);
    const { error } = await supabase.auth.mfa.challengeAndVerify({
      factorId: id,
      code: code.parse(input.code),
    });
    if (error) throw codeError(error.message);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

/** Cancels a set-up that was started. */
export async function cancelEnrollment(input: {
  factorId: string;
}): Promise<ActionResult> {
  try {
    const { supabase } = await adminSession();
    const id = factorId.parse(input.factorId);
    const { all } = await verifiedFactors(supabase);
    if (!all.some((f) => f.id === id && f.status !== "verified"))
      throw new Error("Nothing to cancel.");
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) throw new Error(error.message);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}

/** Enters a code from an authenticator app: the session becomes two-factor. */
export async function verifyCode(input: {
  code: string;
}): Promise<ActionResult> {
  try {
    const { supabase } = await adminSession();
    const { verified } = await verifiedFactors(supabase);
    const value = code.parse(input.code);
    if (verified.length === 0)
      throw new Error("Set up an authenticator first.");
    // Any of the admin's apps will do.
    let last = "";
    for (const f of verified) {
      const { error } = await supabase.auth.mfa.challengeAndVerify({
        factorId: f.id,
        code: value,
      });
      if (!error) return { ok: true, data: null };
      last = error.message;
    }
    throw codeError(last);
  } catch (e) {
    return fail(e);
  }
}

/** Removes an authenticator app. Needs a two-factor sign-in, and one must stay. */
export async function removeFactor(input: {
  factorId: string;
}): Promise<ActionResult> {
  try {
    const { profile, supabase } = await adminSession();
    if (!profile.twoFactor) throw new Error("Enter your code first.");
    const id = factorId.parse(input.factorId);
    const { verified } = await verifiedFactors(supabase);
    if (!verified.some((f) => f.id === id)) throw new Error("No such app.");
    if (verified.length < 2)
      throw new Error("Add another app before removing your only one.");
    const { error } = await supabase.auth.mfa.unenroll({ factorId: id });
    if (error) throw new Error(error.message);
    return { ok: true, data: null };
  } catch (e) {
    return fail(e);
  }
}
