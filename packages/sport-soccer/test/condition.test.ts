import { createRng } from "@lfs/core";
import { describe, expect, it } from "vitest";
import { generateAiTeam } from "../src/ai-team";
import {
  availableSquad,
  FRESH,
  isAvailable,
  nextCondition,
  type PlayerCondition,
  seasonReset,
} from "../src/condition";
import {
  defaultSoccerConfig,
  type PlayerMatchReport,
  simulateMatch,
} from "../src/match";
import { squadProblems, squadToTeam } from "../src/matchday";

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

describe("nextCondition", () => {
  it("recovers 20 fitness a week from where the match left a player", () => {
    expect(nextCondition(FRESH, report({ energy: 62 })).fitness).toBe(82);
    expect(nextCondition({ ...FRESH, fitness: 70 }, undefined).fitness).toBe(
      90,
    );
    expect(nextCondition({ ...FRESH, fitness: 95 }, undefined).fitness).toBe(
      100,
    );
  });

  it("counts injuries and bans down, then adds new ones", () => {
    const hurt: PlayerCondition = {
      ...FRESH,
      injuredWeeks: 2,
      suspendedWeeks: 1,
    };
    expect(nextCondition(hurt, undefined)).toMatchObject({
      injuredWeeks: 1,
      suspendedWeeks: 0,
    });
    expect(nextCondition(FRESH, report({ injuryWeeks: 3 })).injuredWeeks).toBe(
      3,
    );
    expect(
      nextCondition(FRESH, report({ redCard: true, yellowCards: 2 })),
    ).toMatchObject({
      suspendedWeeks: 1,
      yellowCards: 0,
    });
  });

  it("bans a player for every 5th yellow card of the season", () => {
    let c: PlayerCondition = FRESH;
    for (let i = 0; i < 4; i++)
      c = nextCondition(c, report({ yellowCards: 1 }));
    expect(c).toMatchObject({ yellowCards: 4, suspendedWeeks: 0 });
    c = nextCondition(c, report({ yellowCards: 1 }));
    expect(c).toMatchObject({ yellowCards: 5, suspendedWeeks: 1 });
    c = nextCondition(c, undefined);
    expect(isAvailable(c)).toBe(true);
  });

  it("resets bans, cards and fitness for a new season but keeps injuries", () => {
    expect(
      seasonReset({
        fitness: 40,
        injuredWeeks: 2,
        suspendedWeeks: 1,
        yellowCards: 7,
      }),
    ).toEqual({
      fitness: 100,
      injuredWeeks: 2,
      suspendedWeeks: 0,
      yellowCards: 0,
    });
  });
});

describe("availableSquad", () => {
  const team = generateAiTeam(createRng("avail"), 1500, "t");
  const extras = generateAiTeam(createRng("extra"), 1450, "x").players.slice(
    0,
    4,
  );
  const roster = [...team.players, ...extras];
  const ids = new Set(roster.map((p) => p.id));

  it("leaves a fully fit squad alone", () => {
    const out = availableSquad(team.squad, roster, () => true);
    expect(out.squad.lineup).toEqual(team.squad.lineup);
    expect(out.replaced).toEqual([]);
  });

  it("replaces an injured keeper with the bench keeper and keeps the squad valid", () => {
    const keeper = team.squad.lineup[0] as string;
    const benchKeeper = team.squad.bench[0] as string;
    const out = availableSquad(team.squad, roster, (id) => id !== keeper);
    expect(out.squad.lineup[0]).toBe(benchKeeper);
    expect(out.replaced).toEqual([{ out: keeper, in: benchKeeper }]);
    expect(out.squad.lineup).not.toContain(keeper);
    expect(out.squad.bench).not.toContain(keeper);
    expect(squadProblems(out.squad, ids)).toEqual([]);
  });

  it("cancels planned subs that involve unavailable players", () => {
    const starter = team.squad.lineup[5] as string;
    const sub = team.squad.bench[3] as string;
    const squad = {
      ...team.squad,
      subPlan: [{ minute: 60, outId: starter, inId: sub }],
    };
    expect(
      availableSquad(squad, roster, (id) => id !== sub).squad.subPlan,
    ).toEqual([]);
    expect(
      availableSquad(squad, roster, () => true).squad.subPlan,
    ).toHaveLength(1);
  });

  it("plays a man down when fewer than 11 are fit (D183)", () => {
    const fit = new Set(roster.slice(0, 10).map((p) => p.id));
    const out = availableSquad(team.squad, roster, (id) => fit.has(id));
    expect(out.starters).toBe(10);
    expect(out.squad.lineup).toHaveLength(11);
    expect(out.squad.lineup.filter((id) => id === "")).toHaveLength(1);
    expect(out.squad.bench).toEqual([]);
    for (const id of out.squad.lineup.filter(Boolean))
      expect(fit.has(id)).toBe(true);
    expect(() =>
      availableSquad({ ...team.squad, formation: "x" }, roster, () => true),
    ).toThrow(/formation/);
  });

  it("puts the best outfield player in goal when no keeper is fit", () => {
    const keepers = new Set(
      roster.filter((p) => p.primaryPosition === "GK").map((p) => p.id),
    );
    const out = availableSquad(team.squad, roster, (id) => !keepers.has(id));
    const inGoal = out.squad.lineup[0] as string;
    expect(inGoal).not.toBe("");
    expect(keepers.has(inGoal)).toBe(false);
    expect(out.keeperFromOutfield).toBe(inGoal);
    // Plenty of fit outfield players: their slot is refilled from the
    // bench first, so only a shortfall leaves a slot empty.
    expect(out.starters).toBeGreaterThanOrEqual(10);
  });

  it("starts with as many as are fit, even below the forfeit line", () => {
    const fit = new Set(roster.slice(1, 6).map((p) => p.id));
    const out = availableSquad(team.squad, roster, (id) => fit.has(id));
    expect(out.starters).toBe(5);
  });
});

describe("fitness carries into the match", () => {
  it("tired starters end matches more tired, so rotation matters", () => {
    const home = generateAiTeam(createRng("h"), 1500, "h");
    const away = generateAiTeam(createRng("a"), 1500, "a");
    const team = (t: typeof home, fitness?: Record<string, number>) => ({
      ...squadToTeam(
        t.squad.lineup[0] as string,
        t.squad,
        new Map(t.players.map((p) => [p.id, p])),
      ),
      ...(fitness ? { fitness } : {}),
    });
    const config = defaultSoccerConfig();
    // Three straight weeks with the same 11: fitness falls from week to week.
    let condition = new Map<string, PlayerCondition>();
    const starts: number[] = [];
    for (let week = 0; week < 3; week++) {
      const fitness = Object.fromEntries(
        home.players.map((p) => [p.id, condition.get(p.id)?.fitness ?? 100]),
      );
      starts.push(
        home.squad.lineup.reduce((a, id) => a + (fitness[id] as number), 0) /
          11,
      );
      const { result } = simulateMatch(
        { home: team(home, fitness), away: team(away), mode: "league", config },
        `week-${week}`,
      );
      condition = new Map(
        home.players.map((p) => [
          p.id,
          nextCondition(condition.get(p.id) ?? FRESH, result.players[p.id]),
        ]),
      );
    }
    expect(starts[0]).toBe(100);
    expect(starts[1]).toBeLessThan(100);
    expect(starts[2]).toBeLessThanOrEqual(starts[1] as number);
  });
});
