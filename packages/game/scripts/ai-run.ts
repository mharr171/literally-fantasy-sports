/**
 * The scheduled AI run (D114, ADR 0002): `.github/workflows/ai-world.yml`
 * runs this every 2 hours against lfs-prod. Needs SUPABASE_URL and
 * SUPABASE_SECRET_KEY. Exits non-zero (so GitHub emails) only when the run
 * itself fails or most clubs hit a problem; one club's problem is logged.
 */
import { runAiWorld } from "../src/ai-clubs";

const budgetMinutes = Number(process.env.AI_RUN_MINUTES ?? 20);

const run = await runAiWorld({ budgetMs: budgetMinutes * 60_000 });
if (run.status === "disabled") {
  console.log(
    "The AI world is switched off (Admin → AI clubs). Nothing to do.",
  );
} else {
  console.log(
    `AI clubs: ${run.clubs} (${run.created} new). Turns: ${run.ran}, left for next run: ${run.skipped}. Weeks played: ${run.weeksPlayed}.`,
  );
  for (const e of run.errors) console.log(`  problem: ${e}`);
  if (run.errors.length > 0 && run.errors.length * 2 >= Math.max(1, run.ran)) {
    console.error("Most clubs hit a problem: see above.");
    process.exitCode = 1;
  }
}
