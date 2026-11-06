import { createRng } from "@lfs/core";
import { describe, expect, it } from "vitest";
import {
  ATTRIBUTES,
  type Attributes,
  type BaseballPlayer,
  type BaseballTeam,
  bullpenDecision,
  DEFAULT_FATIGUE,
  defaultBaseballConfig,
  defaultBullpenPlan,
  FIELD_POSITIONS,
  fatigueFactor,
  generatePlayer,
  nextStarter,
  pitchBudget,
  relieverRestDays,
  simulateGame,
  starterRestDays,
  teamAt,
} from "../src/index";

const flat = (v: number): Attributes =>
  Object.fromEntries(ATTRIBUTES.map((k) => [k, v])) as Attributes;
const arm = (
  id: string,
  role: "starter" | "reliever",
  extra: Partial<Attributes> = {},
): BaseballPlayer => ({
  id,
  attributes: { ...flat(60), ...extra },
  primaryPosition: "P",
  secondaryPosition: null,
  pitcherRole: role,
  chemistryColor: 0,
});

const team = (seed: string, overall = 60): BaseballTeam => {
  const r = createRng(seed);
  const batters = [...FIELD_POSITIONS, "DH" as const].map(
    (pos, i) =>
      ({
        id: `${seed}-${pos}`,
        ...generatePlayer(r.fork(`b${i}`), { position: pos, overall }),
      }) as BaseballPlayer,
  );
  const make = (k: string, role: "starter" | "reliever") =>
    ({
      id: `${seed}-${k}`,
      ...generatePlayer(r.fork(k), { position: "P", overall, role }),
    }) as BaseballPlayer;
  return {
    ...teamAt(seed, batters, make("SP", "starter")),
    bullpen: Array.from({ length: 8 }, (_, i) => make(`RP${i}`, "reliever")),
  };
};

describe("pitch budgets and fatigue (D197)", () => {
  it("gives starters 60 pitches at stamina 40 up to 110 at 90, relievers a third", () => {
    expect(pitchBudget(arm("a", "starter", { stamina: 40 }))).toBe(60);
    expect(pitchBudget(arm("a", "starter", { stamina: 90 }))).toBe(110);
    expect(pitchBudget(arm("a", "reliever", { stamina: 90 }))).toBe(39);
    expect(pitchBudget(arm("a", "reliever", { stamina: 1 }))).toBe(10);
  });

  it("fades velocity, control and movement past the budget, to a floor", () => {
    expect(fatigueFactor(80, 90)).toBe(1);
    expect(fatigueFactor(100, 90)).toBeCloseTo(
      1 - 10 * DEFAULT_FATIGUE.perPitchPast,
    );
    expect(fatigueFactor(500, 90)).toBe(DEFAULT_FATIGUE.floor);
  });
});

describe("the bullpen plan (D197)", () => {
  const bullpen = [
    arm("weak", "reliever", { velocity: 40 }),
    arm("ace", "reliever", { velocity: 90, movement: 90 }),
    arm("good", "reliever", { velocity: 75 }),
    arm("mid", "reliever"),
  ];
  const plan = defaultBullpenPlan(bullpen);
  const base = {
    plan,
    current: arm("sp", "starter"),
    starter: true,
    thrown: 50,
    budget: 90,
    inning: 5,
    lead: 0,
    bullpen,
    used: new Set(["sp"]),
    unavailable: new Set<string>(),
  };

  it("makes the best reliever the closer and the next the setup man", () => {
    expect(plan).toEqual({
      starterPitchLimit: 100,
      closer: "ace",
      setup: "good",
      order: ["mid", "weak"],
    });
    expect(defaultBullpenPlan([])).toEqual({
      starterPitchLimit: 100,
      closer: null,
      setup: null,
      order: [],
    });
  });

  it("leaves a fresh starter in, and takes him out at the limit or tired", () => {
    expect(bullpenDecision(base)).toBeNull();
    expect(bullpenDecision({ ...base, thrown: 100 })).toMatchObject({
      pitcher: { id: "mid" },
      reason: "limit",
    });
    expect(bullpenDecision({ ...base, thrown: 70, budget: 55 })).toMatchObject({
      reason: "tired",
    });
  });

  it("brings the closer for the 9th and the setup man for the 8th with a lead of 3 or fewer", () => {
    expect(bullpenDecision({ ...base, inning: 9, lead: 2 })).toMatchObject({
      pitcher: { id: "ace" },
      reason: "closer",
    });
    expect(bullpenDecision({ ...base, inning: 8, lead: 3 })).toMatchObject({
      pitcher: { id: "good" },
      reason: "setup",
    });
    // No save chance: a 4-run lead, or behind.
    expect(bullpenDecision({ ...base, inning: 9, lead: 4 })).toBeNull();
    expect(bullpenDecision({ ...base, inning: 9, lead: -1 })).toBeNull();
    // The closer stays in once on.
    expect(
      bullpenDecision({
        ...base,
        current: bullpen[1] as BaseballPlayer,
        starter: false,
        inning: 10,
        lead: 1,
      }),
    ).toBeNull();
  });

  it("skips pitchers who already pitched or need rest, and runs out gracefully", () => {
    expect(
      bullpenDecision({ ...base, thrown: 100, used: new Set(["sp", "mid"]) }),
    ).toMatchObject({ pitcher: { id: "weak" } });
    expect(
      bullpenDecision({
        ...base,
        thrown: 100,
        used: new Set(["sp", "mid"]),
        unavailable: new Set(["weak"]),
      }),
    ).toMatchObject({ pitcher: { id: "good" } });
    expect(
      bullpenDecision({
        ...base,
        thrown: 100,
        used: new Set(["sp", "mid", "weak", "good", "ace"]),
      }),
    ).toBeNull();
    // The closer only when free.
    expect(
      bullpenDecision({
        ...base,
        inning: 9,
        lead: 1,
        unavailable: new Set(["ace"]),
      }),
    ).toBeNull();
  });
});

