import { CLUB_COLORS, createRng } from "@lfs/core";
import { describe, expect, it } from "vitest";
import {
  type AiPlayerView,
  type AiRosterPlayer,
  aiSquad,
  chooseKeeps,
  choosePack,
  chooseReleases,
  chooseYouth,
  LINE_NEEDS,
  MAX_RUNS_OWED,
  PACE_SEASONS_PER_DAY,
  pickStarterKeeps,
  playerValue,
  ROSTER_TARGET,
  rollAiIdentity,
  runsOwed,
  weeksThisRun,
} from "../src/ai-manager";
import { FRESH } from "../src/condition";
import type { GeneratedPlayer } from "../src/generation";
import { FORMATIONS, squadProblems } from "../src/matchday";
import { POSITION_LINE } from "../src/positions";
import {
  packContents,
  ROSTER_MAX,
  ROSTER_MIN,
  starterPackPlan,
  starterSelectionError,
} from "../src/roster";

/** A club's 22 starter packs, opened (D83). */
const starterPacks = (seed: string) =>
  starterPackPlan().map((p, i) => ({
    id: `pack-${i}`,
    players: packContents(`${seed}-${i}`, p.focus, p.tier),
  }));

const lineCount = (players: readonly AiPlayerView[], line: string) =>
  players.filter((p) => POSITION_LINE[p.primaryPosition] === line).length;

/** A roster made from a club's starter keeps, with ids. */
function starterRoster(
  seed: string,
  personality: "builder" | "spender" | "steady",
) {
  const all = starterPacks(seed).flatMap((p) => p.players);
  return pickStarterKeeps(all, personality).map((i, n) => ({
    ...(all[i] as GeneratedPlayer),
    id: `p${n}`,
    fromStarterPack: true,
  }));
}

describe("AI identity (D113)", () => {
  it("rolls a club name, 2 or 3 colors, a manager and a profile, the same way every time", () => {
    const a = rollAiIdentity(createRng("club-1"));
    expect(rollAiIdentity(createRng("club-1"))).toEqual(a);
    expect(a.colors.length === 2 || a.colors.length === 3).toBe(true);
    for (const c of a.colors)
      expect(CLUB_COLORS.map((x) => x.key)).toContain(c);
    expect(new Set(a.colors).size).toBe(a.colors.length);
    expect(a.managerName.length).toBeGreaterThan(3);
    expect(FORMATIONS.map((f) => f.id)).toContain(a.profile.formation);
    const other = rollAiIdentity(
      createRng("club-1"),
      new Set([a.name.toLowerCase()]),
    );
    expect(other.name).not.toBe(a.name);
  });

  it("spreads clubs over the three paces and personalities", () => {
    const profiles = Array.from(
      { length: 400 },
      (_, i) => rollAiIdentity(createRng(`spread-${i}`)).profile,
    );
    const share = (pace: string) =>
      profiles.filter((p) => p.pace === pace).length / profiles.length;
    expect(share("slow")).toBeGreaterThan(0.2);
    expect(share("normal")).toBeGreaterThan(0.4);
    expect(share("fast")).toBeGreaterThan(0.12);
    for (const personality of ["builder", "spender", "steady"])
      expect(profiles.some((p) => p.personality === personality)).toBe(true);
  });
});

describe("AI decisions see only what a manager sees (D48)", () => {
  it("values growth for builders and today's overall for spenders", () => {
    const prospect: AiPlayerView = {
      age: 18,
      primaryPosition: "ST",
      overall: 55,
      potentialRange: [74, 82],
    };
    const veteran: AiPlayerView = {
      age: 30,
      primaryPosition: "ST",
      overall: 64,
      potentialRange: [64, 66],
    };
    expect(playerValue(prospect, "builder")).toBeGreaterThan(
      playerValue(veteran, "builder"),
    );
    expect(playerValue(veteran, "spender")).toBeGreaterThan(
      playerValue(prospect, "spender"),
    );
    // Old players lose value.
    expect(playerValue({ ...veteran, age: 35 }, "steady")).toBeLessThan(
      playerValue(veteran, "steady"),
    );
  });

  it("makes the same picks whatever the hidden potential is", () => {
    const all = starterPacks("hidden").flatMap((p) => p.players);
    const scrambled = all.map((p, i) => ({ ...p, potential: (i * 37) % 99 }));
    for (const personality of ["builder", "spender", "steady"] as const)
      expect(pickStarterKeeps(scrambled, personality)).toEqual(
        pickStarterKeeps(all, personality),
      );
  });
});

