import { describe, expect, it } from "vitest";
import { MAX_RUNS_OWED, runsOwed, weeksThisRun } from "../src/ai-schedule";
import { createRng } from "../src/rng";

describe("AI schedule (D114, D177)", () => {
  it("owes runs by time since the last one, capped", () => {
    const now = new Date("2026-11-06T12:00:00Z");
    expect(runsOwed(null, now, 12)).toBe(1);
    expect(runsOwed("2026-11-06T10:00:00Z", now, 12)).toBeCloseTo(1);
    expect(runsOwed("2026-11-06T13:00:00Z", now, 12)).toBe(0);
    expect(runsOwed("2026-11-01T00:00:00Z", now, 12)).toBe(MAX_RUNS_OWED);
  });

  it("plays about a pace's share of a season per run", () => {
    const rng = createRng("weeks");
    let total = 0;
    for (let i = 0; i < 1000; i++)
      total += weeksThisRun(rng, "normal", 12, 26, undefined, 1);
    expect(total / 1000).toBeCloseTo(26 / 12, 1);
    expect(weeksThisRun(createRng("x"), "fast", 1, 26, undefined, 2)).toBe(104);
  });
});
