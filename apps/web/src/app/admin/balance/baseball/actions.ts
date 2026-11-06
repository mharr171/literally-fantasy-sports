"use server";

import {
  BASEBALL_SETTING_PATHS,
  baseballConfigFromValues,
  baseballConfigToRows,
  baseballSettingsErrors,
  formatReport,
  type HarnessReport,
  runHarness,
} from "@lfs/sport-baseball";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCurrentProfile } from "@/lib/auth";
import { publishDraft, saveDraftRows } from "@/lib/config-drafts";
import {
  listSoccerVersions as listVersions,
  liveVersion,
  loadVersionValues,
} from "@/lib/soccer-templates";
import type { ActionResult } from "../../templates/actions";

const BASEBALL = "baseball";

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

const inputSchema = z.object({
  baseVersion: z.number().int().positive().nullable(),
  note: z.string().trim().max(200),
  values: z.record(z.string(), z.number().finite()),
});

export type BaseballBalanceInput = z.infer<typeof inputSchema>;

/** The values as sent, checked: known paths only, every limit respected. */
function parse(input: BaseballBalanceInput) {
  const { baseVersion, note, values } = inputSchema.parse(input);
  const unknown = Object.keys(values).filter(
    (k) => !BASEBALL_SETTING_PATHS.includes(k),
  );
  if (unknown.length > 0) throw new Error(`Unknown setting: ${unknown[0]}.`);
  const errors = baseballSettingsErrors(values);
  if (errors.length > 0) throw new Error(errors.join(" "));
  return { baseVersion, note, config: baseballConfigFromValues(values) };
}

/** Saves baseball's settings to a draft version under the baseball scope. */
export async function saveBaseballBalance(
  input: BaseballBalanceInput,
): Promise<ActionResult<{ version: number }>> {
  try {
    await assertAdmin();
    const { baseVersion, note, config } = parse(input);
    const version = await saveDraftRows(
      baseVersion,
      note,
      "Baseball balance",
      baseballConfigToRows(config),
      BASEBALL,
    );
    revalidatePath("/admin/balance/baseball");
    return { ok: true, data: { version } };
  } catch (e) {
    return fail(e);
  }
}

export interface BaseballTest {
  draft: HarnessReport;
  live: HarnessReport;
  liveLabel: string;
  text: { draft: string; live: string };
}

const TEST_GAMES = 600;
const TEST_GAP_GAMES = 60;

/** Plays sample games with the edited settings and with the live ones. */
export async function testBaseballBalance(
  input: BaseballBalanceInput,
): Promise<ActionResult<BaseballTest>> {
  try {
    await assertAdmin();
    const { config } = parse(input);
    const live = liveVersion(await listVersions(BASEBALL));
    const liveConfig = baseballConfigFromValues(
      live ? await loadVersionValues(live, BASEBALL) : {},
    );
    const draft = runHarness(
      TEST_GAMES,
      "admin-test",
      config,
      undefined,
      TEST_GAP_GAMES,
    );
    const liveReport = runHarness(
      TEST_GAMES,
      "admin-test",
      liveConfig,
      undefined,
      TEST_GAP_GAMES,
    );
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

/** Makes a baseball draft live. Published versions can never change again. */
export async function publishBaseballBalance(
  version: number,
): Promise<ActionResult<{ version: number }>> {
  try {
    await assertAdmin();
    await publishDraft(z.number().int().positive().parse(version), BASEBALL);
    revalidatePath("/admin/balance/baseball");
    return { ok: true, data: { version } };
  } catch (e) {
    return fail(e);
  }
}
