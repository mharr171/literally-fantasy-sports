import { createRng } from "@lfs/core";
import { describe, expect, it } from "vitest";
import { baseball, defaultBaseballConfig, harnessTeam } from "../src";

describe("baseball's Sport (ADR 0008)", () => {
  it("plays the real game, never a draw, with no grid", () => {
    expect(baseball.id).toBe("baseball");
    expect(baseball.results.allowsDraws).toBe(false);
    expect(baseball.grid).toBeUndefined();
    expect(baseball.stats.map((s) => s.key)).toContain("era");
    const r = createRng("sport");
    const home = harnessTeam(r.fork("h"), "h", 60);
    const away = harnessTeam(r.fork("a"), "a", 60);
    const g = baseball.simulate(
      { home, away, mode: "league", config: defaultBaseballConfig() },
      1,
    );
    expect(g.result.winner).not.toBeNull();
    expect(g.result.score.home).not.toBe(g.result.score.away);
    expect(g.events.some((e) => e.type === "pitch")).toBe(true);
  });
});
