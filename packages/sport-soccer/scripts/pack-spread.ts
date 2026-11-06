// Usage: pnpm --filter @lfs/sport-soccer pack-spread [seasons] [clubs] [seed]
// The check before Elo-scaled packs go on (ADR 0006 §4): the strength gap
// between the top and bottom clubs, with packs flat and with packs at Elo.
import { formatPackSpread, runPackSpread } from "../src/pack-spread";
import { DEFAULT_PACK_PRICES, PROPOSED_ELO_PER_OVERALL } from "../src/roster";

const [seasonsArg, clubsArg, seedArg] = process.argv.slice(2);
const seasons = Number(seasonsArg ?? 10);
const clubs = Number(clubsArg ?? 24);
const seed = seedArg ?? "pack-spread";
const started = performance.now();
for (const [label, eloPerOverall] of [
  ["Packs flat (today)", 0],
  [
    `Packs at Elo (${PROPOSED_ELO_PER_OVERALL} Elo per overall point)`,
    PROPOSED_ELO_PER_OVERALL,
  ],
] as const) {
  const rows = runPackSpread({
    seasons,
    clubs,
    seed,
    prices: { ...DEFAULT_PACK_PRICES, eloPerOverall },
  });
  console.log(formatPackSpread(label, rows));
  console.log("");
}
console.log(`(${((performance.now() - started) / 1000).toFixed(1)}s)`);
