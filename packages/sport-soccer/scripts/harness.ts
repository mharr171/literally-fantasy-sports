// Usage: pnpm --filter @lfs/sport-soccer harness [matches] [seed] [--matchups] [--positions] [--subs]
// --matchups plays with the chosen color matchup strengths (D150).
// --positions plays with the out-of-position penalty (D135).
// --subs plays with logical substitutions (D159).

import {
  formatManDown,
  formatReport,
  runHarness,
  runManDown,
} from "../src/harness";
import {
  defaultSoccerConfig,
  PROPOSED_MATCHUPS,
  PROPOSED_OUT_OF_POSITION,
} from "../src/match";

const args = process.argv.slice(2);
const matchups = args.includes("--matchups");
const positions = args.includes("--positions");
const subs = args.includes("--subs");
const [matchesArg, seedArg] = args.filter((a) => !a.startsWith("--"));
const matches = Number(matchesArg ?? 10_000);
const seed = seedArg ?? "harness";
const base = defaultSoccerConfig();
const config = {
  ...base,
  tuning: {
    ...base.tuning,
    ...(matchups ? PROPOSED_MATCHUPS : {}),
    ...(positions ? { outOfPosition: PROPOSED_OUT_OF_POSITION } : {}),
    ...(subs ? { groupedSubs: 1 } : {}),
  },
};
const started = performance.now();
const report = runHarness({ matches, seed, config });
if (matchups) console.log("Color matchups on (D150 strengths)");
if (positions) console.log("Out-of-position penalty on (D135)");
if (subs) console.log("Logical substitutions on (D159)");
console.log(formatReport(report));
console.log("");
console.log(
  formatManDown(
    runManDown({
      matches: Math.max(200, Math.round(matches / 5)),
      seed,
      config,
    }),
  ),
);
console.log(`\n(${((performance.now() - started) / 1000).toFixed(1)}s)`);
