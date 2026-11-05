import { createRng } from "@lfs/core";
import { describe, expect, it } from "vitest";
import { generateTeam } from "../src/harness";
import {
  defaultSoccerConfig,
  type SoccerEvent,
  simulateMatch,
} from "../src/match";

const base = defaultSoccerConfig();
const on = { ...base, tuning: { ...base.tuning, groupedSubs: 1 } };

/** Distinct minutes each side made substitutions in. */
const windows = (events: SoccerEvent[], side: "home" | "away") =>
  new Set(
    events
      .filter((e) => e.type === "sub" && e.side === side)
      .map((e) => e.minute),
  ).size;
const subs = (events: SoccerEvent[], side: "home" | "away") =>
  events.filter((e) => e.type === "sub" && e.side === side).length;

describe("logical substitutions (D159)", () => {
  it("are off by default", () => {
    expect(base.tuning.groupedSubs).toBe(0);
  });

  it("use more of the 5 subs, never more than 3 windows", () => {
    let usedAllOff = 0;
    let usedAllOn = 0;
    for (let i = 0; i < 300; i++) {
      const r = createRng(`gs-${i}`);
      const home = generateTeam(r, `h${i}`, 60);
      const away = generateTeam(r, `a${i}`, 60);
      const play = (config: typeof base) =>
        simulateMatch({ home, away, mode: "league", config }, `gs-seed-${i}`)
          .events;
      const offEvents = play(base);
      const onEvents = play(on);
      for (const side of ["home", "away"] as const) {
        expect(windows(onEvents, side)).toBeLessThanOrEqual(
          on.tuning.maxSubWindows,
        );
        expect(subs(onEvents, side)).toBeLessThanOrEqual(on.tuning.maxSubs);
        if (subs(offEvents, side) === 5) usedAllOff++;
        if (subs(onEvents, side) === 5) usedAllOn++;
      }
    }
    expect(usedAllOn).toBeGreaterThan(usedAllOff * 1.4);
  });

  it("still covers an injury straight away", () => {
    const r = createRng("gs-injury");
    const home = generateTeam(r, "h", 60);
    const away = generateTeam(r, "a", 60);
    const config = { ...on, tuning: { ...on.tuning, injuryRate: 0.05 } };
    const { events } = simulateMatch(
      { home, away, mode: "league", config },
      "gs-injury",
    );
    const injury = events.find((e) => e.type === "injury");
    expect(injury).toBeDefined();
    if (injury?.type !== "injury") return;
    const cover = events.find(
      (e) => e.type === "sub" && e.outId === injury.playerId,
    );
    // Covered in the same minute, unless subs had already run out.
    if (cover) expect(cover.minute).toBe(injury.minute);
  });
});