describe("starter squad (D83)", () => {
  it.each([
    "builder",
    "spender",
    "steady",
  ] as const)("a %s keeps a valid squad with every line covered", (personality) => {
    const packs = starterPacks(`starter-${personality}`);
    const all = packs.flatMap((p) => p.players);
    const keeps = pickStarterKeeps(all, personality);
    expect(keeps).toHaveLength(ROSTER_TARGET[personality]);
    const kept = keeps.map((i) => all[i] as GeneratedPlayer);
    for (const [line, need] of Object.entries(LINE_NEEDS))
      expect(lineCount(kept, line)).toBeGreaterThanOrEqual(
        Math.min(need, lineCount(all, line)),
      );
    // As the server checks it: indexes into each pack.
    const selection: Record<string, number[]> = {};
    for (const i of keeps) {
      const pack = packs[Math.floor(i / 5)] as { id: string };
      selection[pack.id] = [...(selection[pack.id] ?? []), i % 5];
    }
    expect(
      starterSelectionError(
        packs.map((p) => ({ id: p.id, opened: true, resolved: false })),
        selection,
      ),
    ).toBeNull();
  });
});

describe("packs (D47)", () => {
  const roster = starterRoster("packs", "steady");

  it("spenders buy the best pack they can afford, aimed at their weakest line", () => {
    expect(choosePack(100_000, roster, "spender")?.tier).toBe("gold");
    expect(choosePack(15_000, roster, "spender")?.tier).toBe("silver");
    expect(choosePack(6_500, roster, "spender")).toMatchObject({
      tier: "basic",
    });
    expect(choosePack(6_500, roster, "spender")?.focus).not.toBe("any");
  });

  it("builders buy cheap all-position packs; steady clubs keep a cushion", () => {
    expect(choosePack(100_000, roster, "builder")).toEqual({
      tier: "basic",
      focus: "any",
    });
    expect(choosePack(10_000, roster, "steady")).toBeNull();
    expect(choosePack(30_000, roster, "steady")?.tier).toBe("silver");
  });

  it("buys nothing with no money or a full roster", () => {
    expect(choosePack(1_000, roster, "spender")).toBeNull();
    const full = Array.from({ length: ROSTER_MAX }, () => roster[0]);
    expect(choosePack(100_000, full as AiPlayerView[], "spender")).toBeNull();
  });

  it("keeps pack players who'd make the squad, while there's room", () => {
    const weak = roster.filter((p) => p.primaryPosition === "ST")[0];
    const pack: AiPlayerView[] = [
      { age: 24, primaryPosition: "ST", overall: 90, potentialRange: [90, 92] },
      { age: 24, primaryPosition: "ST", overall: 20, potentialRange: [20, 22] },
    ];
    expect(weak).toBeDefined();
    expect(chooseKeeps(pack, roster, "spender")).toEqual([0]);
    const full = Array.from({ length: ROSTER_MAX }, () => roster[0]);
    expect(chooseKeeps(pack, full as AiPlayerView[], "spender")).toEqual([]);
  });
});

describe("releases and youth (D53, D54)", () => {
  it("trims to the target, least valued first, keeping every line covered", () => {
    const roster: AiRosterPlayer[] = [
      ...starterRoster("trim", "builder"),
      {
        id: "bought",
        fromStarterPack: false,
        age: 34,
        primaryPosition: "CM",
        overall: 40,
        potentialRange: [40, 41],
      },
    ];
    const out = chooseReleases(roster, "spender");
    expect(roster.length - out.length).toBe(ROSTER_TARGET.spender);
    expect(out).toContainEqual({ id: "bought", mode: "sell" });
    expect(
      out.filter((o) => o.id !== "bought").every((o) => o.mode === "release"),
    ).toBe(true);
    const left = roster.filter((p) => !out.some((o) => o.id === p.id));
    for (const [line, need] of Object.entries(LINE_NEEDS))
      expect(lineCount(left, line)).toBeGreaterThanOrEqual(
        Math.min(need, lineCount(roster, line)),
      );
    expect(left.length).toBeGreaterThanOrEqual(ROSTER_MIN);
    expect(chooseReleases(left, "spender")).toEqual([]);
  });

  it("takes the most promising prospects the personality wants", () => {
    const prospect = (high: number): AiPlayerView => ({
      age: 17,
      primaryPosition: "CM",
      overall: 45,
      potentialRange: [high - 8, high],
    });
    const prospects = [60, 72, 85, 78, 90, 71].map(prospect);
    expect(chooseYouth(prospects, 25, "builder")).toEqual([1, 2, 3, 4]);
    expect(chooseYouth(prospects, 25, "steady")).toEqual([2, 4]);
    expect(chooseYouth(prospects, 25, "spender")).toEqual([4]);
    expect(chooseYouth(prospects, 29, "builder")).toEqual([4]);
    expect(chooseYouth(prospects, ROSTER_MAX, "builder")).toEqual([]);
  });
});

