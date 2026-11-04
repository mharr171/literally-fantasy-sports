"use server";

import {
  formatReport,
  type HarnessReport,
  runHarness,
  soccerConfigFromValues,
  templatesToRows,
  variantsToRows,
} from "@lfs/sport-soccer";
import { revalidatePath } from "next/cache";
import { assertAdminAction } from "@/lib/auth";
import { publishDraft, saveDraftRows } from "@/lib/config-drafts";
import {
  listSoccerVersions,
  liveVersion,
  loadVersionValues,
} from "@/lib/soccer-templates";
import { type SaveInput, saveInputSchema, templatesSchema } from "./schema";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const fail = (e: unknown): { ok: false; error: string } => ({
  ok: false,
  error: e instanceof Error ? e.message : "Something went wrong.",
});

/**
 * Saves the templates. Editing a draft updates it in place; editing the
 * live version or the defaults creates a new draft, copying every other
 * setting (e.g. tuning) from the version it started from.
 */
export async function saveTemplates(
  input: SaveInput,
): Promise<ActionResult<{ version: number }>> {
  try {
    await assertAdminAction();
    const { baseVersion, note, templates, variants, enabled } =
      saveInputSchema.parse(input);
    const version = await saveDraftRows(baseVersion, note, "Template edits", [
      ...templatesToRows(templates),
      ...variantsToRows(variants, enabled),
    ]);

    revalidatePath("/admin/templates");
    revalidatePath("/admin/balance");
    revalidatePath("/admin/settings");
    return { ok: true, data: { version } };
  } catch (e) {
    return fail(e);
  }
}

export interface TestResult {
  draft: HarnessReport;
  live: HarnessReport;
  liveLabel: string;
  text: { draft: string; live: string };
}

const TEST_MATCHES = 1500;

/**
 * Plays sample matches with the edited templates and with the live settings,
 * using the same seed so the only difference is the templates.
 */
export async function testTemplates(
  input: SaveInput,
): Promise<ActionResult<TestResult>> {
  try {
    await assertAdminAction();
    const { baseVersion, templates, variants, enabled } =
      saveInputSchema.parse(input);
    const versions = await listSoccerVersions();
    const live = liveVersion(versions);
    const liveValues = live ? await loadVersionValues(live) : {};
    const baseValues =
      baseVersion && baseVersion !== live
        ? await loadVersionValues(baseVersion)
        : liveValues;

    const draftValues: Record<string, unknown> = { ...baseValues };
    for (const row of [
      ...templatesToRows(templatesSchema.parse(templates)),
      ...variantsToRows(variants, enabled),
    ]) {
      draftValues[row.key] = row.value;
    }
    const seed = "template-test";
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
export async function publishVersion(
  version: number,
): Promise<ActionResult<{ version: number }>> {
  try {
    await assertAdminAction();
    await publishDraft(version);
    revalidatePath("/admin/templates");
    revalidatePath("/admin/balance");
    revalidatePath("/admin/settings");
    return { ok: true, data: { version } };
  } catch (e) {
    return fail(e);
  }
}
