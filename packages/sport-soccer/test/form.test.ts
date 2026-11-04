import { createRng } from "@lfs/core";
import { describe, expect, it } from "vitest";
import { generateAiTeam } from "../src/ai-team";
import {
  DEFAULT_FORM_SETTINGS,
  formModifier,
  matchRating,
  nextForm,
  nextMorale,
} from "../src/form";
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