describe("matchday and pace (D110, D114)", () => {
  it("picks a valid squad in the club's formation and rests the injured", () => {
    const roster = starterRoster("squad", "builder").map((p, i) => ({
      ...p,
      form: 0,
      condition: i === 0 ? { ...FRESH, injuredWeeks: 2 } : FRESH,
    }));
    const squad = aiSquad(roster, {
      personality: "builder",
      pace: "normal",
      formation: "4-3-3",
    });
    expect(squad.formation).toBe("4-3-3");
    expect(squadProblems(squad, new Set(roster.map((p) => p.id)))).toEqual([]);
    expect([...squad.lineup]).not.toContain("p0");
  });

  it("plays its pace's share of a season per run on average", () => {
    for (const pace of ["slow", "normal", "fast"] as const) {
      const rng = createRng(`pace-${pace}`);
      let total = 0;
      for (let i = 0; i < 1_200; i++) total += weeksThisRun(rng, pace, 12);
      const expected = (PACE_SEASONS_PER_DAY[pace] * 26) / 12;
      expect(total / 1_200).toBeCloseTo(expected, 0);
    }
  });
});

describe("an AI club's seasons, decision by decision", () => {
  it.each([
    "builder",
    "spender",
    "steady",
  ] as const)("a %s always keeps a roster and squad the rules accept", (personality) => {
    const rng = createRng(`life-${personality}`);
    let roster: (AiRosterPlayer & GeneratedPlayer)[] = starterRoster(
      `life-${personality}`,
      personality,
    );
    let funds = 40_000;
    let next = 0;
    const ids = () => new Set(roster.map((p) => p.id));
    for (let season = 0; season < 4; season++) {
      // Between seasons: packs, then releases.
      for (let k = 0; k < 3; k++) {
        const choice = choosePack(funds, roster, personality);
        if (!choice) break;
        funds -= 10_000;
        const pack = packContents(
          `${personality}-${season}-${k}`,
          choice.focus,
          choice.tier,
        );
        for (const i of chooseKeeps(pack, roster, personality))
          roster.push({
            ...(pack[i] as GeneratedPlayer),
            id: `n${next++}`,
            fromStarterPack: false,
          });
        expect(roster.length).toBeLessThanOrEqual(ROSTER_MAX);
      }
      const out = new Set(chooseReleases(roster, personality).map((o) => o.id));
      roster = roster.filter((p) => !out.has(p.id));
      expect(roster.length).toBeGreaterThanOrEqual(ROSTER_MIN);
      expect(roster.length).toBeLessThanOrEqual(ROSTER_MAX);
      // A matchday squad the server accepts.
      const squad = aiSquad(
        roster.map((p) => ({ ...p, form: 0, condition: FRESH })),
        { personality, pace: "normal", formation: "4-4-2" },
      );
      expect(squadProblems(squad, ids())).toEqual([]);
      // Season end: everyone a year older, then youth.
      roster = roster.map((p) => ({ ...p, age: p.age + 1 }));
      const positions = ["GK", "CB", "CM", "ST"] as const;
      const prospects = Array.from(
        { length: 22 },
        (
          _,
          i,
        ): {
          age: number;
          primaryPosition: (typeof positions)[number];
          overall: number;
          potentialRange: [number, number];
        } => ({
          age: 17,
          primaryPosition: positions[i % 4] as (typeof positions)[number],
          overall: 40 + (i % 7),
          potentialRange: [60 + i, 66 + i],
        }),
      );
      for (const i of chooseYouth(prospects, roster.length, personality))
        roster.push({
          ...(roster[0] as AiRosterPlayer & GeneratedPlayer),
          ...(prospects[i] as (typeof prospects)[number]),
          id: `y${next++}`,
          fromStarterPack: false,
        });
      expect(roster.length).toBeLessThanOrEqual(ROSTER_MAX);
      funds += 30_000 + Math.floor(rng.next() * 5_000);
    }
  });
});

describe("catching up missed runs (D177)", () => {
  const now = new Date("2026-11-05T12:00:00Z");
  it("owes the time since the last run over the time between runs, capped", () => {
    expect(runsOwed(null, now, 12)).toBe(1);
    expect(runsOwed("2026-11-05T10:00:00Z", now, 12)).toBeCloseTo(1);
    expect(runsOwed("2026-11-05T11:30:00Z", now, 12)).toBeCloseTo(0.25);
    expect(runsOwed("2026-11-05T04:00:00Z", now, 12)).toBeCloseTo(4);
    expect(runsOwed("2026-11-04T00:00:00Z", now, 12)).toBe(MAX_RUNS_OWED);
    expect(runsOwed("2026-11-05T13:00:00Z", now, 12)).toBe(0);
  });

  it("plays that many runs' worth of weeks on average", () => {
    const rng = createRng("catch-up");
    let total = 0;
    for (let i = 0; i < 1_200; i++)
      total += weeksThisRun(rng, "normal", 12, 26, undefined, 3);
    expect(total / 1_200).toBeCloseTo(
      ((PACE_SEASONS_PER_DAY.normal * 26) / 12) * 3,
      0,
    );
    expect(weeksThisRun(createRng("x"), "fast", 12, 26, undefined, 0)).toBe(0);
  });
});