describe("rest and the rotation (D213)", () => {
  it("rests starters by pitches thrown", () => {
    expect([30, 50, 74, 75, 99, 100, 120].map(starterRestDays)).toEqual([
      1, 3, 3, 4, 4, 5, 5,
    ]);
  });

  it("rests relievers after 25+ pitches or two days running", () => {
    expect(relieverRestDays(0, true)).toBe(0);
    expect(relieverRestDays(15, false)).toBe(0);
    expect(relieverRestDays(25, false)).toBe(1);
    expect(relieverRestDays(10, true)).toBe(1);
  });

  it("picks the next rested starter, or the least tired when none is", () => {
    const rotation = ["a", "b", "c", "d", "e"];
    expect(nextStarter(rotation, null, {})).toBe("a");
    expect(nextStarter(rotation, "b", {})).toBe("c");
    expect(nextStarter(rotation, "e", { a: 2 })).toBe("b");
    expect(nextStarter(rotation, "a", { a: 5, b: 3, c: 1, d: 2, e: 4 })).toBe(
      "c",
    );
    expect(nextStarter([], null, {})).toBeNull();
  });
});

describe("the bullpen in a game", () => {
  const home = team("bh");
  const away = team("ba");
  const play = (seed: string, h = home, a = away) =>
    simulateGame(
      { home: h, away: a, mode: "league", config: defaultBaseballConfig() },
      seed,
    );

  it("changes pitchers, and nobody who comes out goes back in", () => {
    let changes = 0;
    for (let i = 0; i < 100; i++) {
      const g = play(`bp${i}`);
      const out = new Set<string>();
      for (const e of g.events) {
        if (e.type === "pitchingChange") {
          changes++;
          expect(out.has(e.in)).toBe(false);
          out.add(e.out);
        }
        if (e.type === "pitch") expect(out.has(e.pitcher)).toBe(false);
      }
    }
    expect(changes).toBeGreaterThan(200);
  });

  it("keeps starters near the limit and uses the closer in saves", () => {
    let starterPitches = 0;
    let closers = 0;
    for (let i = 0; i < 200; i++) {
      const g = play(`sv${i}`);
      starterPitches += g.result.pitches["bh-SP"] ?? 0;
      closers += g.events.filter(
        (e) => e.type === "pitchingChange" && e.reason === "closer",
      ).length;
    }
    const avg = starterPitches / 200;
    expect(avg).toBeGreaterThan(70);
    expect(avg).toBeLessThan(110);
    expect(closers).toBeGreaterThan(40);
  });

  it("leaves relievers who need rest out", () => {
    const tired = {
      ...home,
      unavailable: home.bullpen?.map((p) => p.id) ?? [],
    };
    for (let i = 0; i < 30; i++) {
      const g = play(`ua${i}`, tired);
      expect(
        g.events.some((e) => e.type === "pitchingChange" && e.side === "home"),
      ).toBe(false);
    }
  });
});
