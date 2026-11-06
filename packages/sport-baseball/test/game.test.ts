import { createRng } from "@lfs/core";
import { describe, expect, it } from "vitest";
import {
  type BaseballConfig,
  type BaseballPlayer,
  type BaseballTeam,
  DEFAULT_PITCH_TUNING,
  defaultBaseballConfig,
  FIELD_POSITIONS,
  generatePlayer,
  MAX_INNINGS,
  simulateGame,
  teamAt,
} from "../src/index";

const team = (seed: string, overall: number, speed?: number): BaseballTeam => {
  const r = createRng(seed);
  const batters = [...FIELD_POSITIONS, "DH" as const].map((pos, i) => {
    const p = generatePlayer(r.fork(`b${i}`), { position: pos, overall });
    return {
      id: `${seed}-${pos}`,
      ...p,
      attributes: speed ? { ...p.attributes, speed } : p.attributes,
    } as BaseballPlayer;
  });
  const pitcher = {
    id: `${seed}-P`,
    ...generatePlayer(r.fork("p"), { position: "P", overall, role: "starter" }),
  } as BaseballPlayer;
  return teamAt(seed, batters, pitcher);
};

const play = (
  home: BaseballTeam,
  away: BaseballTeam,
  seed: string,
  config: BaseballConfig = defaultBaseballConfig(),
) => simulateGame({ home, away, mode: "league", config }, seed);

const tuned = (pitch: Partial<BaseballConfig["pitch"]>): BaseballConfig => ({
  ...defaultBaseballConfig(),
  pitch: { ...DEFAULT_PITCH_TUNING, ...pitch },
});

describe("the baseball game (ADR 0008 §1)", () => {
  const home = team("home", 60);
  const away = team("away", 60);

  it("replays exactly from the seed", () => {
    expect(play(home, away, "s1")).toEqual(play(home, away, "s1"));
    expect(play(home, away, "s1")).not.toEqual(play(home, away, "s2"));
  });

  it("always has a winner, never a draw (D194)", () => {
    for (let i = 0; i < 200; i++) {
      const { result } = play(home, away, `w${i}`);
      expect(result.score.home).not.toBe(result.score.away);
      expect(result.winner).toBe(
        result.score.home > result.score.away ? "home" : "away",
      );
    }
  });

  it("keeps the books straight: runs, hits, the count and pitch counts", () => {
    for (let i = 0; i < 100; i++) {
      const g = play(home, away, `b${i}`);
      const runs = { home: 0, away: 0 };
      const hits = { home: 0, away: 0 };
      const pitches: Record<string, number> = {};
      for (const e of g.events) {
        if (e.type === "pitch") {
          expect(e.balls).toBeLessThanOrEqual(3);
          expect(e.strikes).toBeLessThanOrEqual(2);
          expect(e.outs).toBeLessThanOrEqual(2);
          pitches[e.pitcher] = (pitches[e.pitcher] ?? 0) + 1;
        }
        if (e.type === "play") {
          runs[e.batting] += e.runs;
          if (["single", "double", "triple", "homeRun"].includes(e.result))
            hits[e.batting]++;
        }
      }
      // Runs scored on a play plus none from elsewhere, so they add up.
      expect(runs).toEqual(g.result.score);
      expect(hits).toEqual(g.result.hits);
      expect(pitches).toEqual(g.result.pitches);
      const lineRuns = (s: "home" | "away") =>
        g.result.lineScore[s].reduce((a, b) => a + b, 0);
      expect(lineRuns("home")).toBe(g.result.score.home);
      expect(lineRuns("away")).toBe(g.result.score.away);
    }
  });

  it("skips the home half when the home side already leads, and walks off", () => {
    let skipped = 0;
    let walkOffs = 0;
    for (let i = 0; i < 300; i++) {
      const { result } = play(home, away, `h${i}`);
      const innings = result.lineScore.away.length;
      if (result.lineScore.home.length === innings - 1) {
        skipped++;
        expect(result.winner).toBe("home");
      }
      if (result.winner === "home" && result.lineScore.home.length === innings)
        walkOffs++;
    }
    expect(skipped).toBeGreaterThan(50);
    expect(walkOffs).toBeGreaterThan(10);
  });

  it("plays extra innings with a runner on second from the 10th", () => {
    let extras = 0;
    for (let i = 0; i < 300; i++) {
      const g = play(home, away, `x${i}`);
      if (g.result.lineScore.away.length <= 9) {
        expect(g.result.decidedBy).toBeUndefined();
        continue;
      }
      extras++;
      expect(g.result.decidedBy).toBe("extra_innings");
      const first = g.events.find((e) => e.inning === 10);
      expect(first?.bases[1]).not.toBeNull();
    }
    expect(extras).toBeGreaterThan(10);
  });

  it("lets the stronger side win more often", () => {
    const strong = team("strong", 75);
    let wins = 0;
    for (let i = 0; i < 200; i++)
      if (play(strong, away, `g${i}`).result.winner === "home") wins++;
    expect(wins).toBeGreaterThan(140);
  });

  it("produces every kind of play over enough games", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 300; i++)
      for (const e of play(home, away, `k${i}`).events)
        seen.add(e.type === "play" ? e.result : e.type);
    for (const kind of [
      "strikeout",
      "walk",
      "single",
      "double",
      "triple",
      "homeRun",
      "out",
      "doublePlay",
      "sacFly",
      "error",
      "pitch",
    ])
      expect(seen).toContain(kind);
  });

  it("has fast runners steal, and sometimes get caught", () => {
    const fast = team("fast", 60, 99);
    let safe = 0;
    let caught = 0;
    for (let i = 0; i < 200; i++)
      for (const e of play(fast, away, `st${i}`).events)
        if (e.type === "steal") e.safe ? safe++ : caught++;
    expect(safe).toBeGreaterThan(caught);
    expect(caught).toBeGreaterThan(0);
  });

  it("has the batter at the plate lead off when a runner is caught for the third out", () => {
    const fast = team("fast", 60, 99);
    let checked = 0;
    for (let i = 0; i < 400 && checked < 5; i++) {
      const events = play(fast, away, `cs${i}`).events;
      events.forEach((e, j) => {
        if (e.type !== "steal" || e.safe || e.outs !== 2) return;
        const next = events
          .slice(j + 1)
          .find((p) => p.type === "pitch" && p.batting === e.batting);
        if (next?.type !== "pitch") return;
        expect(next.batter).toBe(e.batter);
        expect(next.inning).toBe(e.inning + 1);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(0);
  });

  it("settles a game nobody can score in on a coin, after the last inning", () => {
    // Every pitch swung at and missed: strikeouts all game.
    const g = play(
      home,
      away,
      "zero",
      tuned({
        swingInZone: 1,
        swingOutOfZone: 1,
        contactInZone: -5,
        contactOutOfZone: -5,
      }),
    );
    expect(g.result.lineScore.away).toHaveLength(MAX_INNINGS);
    expect(g.result.score.home + g.result.score.away).toBe(1);
    expect(g.result.decidedBy).toBe("extra_innings");
  });

  it("stops a half-inning that would never end", () => {
    // Nobody swings and nothing finds the zone: walks forever.
    const g = play(
      home,
      away,
      "walks",
      tuned({
        swingInZone: 0,
        swingOutOfZone: 0,
        missAtZero: 0,
        missAtHundred: 0,
      }),
    );
    expect(g.result.winner).not.toBeNull();
  });
});
