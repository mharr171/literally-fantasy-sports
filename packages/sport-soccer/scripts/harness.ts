// Usage: pnpm --filter @lfs/sport-soccer harness [matches] [seed]
import { formatReport, runHarness } from "../src/harness";

const matches = Number(process.argv[2] ?? 10_000);
const seed = process.argv[3] ?? "harness";
const started = performance.now();
const report = runHarness({ matches, seed });
console.log(formatReport(report));
console.log(`\n(${((performance.now() - started) / 1000).toFixed(1)}s)`);
