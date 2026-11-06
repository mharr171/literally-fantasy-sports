import { describe, expect, it } from "vitest";
import { formatPackSpread, runPackSpread } from "../src/pack-spread";
import { DEFAULT_PACK_PRICES } from "../src/roster";

describe("pack spread check (ADR 0006 §4)", () => {
  it("doesn't widen the gap between strong and weak clubs with Elo-scaled packs", () => {
    const rows = runPackSpread({
      seasons: 4,
      clubs: 12,
      seed: "spread-test",
      prices: { ...DEFAULT_PACK_PRICES, eloPerOverall: 40 },
    });
    expect(rows).toHaveLength(5);
    const first = rows[0]?.spread as number;
    const last = rows.at(-1)?.spread as number;
    expect(last).toBeLessThan(first);
    for (const r of rows) {
      expect(r.top).toBeGreaterThanOrEqual(r.bottom);
      expect(r.eloHigh).toBeGreaterThanOrEqual(r.eloLow);
    }
    expect(formatPackSpread("Elo packs", rows)).toMatch(/spread/);
  });
});
