import { describe, expect, it } from "vitest";
import { seasonScorers } from "../src/history";

const goal = (side: "home" | "away", player: string) => ({
  minute: 10,
  type: "goal" as const,
  side,
  player,
});

describe("season scorers (ADR 0005)", () => {
  it("counts only the club's own goals in its own matches", () => {
    const fixture = (
      homeSlot: number,
      awaySlot: number,
      events: ReturnType<typeof goal>[],
    ) => ({
      homeSlot,
      awaySlot,
      summary: { possession: {}, shots: {}, events },
    });
    const scorers = seasonScorers({
      fixtures: [
        // Our club (slot 0) at home: two for Romano, one against us.
        fixture(0, 3, [
          goal("home", "Romano"),
          goal("home", "Romano"),
          goal("away", "Ade"),
        ]),
        // Away: Cisse scores for us.
        fixture(5, 0, [goal("away", "Cisse"), goal("home", "Romano")]),
        // Someone else's match.
        fixture(4, 6, [goal("home", "Cisse")]),
        // Not played yet.
        { homeSlot: 0, awaySlot: 7, summary: null },
      ],
    } as never);
    expect(scorers).toEqual([
      { name: "Romano", goals: 2 },
      { name: "Cisse", goals: 1 },
    ]);
  });
});
