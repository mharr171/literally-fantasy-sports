"use server";

import {
  type BalanceSettings,
  BOUGHT_TIERS,
  balanceErrors,
  balanceFromValues,
  balanceToRows,
  formatReport,
  runHarness,
  soccerConfigFromValues,
} from "@lfs/sport-soccer";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { publishDraft, saveDraftRows } from "@/lib/config-drafts";
import {
  listSoccerVersions,
  liveVersion,
  loadVersionValues,
} from "@/lib/soccer-templates";
import type { ActionResult, TestResult } from "../templates/actions";

/** Server actions are public endpoints: re-check admin on every call. */
async function assertAdmin() {
  const profile = await getCurrentProfile();
  if (!profile?.isAdmin)
    throw new Error("Only admins can change game settings.");
}

const fail = (e: unknown): { ok: false; error: string } => ({
  ok: false,
  error:
    e instanceof z.ZodError
      ? "Some values aren't numbers."
      : e instanceof Error
        ? e.message
        : "Something went wrong.",
});

const num = z.number().finite();
const inputSchema = z.object({
  baseVersion: z.number().int().positive().nullable(),
  note: z.string().trim().max(200),
  settings: z.object({
    // Numbers, plus the color cycle (D149).
    tuning: z
      .object({ colorCycle: z.array(z.number().int()).max(10).optional() })
      .catchall(num),
    payouts: z.record(z.string(), num),
    packs: z.object({
      tiers: z.record(z.string(), num),
      focusSurcharge: num,
    }),
    // Recovery, bans, form and morale (D158).
    condition: z.record(z.string(), num),
    form: z.record(z.string(), num),
  }),
});

export type BalanceInput = {
  baseVersion: number | null;
  note: string;
  settings: BalanceSettings;
};

/** The settings as sent, checked: only known fields, every limit respected. */
function parse(input: BalanceInput) {
  const { baseVersion, note, settings } = inputSchema.parse(input);
  const tiers = BOUGHT_TIERS.map((t) => t.id);
  if (Object.keys(settings.packs.tiers).some((k) => !tiers.includes(k)))
    throw new Error("Unknown pack tier.");
  // Only known fields are kept.
  const clean = balanceFromValues(settings);
  const errors = balanceErrors(clean);
  if (errors.length > 0) throw new Error(errors.join(" "));
  return { baseVersion, note, settings: clean };
}

/**
 * Saves match tuning, payouts, pack prices, recovery and bans, and form and
 * morale to a draft (M5, D158). Every other
 * setting (templates, variants) comes along from the version it started from.
 */
export async function saveBalance(
  input: BalanceInput,
): Promise<ActionResult<{ version: number }>> {
  try {
    await assertAdmin();
    const { baseVersion, note, settings } = parse(input);
    const version = await saveDraftRows(
      baseVersion,
      note,
      "Balance changes",
      balanceToRows(settings),
    );
    revalidatePath("/admin/balance");
    revalidatePath("/admin/templates");
    revalidatePath("/admin/settings");
    return { ok: true, data: { version } };
  } catch (e) {
    return fail(e);
  }
}

const TEST_MATCHES = 1500;

/** Plays sample matches with the edited tuning and with the live settings. */
export async function testBalance(
  input: BalanceInput,
): Promise<ActionResult<TestResult>> {
  try {
    await assertAdmin();
    const { baseVersion, settings } = parse(input);
    const versions = await listSoccerVersions();
    const live = liveVersion(versions);
    const liveValues = live ? await loadVersionValues(live) : {};
    const baseValues =
      baseVersion && baseVersion !== live
        ? await loadVersionValues(baseVersion)
        : liveValues;
    const draftValues: Record<string, unknown> = { ...baseValues };
    for (const row of balanceToRows(settings)) draftValues[row.key] = row.value;
    const seed = "balance-test";
    const draft = runHarness({
      matches: TEST_MATCHES,
      seed,
      config: soccerConfigFromValues("draft", draftValues),
    });
    const liveReport = runHarness({
      matches: TEST_MATCHES,
      seed,
      config: soccerConfigFromValues(
        live ? `soccer:${live}` : "defaults",
        liveValues,
      ),
    });
    return {
      ok: true,
      data: {
        draft,
        live: liveReport,
        liveLabel: live ? `Live (version ${live})` : "Built-in defaults",
        text: { draft: formatReport(draft), live: formatReport(liveReport) },
      },
    };
  } catch (e) {
    return fail(e);
  }
}

/** Makes a draft live. Published versions can never change again. */
export async function publishBalance(
  version: number,
): Promise<ActionResult<{ version: number }>> {
  try {
    await assertAdmin();
    await publishDraft(z.number().int().positive().parse(version));
    revalidatePath("/admin/balance");
    revalidatePath("/admin/templates");
    revalidatePath("/admin/settings");
    return { ok: true, data: { version } };
  } catch (e) {
    return fail(e);
  }
}
