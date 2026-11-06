import { describe, expect, it } from "vitest";
import { baseball, simulateStandIn } from "../src";

const team = (name: string) => ({
  name,
  battingOrder: Array.from({ length: 9 }, (_, i) => `${name}-${i}`),
});
const input = {
  home: team("Home"),
  away: team("Away"),
  mode: "league" as const,
  config: {},
};

describe("baseball's stand-in (ADR 0007 §12)", () => {
  it("plays the same game from the same seed, never a draw", () => {
    for (let i = 0; i < 200; i++) {
      const a = simulateStandIn(input, `g${i}`);
      expect(simulateStandIn(input, `g${i}`)).toEqual(a);
      expect(a.result.score.home).not.toBe(a.result.score.away);
      expect(a.result.winner).toBe(
        a.result.score.home > a.result.score.away ? "home" : "away",
      );
      const innings = a.events.length / 2;
      expect(innings).toBeGreaterThanOrEqual(9);
      expect(a.result.decidedBy === "extra_innings").toBe(innings > 9);
    }
  });

  it("describes itself as a sport without draws or a grid", () => {
    expect(baseball.id).toBe("baseball");
    expect(baseball.results.allowsDraws).toBe(false);
    expect(baseball.grid).toBeUndefined();
    expect(baseball.simulate(input, 1).result.winner).not.toBeNull();
  });
});
