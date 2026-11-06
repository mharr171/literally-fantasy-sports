import { createRng, statValue } from "@lfs/core";
import { describe, expect, it } from "vitest";
import {
  autoPickSquad,
  BASEBALL_STATS,
  type BaseballPlayer,
  type BaseballTeam,
  batterRating,
  boxScore,
  DEFAULT_FORM_WEIGHTS,
  DEFAULT_PITCH_TUNING,
  defaultBaseballConfig,
  gameStats,
  generatePlayer,
  POSITIONS,
  pitcherRating,
  simulateGame,
} from "../src/index";

const make = (seed: string): BaseballTeam => {
  const r = createRng(seed);
  const roster: BaseballPlayer[] = [
    ...POSITIONS.filter((p) => p !== "P").flatMap((pos, i) =>
      [0, 1].map(
        (k) =>
          ({
            id: `${seed}-${pos}-${k}`,
            ...generatePlayer(r.fork(`${i}${k}`), {
              position: pos,
              overall: 55 + k * 5,
            }),
          }) as BaseballPlayer,
      ),
    ),
    ...Array.from(
      { length: 13 },
      (_, i) =>
        ({
          id: `${seed}-P${i}`,
          ...generatePlayer(r.fork(`p${i}`), {
            position: "P",
            overall: 60,
            role: i < 5 ? "starter" : "reliever",
          }),
        }) as BaseballPlayer,
    ),
  ];
  const s = autoPickSquad(roster);
  return {
    id: seed,
    batters: s.batters,
    pitcher: s.rotation[0] as BaseballPlayer,
    bullpen: s.bullpen,
    bench: s.bench,
  };
};
const home = make("sh");
const away = make("sa");
const play = (seed: string, config = defaultBaseballConfig()) =>
  simulateGame({ home, away, mode: "league", config }, seed);
const sum = <T>(xs: readonly T[], f: (x: T) => number) =>
  xs.reduce((a, x) => a + f(x), 0);

describe("the box score (D204)", () => {
  it("adds up to the result: runs, hits, outs and pitches", () => {
    for (let i = 0; i < 150; i++) {
      const g = play(`box${i}`);
      const box = boxScore(g);
      for (const side of ["home", "away"] as const) {
        const fielding = side === "home" ? "away" : "home";
        expect(sum(box.batters[side], (b) => b.h)).toBe(g.result.hits[side]);
        expect(sum(box.batters[side], (b) => b.r)).toBe(g.result.score[side]);
        expect(sum(box.pitchers[fielding], (p) => p.r)).toBe(
          g.result.score[side],
        );
        for (const p of box.pitchers[fielding])
          expect(p.er).toBeLessThanOrEqual(p.r);
        // Every out the defence made is some pitcher's.
        const outs = sum(box.pitchers[fielding], (p) => p.outs);
        const innings = g.result.lineScore[side].length;
        expect(outs).toBeLessThanOrEqual(innings * 3);
        expect(outs).toBeGreaterThanOrEqual((innings - 1) * 3);
        expect(sum(box.pitchers[fielding], (p) => p.pitches)).toBe(
          sum(box.pitchers[fielding], (p) => g.result.pitches[p.id] ?? 0),
        );
      }
      // About 2 KB stored (D204).
      expect(JSON.stringify(box).length).toBeLessThan(3500);
    }
  });

  it("gives the win to the winners, the loss to the losers, and the save to neither", () => {
    let saves = 0;
    let relieverWins = 0;
    for (let i = 0; i < 300; i++) {
      const g = play(`dec${i}`);
      const box = boxScore(g);
      const w = g.result.winner as "home" | "away";
      const l = w === "home" ? "away" : "home";
      const ids = (s: "home" | "away") => box.pitchers[s].map((p) => p.id);
      expect(ids(w)).toContain(box.decisions.win);
      expect(ids(l)).toContain(box.decisions.loss);
      if (box.decisions.save) {
        saves++;
        expect(ids(w)).toContain(box.decisions.save);
        expect(box.decisions.save).not.toBe(box.decisions.win);
      }
      if (box.decisions.win !== ids(w)[0]) relieverWins++;
    }
    expect(saves).toBeGreaterThan(30);
    expect(relieverWins).toBeGreaterThan(20);
  });

  it("marks runs unearned after errors (D214)", () => {
    // Lots of errors: many runs are unearned.
    const config = defaultBaseballConfig();
    const sloppy = {
      ...config,
      pitch: { ...DEFAULT_PITCH_TUNING, errorRate: 0.4 },
    };
    let runs = 0;
    let earned = 0;
    for (let i = 0; i < 60; i++) {
      const box = boxScore(play(`err${i}`, sloppy));
      for (const side of ["home", "away"] as const)
        for (const p of box.pitchers[side]) {
          runs += p.r;
          earned += p.er;
        }
    }
    expect(earned).toBeLessThan(runs * 0.8);
  });

  it("counts the extra-inning runner on second as unearned", () => {
    for (let i = 0; i < 400; i++) {
      const g = play(`xi${i}`);
      const placed = g.events.find((e) => e.inning === 10)?.bases[1];
      if (!placed) continue;
      const run = g.events
        .flatMap((e) => (e.type === "play" && e.inning === 10 ? e.scored : []))
        .find((r) => r.runner === placed);
      if (run) {
        expect(run.earned).toBe(false);
        return;
      }
    }
    throw new Error("no extra-inning runner scored in 400 games");
  });
});

describe("stats by key and form (D202)", () => {
  it("turns a box score into stat totals that rates read", () => {
    const box = boxScore(play("st1"));
    const stats = gameStats(box);
    const totals: Record<string, number> = {};
    for (const row of Object.values(stats))
      for (const [k, v] of Object.entries(row))
        totals[k] = (totals[k] ?? 0) + v;
    expect(totals.wins).toBe(1);
    expect(totals.losses).toBe(1);
    expect(totals.hits).toBe(box.hits.home + box.hits.away);
    const avg = BASEBALL_STATS.find((s) => s.key === "avg");
    const era = BASEBALL_STATS.find((s) => s.key === "era");
    if (!avg || !era) throw new Error("missing rates");
    expect(statValue(avg, { hits: 3, atBats: 10 })).toBeCloseTo(0.3);
    expect(statValue(era, { earnedRuns: 3, outs: 27 })).toBeCloseTo(3);
    expect(statValue(era, {})).toBeNull();
  });

  it("rates every player 1–10, better games higher", () => {
    const box = boxScore(play("st2"));
    for (const side of ["home", "away"] as const) {
      for (const b of box.batters[side]) {
        const r = batterRating(b, "LF");
        expect(r).toBeGreaterThanOrEqual(1);
        expect(r).toBeLessThanOrEqual(10);
      }
      for (const p of box.pitchers[side]) {
        const r = pitcherRating(p, box.decisions);
        expect(r).toBeGreaterThanOrEqual(1);
        expect(r).toBeLessThanOrEqual(10);
      }
    }
    const blank = {
      id: "x",
      ab: 4,
      r: 0,
      h: 0,
      doubles: 0,
      triples: 0,
      hr: 0,
      rbi: 0,
      bb: 0,
      k: 2,
      sb: 0,
    };
    const great = { ...blank, h: 3, hr: 2, rbi: 4, r: 2, k: 0 };
    expect(batterRating(great, "1B")).toBeGreaterThan(
      batterRating(blank, "1B"),
    );
    // A position offset moves the rating.
    expect(
      batterRating(blank, "C", { ...DEFAULT_FORM_WEIGHTS, offset: { C: 0.5 } }),
    ).toBeCloseTo(batterRating(blank, "C") + 0.5);
  });
});
