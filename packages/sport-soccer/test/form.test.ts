import { createRng } from "@lfs/core";
import { describe, expect, it } from "vitest";
import { generateAiTeam } from "../src/ai-team";
import {
  DEFAULT_FORM_SETTINGS,
  formLine,
  formModifier,
  matchRating,
  nextForm,
  nextMorale,
  PROPOSED_FORM_WEIGHTS,
} from "../src/form";
import { runFormByLine } from "../src/harness";
import {
  defaultSoccerConfig,
  type PlayerMatchReport,
  simulateMatch,
} from "../src/match";
import { squadToTeam } from "../src/matchday";

const report = (r: Partial<PlayerMatchReport>): PlayerMatchReport => ({
  side: "home",
  minutes: 90,
  energy: 60,
  yellowCards: 0,
  redCard: false,
  injuryWeeks: 0,
  goals: 0,
  assists: 0,
  tackles: 0,
  saves: 0,
  ...r,
});

describe("matchRating", () => {
  it("rewards goals and wins, punishes losses and cards", () => {
    expect(matchRating(report({}), "draw")).toBe(6);
    expect(matchRating(report({ goals: 2 }), "win")).toBe(8.5);
    expect(matchRating(report({ yellowCards: 1 }), "loss")).toBe(5);
    expect(matchRating(report({ redCard: true }), "loss")).toBe(3.5);
    expect(matchRating(report({ goals: 9 }), "win")).toBe(10);
    // A short cameo counts half.
    expect(matchRating(report({ minutes: 10, goals: 1 }), "win")).toBe(6.75);
  });
});

describe("form and morale", () => {
  it("builds form from good games and lets it fade when a player sits out", () => {
    let form = 0;
    for (let i = 0; i < 4; i++)
      form = nextForm(form, report({ goals: 1 }), "win");
    expect(form).toBeGreaterThan(0.5);
    expect(form).toBeLessThanOrEqual(1);
    const rested = nextForm(form, undefined, "win");
    expect(rested).toBeCloseTo(form * 0.8, 3);
    expect(nextForm(0.5, report({ minutes: 0 }), "win")).toBe(0.4);
    expect(nextForm(0.5, report({}), null)).toBe(0.4);
    expect(nextForm(0, report({ redCard: true }), "loss")).toBeLessThan(0);
  });

  it("lifts morale on wins and drops it on losses, within −1 to 1", () => {
    let morale = 0;
    for (let i = 0; i < 10; i++) morale = nextMorale(morale, "win");
    expect(morale).toBeGreaterThan(0.9);
    expect(morale).toBeLessThanOrEqual(1);
    expect(nextMorale(0.5, "draw")).toBe(0.35);
    expect(nextMorale(0, "loss")).toBe(-0.3);
    expect(nextMorale(0.4, null)).toBe(0.4);
  });

  it("turns form and morale into a small skill modifier, at most ±8%", () => {
    expect(formModifier(0, 0)).toBe(0);
    expect(formModifier(1, 1)).toBe(0.08);
    expect(formModifier(-1, -1)).toBe(-0.08);
    expect(formModifier(5, 5)).toBe(0.08);
    expect(
      DEFAULT_FORM_SETTINGS.formEffect + DEFAULT_FORM_SETTINGS.moraleEffect,
    ).toBe(0.08);
  });
});

describe("modifiers in a match", () => {
  it("helps a team in form and records goals per player", () => {
    const config = defaultSoccerConfig();
    let boosted = 0;
    let plain = 0;
    for (let i = 0; i < 300; i++) {
      const h = generateAiTeam(createRng(`fh${i}`), 1500, "h");
      const a = generateAiTeam(createRng(`fa${i}`), 1500, "a");
      const team = (t: typeof h) =>
        squadToTeam(
          t.squad.lineup[0] as string,
          t.squad,
          new Map(t.players.map((p) => [p.id, p])),
        );
      const modifiers = Object.fromEntries(h.players.map((p) => [p.id, 0.08]));
      const seed = `form-${i}`;
      const up = simulateMatch(
        {
          home: { ...team(h), modifiers },
          away: team(a),
          mode: "league",
          config,
        },
        seed,
      );
      const even = simulateMatch(
        { home: team(h), away: team(a), mode: "league", config },
        seed,
      );
      if (up.result.winner === "home") boosted++;
      if (even.result.winner === "home") plain++;
      const goals = Object.values(up.result.players)
        .filter((r) => r.side === "home")
        .reduce((n, r) => n + r.goals, 0);
      expect(goals).toBe(up.result.score.home);
    }
    expect(boosted).toBeGreaterThan(plain);
  });
});

