// Usage: pnpm --filter @lfs/sport-soccer harness [matches] [seed] [--matchups]
// --matchups plays with ADR 0003's proposed color matchup strengths.

import { formatReport, runHarness } from "../src/harness";
import { defaultSoccerConfig, PROPOSED_MATCHUPS } from "../src/match";

const args = process.argv.slice(2);
const matchups = args.includes("--matchups");
const [matchesArg, seedArg] = args.filter((a) => !a.startsWith("--"));
const matches = Number(matchesArg ?? 10_000);
const seed = seedArg ?? "harness";
const base = defaultSoccerConfig();
const config = matchups
  ? { ...base, tuning: { ...base.tuning, ...PROPOSED_MATCHUPS } }
  : base;
const started = performance.now();
const report = runHarness({ matches, seed, config });
if (matchups) console.log("Color matchups on (ADR 0003 proposed strengths)\n");
console.log(formatReport(report));
console.log(`\n(${((performance.now() - started) / 1000).toFixed(1)}s)`);
