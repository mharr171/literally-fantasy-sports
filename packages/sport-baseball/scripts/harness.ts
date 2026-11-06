// Usage: pnpm --filter @lfs/sport-baseball harness [games] [seed]
// Plays even games between generated clubs with auto-picked squads and
// prints each ADR 0008 §10 target next to its number.
import { formatReport, runHarness } from "../src/harness";

const games = Number(process.argv[2] ?? 2000);
const seed = process.argv[3] ?? "harness";
const t0 = performance.now();
console.log(formatReport(runHarness(games, seed)));
console.log(`(${((performance.now() - t0) / 1000).toFixed(1)}s)`);
