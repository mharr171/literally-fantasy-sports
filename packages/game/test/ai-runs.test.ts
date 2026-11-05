import { describe, expect, it } from "vitest";
import { runAiTurns } from "../src/ai-clubs";

const clubs = Array.from({ length: 10 }, (_, i) => ({
  id: `c${i}`,
  // c9 waited longest, c0 played most recently.
  energyUpdatedAt: `2026-11-05T00:${String(59 - i).padStart(2, "0")}:00Z`,
}));

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

describe("runAiTurns (D114)", () => {
  it("gives every club its turn, longest-waiting first", async () => {
    const order: string[] = [];
    const run = await runAiTurns(clubs, () => 2, {
      budgetMs: 10_000,
      concurrency: 1,
      turn: async (teamId, weeks) => {
        order.push(teamId);
        return { teamId, weeksPlayed: weeks, notes: [] };
      },
    });
    expect(order[0]).toBe("c9");
    expect(order.at(-1)).toBe("c0");
    expect(run).toMatchObject({ ran: 10, skipped: 0, weeksPlayed: 20 });
  });

  it("stops starting turns when the time is up, leaving the rest for next time", async () => {
    const run = await runAiTurns(clubs, () => 1, {
      budgetMs: 25,
      concurrency: 2,
      turn: async (teamId) => {
        await sleep(20);
        return { teamId, weeksPlayed: 1, notes: [] };
      },
    });
    expect(run.ran).toBeGreaterThan(0);
    expect(run.ran).toBeLessThan(10);
    expect(run.ran + run.skipped).toBe(10);
  });

  it("reports a club's problem without stopping the others", async () => {
    const run = await runAiTurns(clubs.slice(0, 3), () => 1, {
      budgetMs: 10_000,
      turn: async (teamId) =>
        teamId === "c1"
          ? { teamId, weeksPlayed: 0, notes: [], error: "Out of luck" }
          : { teamId, weeksPlayed: 1, notes: [] },
    });
    expect(run.ran).toBe(3);
    expect(run.turns.filter((t) => t.error)).toHaveLength(1);
  });
});