describe("contributions in the match rating (D161)", () => {
  const on = { contributions: true };

  it("change nothing unless switched on", () => {
    const r = report({ assists: 2, tackles: 8, saves: 5 });
    expect(matchRating(r, "draw")).toBe(6);
    expect(DEFAULT_FORM_SETTINGS.contributionRating).toBe(0);
  });

  it("count assists, tackles and saves, with caps", () => {
    expect(matchRating(report({ assists: 2 }), "draw", on)).toBe(7);
    expect(matchRating(report({ tackles: 4 }), "draw", on)).toBeCloseTo(6.4);
    expect(matchRating(report({ tackles: 30 }), "draw", on)).toBe(7);
    expect(matchRating(report({ saves: 4 }), "draw", on)).toBe(7);
    expect(matchRating(report({ saves: 20 }), "draw", on)).toBe(7.5);
  });

  it("reward a clean sheet for keepers and defenders who played an hour", () => {
    const clean = { ...on, conceded: 0 };
    expect(matchRating(report({}), "draw", { ...clean, position: "GK" })).toBe(
      7,
    );
    expect(matchRating(report({}), "draw", { ...clean, position: "CB" })).toBe(
      6.5,
    );
    expect(matchRating(report({}), "draw", { ...clean, position: "ST" })).toBe(
      6,
    );
    expect(
      matchRating(report({ minutes: 45 }), "draw", {
        ...clean,
        position: "GK",
      }),
    ).toBe(6);
    expect(
      matchRating(report({}), "draw", { ...on, conceded: 1, position: "GK" }),
    ).toBe(6);
  });

  it("let a busy keeper build form when switched on", () => {
    const keeper = report({ saves: 6 });
    const off = nextForm(0, keeper, "draw", DEFAULT_FORM_SETTINGS, {
      position: "GK",
      conceded: 0,
    });
    const onForm = nextForm(
      0,
      keeper,
      "draw",
      { ...DEFAULT_FORM_SETTINGS, contributionRating: 1 },
      { position: "GK", conceded: 0 },
    );
    expect(off).toBe(0);
    expect(onForm).toBeGreaterThan(0.3);
  });
});

describe("form by position and minutes (D178)", () => {
  const report = (
    over: Partial<PlayerMatchReport> = {},
  ): PlayerMatchReport => ({
    side: "home",
    minutes: 90,
    energy: 50,
    yellowCards: 0,
    redCard: false,
    injuryWeeks: 0,
    goals: 0,
    assists: 0,
    tackles: 0,
    saves: 0,
    ...over,
  });
  const weights = { ...DEFAULT_FORM_SETTINGS, ...PROPOSED_FORM_WEIGHTS };

  it("weights each stat by the player's line, with today's weights by default", () => {
    const r = report({ tackles: 5, goals: 1 });
    const ctx = { contributions: true, conceded: 1 } as const;
    // The default weights give the same rating as before, on any line.
    for (const position of ["GK", "CB", "CM", "ST"] as const)
      expect(
        matchRating(r, "draw", {
          ...ctx,
          position,
          weights: DEFAULT_FORM_SETTINGS,
        }),
      ).toBeCloseTo(matchRating(r, "draw", { ...ctx, position }));
    // Tuned: a midfielder's tackles count for more than a forward's.
    expect(
      matchRating(r, "draw", { ...ctx, position: "CM", weights }),
    ).toBeGreaterThan(
      matchRating(r, "draw", { ...ctx, position: "ST", weights }),
    );
    expect(formLine("LB")).toBe("DEF");
    expect(formLine("AM")).toBe("MID");
  });

  it("counts a midfielder's clean sheet when tuned, and caps tackles and saves", () => {
    const clean = { contributions: true, conceded: 0, weights } as const;
    expect(
      matchRating(report(), "draw", { ...clean, position: "DM" }),
    ).toBeCloseTo(6 + PROPOSED_FORM_WEIGHTS.cleanSheetMID);
    expect(
      matchRating(report({ tackles: 30 }), "draw", {
        contributions: true,
        conceded: 2,
        position: "CB",
        weights,
      }),
    ).toBeCloseTo(6 + 10 * PROPOSED_FORM_WEIGHTS.tacklesDEF);
  });

  it("moves form in step with minutes when minutes scaling is on", () => {
    const s = { ...DEFAULT_FORM_SETTINGS, minutesScaling: 1 };
    const good = report({ goals: 2 });
    const full = nextForm(0, good, "win", s, { position: "ST" });
    const half = nextForm(0, { ...good, minutes: 45 }, "win", s, {
      position: "ST",
    });
    expect(full).toBeGreaterThan(0);
    expect(half).toBeCloseTo(full / 2, 2);
    // A bad cameo pulls form down a little, not by half a full match.
    const poor = nextForm(
      0.5,
      report({ minutes: 9, yellowCards: 1 }),
      "loss",
      s,
    );
    expect(poor).toBeLessThan(0.5);
    expect(poor).toBeGreaterThan(0.4);
    // Off: the old cameo halving and blend.
    expect(nextForm(0, good, "win")).toBe(
      nextForm(0, good, "win", DEFAULT_FORM_SETTINGS),
    );
  });

  it("the tuned weights level every line's average rating (harness)", () => {
    const r = runFormByLine({
      matches: 400,
      seed: "form-test",
      form: { ...weights, positionWeights: 1 },
    });
    const values = Object.values(r);
    expect(Math.max(...values) - Math.min(...values)).toBeLessThan(0.2);
    const before = Object.values(
      runFormByLine({ matches: 400, seed: "form-test" }),
    );
    expect(Math.max(...before) - Math.min(...before)).toBeGreaterThan(0.3);
  });
});
