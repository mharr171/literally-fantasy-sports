import { describe, expect, it } from "vitest";
import { aiSquad } from "../src/ai-manager";
import { DEFAULT_CONDITION_SETTINGS, FRESH } from "../src/condition";
import { STARTER_PACKS } from "../src/generation";
import { defaultSoccerConfig, simulateMatch } from "../src/match";
import {
  autoPickSquad,
  BENCH_SIZE,
  DEFAULT_FORMATION,
  FORMATIONS,
  formation,
  lineupChemistry,
  type MatchdaySquad,
  type PickablePlayer,
  slotRating,
  squadFromGroups,
  squadProblems,
  squadToGroups,
  squadToTeam,
} from "../src/matchday";
import { packContents } from "../src/roster";

/** A 30-player roster from starter packs. */
function roster(seed: string): PickablePlayer[] {
  const players = STARTER_PACKS.flatMap(({ focus, count }) =>
    Array.from({ length: count }, (_, i) =>
      packContents(`${seed}-${focus}-${i}`, focus, "starter"),
    ).flat(),
  );
  // Every keeper, plus the first outfielders from each line, up to 30.
  const keepers = players.filter((p) => p.primaryPosition === "GK");
  const outfield = players.filter((p) => p.primaryPosition !== "GK");
  return [...keepers, ...outfield.filter((_, i) => i % 3 === 0)]
    .slice(0, 30)
    .map((p, i) => ({ ...p, id: `${seed}-${i}` }));
}

const players = roster("md");
const ids = new Set(players.map((p) => p.id));
const byId = new Map(players.map((p) => [p.id, p]));

describe("formations (D88)", () => {
  it("has 11 slots with exactly one keeper, inside the pitch", () => {
    expect(FORMATIONS.length).toBeGreaterThanOrEqual(5);
    for (const f of FORMATIONS) {
      expect(f.slots, f.id).toHaveLength(11);
      expect(
        f.slots.filter((s) => s.position === "GK"),
        f.id,
      ).toHaveLength(1);
      // The name matches the outfield shape, e.g. 4-4-2.
      const outfield = f.id.split("-").map(Number);
      expect(
        outfield.reduce((a, b) => a + b, 0),
        f.id,
      ).toBe(10);
      for (const s of f.slots) {
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x).toBeLessThanOrEqual(100);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThanOrEqual(100);
      }
    }
    expect(formation(DEFAULT_FORMATION)?.id).toBe("4-4-2");
    expect(formation("2-3-5")).toBeUndefined();
  });
});

describe("autoPickSquad", () => {
  it("picks a valid 22 with a keeper in goal and a spare on the bench", () => {
    for (const f of FORMATIONS) {
      const squad = autoPickSquad(players, f.id);
      expect(squadProblems(squad, ids), f.id).toEqual([]);
      const keeper = byId.get(squad.lineup[0] as string);
      expect(keeper?.primaryPosition, f.id).toBe("GK");
      expect(
        squad.bench.some((id) => byId.get(id)?.primaryPosition === "GK"),
        f.id,
      ).toBe(true);
    }
  });

  it("falls back to 4-4-2 and copes with a short roster", () => {
    const squad = autoPickSquad(players.slice(0, 15), "nope");
    expect(squad.formation).toBe("4-4-2");
    expect(squad.lineup).toHaveLength(11);
    expect(squad.bench).toHaveLength(4);
    expect(autoPickSquad([], "4-4-2").lineup).toEqual([]);
  });

  it("rates players higher in their own position", () => {
    const keeper = players.find((p) => p.primaryPosition === "GK");
    if (!keeper) throw new Error("no keeper");
    expect(slotRating(keeper, "GK")).toBeGreaterThan(slotRating(keeper, "ST"));
  });
});

describe("squadProblems", () => {
  const base = autoPickSquad(players);
  const withPlan = (subPlan: MatchdaySquad["subPlan"]) => ({
    ...base,
    subPlan,
  });
  const [s1, s2, s3] = base.lineup as [string, string, string];
  const [b1, b2, b3, b4, b5, b6] = base.bench as [
    string,
    string,
    string,
    string,
    string,
    string,
  ];

  it("needs a formation, 11 starters, at most 11 subs and nobody twice", () => {
    expect(squadProblems({ ...base, formation: "x" }, ids)).toContain(
      "Pick a formation.",
    );
    expect(
      squadProblems({ ...base, lineup: base.lineup.slice(1) }, ids),
    ).toContain("Pick 11 starters (10 picked).");
    // A shorter bench is fine (D182); more than the sport allows isn't.
    expect(squadProblems({ ...base, bench: base.bench.slice(1) }, ids)).toEqual(
      [],
    );
    expect(squadProblems({ ...base, bench: [] }, ids)).toEqual([]);
    expect(
      squadProblems(
        { ...base, bench: base.bench.slice(0, 6) },
        ids,
        undefined,
        5,
      ),
    ).toContain("Pick at most 5 substitutes (6 picked).");
    expect(BENCH_SIZE).toBe(11);
    expect(
      squadProblems({ ...base, bench: [s1, ...base.bench.slice(1)] }, ids),
    ).toContain("A player is picked twice.");
    const gone = new Set(ids);
    gone.delete(s1);
    gone.delete(b1);
    expect(squadProblems(base, gone)).toContain(
      "2 picked players have left the team.",
    );
    gone.add(b1);
    expect(squadProblems(base, gone)).toContain(
      "1 picked player has left the team.",
    );
  });

  it("accepts a sub plan the engine can follow, including a sub coming off", () => {
    expect(
      squadProblems(
        withPlan([
          { minute: 60, outId: s1, inId: b1 },
          { minute: 75, outId: b1, inId: b2 },
          { minute: 75, outId: s2, inId: b3 },
        ]),
        ids,
      ),
    ).toEqual([]);
  });

  it("rejects plans with too many subs, windows, bad minutes or players", () => {
    expect(
      squadProblems(
        withPlan(
          [b1, b2, b3, b4, b5, b6].map((inId, i) => ({
            minute: 60,
            outId: base.lineup[i + 1] as string,
            inId,
          })),
        ),
        ids,
      ),
    ).toContain("Plan at most 5 substitutions.");
    expect(
      squadProblems(
        withPlan([
          { minute: 50, outId: s1, inId: b1 },
          { minute: 60, outId: s2, inId: b2 },
          { minute: 70, outId: s3, inId: b3 },
          { minute: 80, outId: b1, inId: b4 },
        ]),
        ids,
      ),
    ).toContain("Plan substitutions in at most 3 different minutes.");
    expect(
      squadProblems(withPlan([{ minute: 90, outId: s1, inId: b1 }]), ids),
    ).toContain("Planned substitutions happen from minute 1 to 89.");
    expect(
      squadProblems(withPlan([{ minute: 60, outId: s1, inId: s2 }]), ids),
    ).toContain("Each planned substitute must come from the bench, once.");
    expect(
      squadProblems(
        withPlan([
          { minute: 60, outId: s1, inId: b1 },
          { minute: 70, outId: s1, inId: b2 },
        ]),
        ids,
      ),
    ).toContain(
      "A planned substitution takes off someone who isn't on the pitch then.",
    );
  });
});

describe("playing a squad", () => {
  it("turns into a team the match engine can play", () => {
    const home = autoPickSquad(players, "4-3-3");
    home.subPlan = [
      {
        minute: 60,
        outId: home.lineup[10] as string,
        inId: home.bench[0] as string,
      },
    ];
    const other = roster("op");
    const away = autoPickSquad(other, "3-5-2");
    const result = simulateMatch(
      {
        home: squadToTeam("h", home, byId),
        away: squadToTeam("a", away, new Map(other.map((p) => [p.id, p]))),
        mode: "league",
        config: defaultSoccerConfig(),
      },
      "matchday",
    );
    expect(result.events.some((e) => e.type === "sub")).toBe(true);
    expect(() => squadToTeam("h", { ...home, formation: "x" }, byId)).toThrow(
      /formation/,
    );
    expect(() => squadToTeam("h", home, new Map())).toThrow(
      /isn't on the team/,
    );
  });

  it("works out chemistry for the starters", () => {
    const starters = autoPickSquad(players).lineup.map(
      (id) => byId.get(id) as PickablePlayer,
    );
    const boosts = lineupChemistry(starters);
    expect(boosts).toHaveLength(11);
    expect(Math.max(...boosts)).toBeGreaterThan(0);
  });
});

describe("autoPickSquad with injuries, bans, fitness and form (M4)", () => {
  const base = autoPickSquad(players);
  const keeper = base.lineup[0] as string;
  const striker = base.lineup[10] as string;

  it("never starts an unavailable player when a fit one can play", () => {
    const out = new Set([keeper, striker]);
    const squad = autoPickSquad(players, DEFAULT_FORMATION, {
      available: (id) => !out.has(id),
    });
    expect(squad.lineup).not.toContain(keeper);
    expect(squad.lineup).not.toContain(striker);
    expect(byId.get(squad.lineup[0] as string)?.primaryPosition).toBe("GK");
    // They don't take bench places from fit players either.
    expect(squad.bench).not.toContain(keeper);
    expect(squadProblems(squad, ids)).toEqual([]);
  });

  it("never picks unavailable players; a slot nobody fit can fill stays empty (D183)", () => {
    const few = players.slice(0, 22);
    const out = new Set(few.slice(0, 3).map((p) => p.id));
    const squad = autoPickSquad(few, DEFAULT_FORMATION, {
      available: (id) => !out.has(id),
    });
    const picked = [...squad.lineup, ...squad.bench].filter(Boolean);
    expect(picked.some((id) => out.has(id))).toBe(false);
    expect(picked).toHaveLength(19);
    expect(squad.lineup).toHaveLength(11);
    // Only 9 fit: two slots stay empty, and the squad still saves.
    const nine = new Set(few.slice(0, 9).map((p) => p.id));
    const short = autoPickSquad(few, DEFAULT_FORMATION, {
      available: (id) => nine.has(id),
    });
    expect(short.lineup.filter((id) => id === "")).toHaveLength(2);
    expect(short.bench).toEqual([]);
    expect(squadProblems(short, new Set(few.map((p) => p.id)))).toEqual([]);
  });

  it("prefers a fresher or in-form player when ratings are close", () => {
    const tired = new Set(base.lineup.slice(1));
    const squad = autoPickSquad(players, DEFAULT_FORMATION, {
      weight: (id) => (tired.has(id) ? 0.7 : 1),
    });
    const changed = squad.lineup.filter((id) => !base.lineup.includes(id));
    expect(changed.length).toBeGreaterThan(0);
  });
});

describe("resting tired players (D188)", () => {
  const base = autoPickSquad(players);
  const starters = base.lineup.slice(1) as string[];

  it("rests a tired starter for a fitter player, even out of position", () => {
    // Every starter's position-mates on the bench are tired too, so only an
    // out-of-position fresh player can replace the first starter.
    const tiredOne = starters[0] as string;
    const pos = byId.get(tiredOne)?.primaryPosition;
    const tired = new Set(
      players
        .filter((p) => p.primaryPosition === pos && p.id !== base.lineup[0])
        .map((p) => p.id),
    );
    const without = autoPickSquad(players, DEFAULT_FORMATION);
    expect(without.lineup).toContain(tiredOne);
    const squad = autoPickSquad(players, DEFAULT_FORMATION, {
      rested: (id) => tired.has(id),
    });
    expect(squad.lineup).not.toContain(tiredOne);
    expect(squad.lineup.some((id) => tired.has(id))).toBe(false);
    expect(squadProblems(squad, ids)).toEqual([]);
  });

  it("still starts tired players when nobody fitter is left", () => {
    const few = players.slice(0, 13);
    const all = new Set(few.map((p) => p.id));
    const squad = autoPickSquad(few, DEFAULT_FORMATION, {
      rested: (id) => all.has(id),
    });
    expect(squad.lineup.filter(Boolean)).toHaveLength(11);
  });

  it("AI clubs rest players below the cutoff, and 0 turns it off", () => {
    const tiredOne = starters[0] as string;
    const roster = players.map((p) => ({
      ...p,
      condition: { ...FRESH, fitness: p.id === tiredOne ? 20 : 100 },
      form: 0,
    }));
    const profile = {
      personality: "spender" as const,
      pace: "normal" as const,
      formation: DEFAULT_FORMATION,
    };
    expect(aiSquad(roster, profile).lineup).not.toContain(tiredOne);
    expect(DEFAULT_CONDITION_SETTINGS.restBelowFitness).toBe(50);
    expect(aiSquad(roster, profile, 10).lineup).toEqual(
      aiSquad(roster, profile, 0).lineup,
    );
  });
});

describe("a short bench (D182)", () => {
  it("auto-picks the subs a 14-player roster has and plays the match", () => {
    const fourteen = players.slice(0, 14);
    const squad = autoPickSquad(fourteen, "4-4-2");
    expect(squad.lineup).toHaveLength(11);
    expect(squad.bench).toHaveLength(3);
    expect(squadProblems(squad, new Set(fourteen.map((p) => p.id)))).toEqual(
      [],
    );
    expect(
      autoPickSquad(players, "4-4-2", { benchSize: 5 }).bench,
    ).toHaveLength(5);
    const team = squadToTeam(
      "short",
      squad,
      new Map(fourteen.map((p) => [p.id, p])),
    );
    const rivals = roster("rivals");
    const other = squadToTeam(
      "full",
      autoPickSquad(rivals, "4-4-2"),
      new Map(rivals.map((p) => [p.id, p])),
    );
    const out = simulateMatch(
      {
        home: team,
        away: other,
        mode: "league",
        config: defaultSoccerConfig(),
      },
      "short-bench",
    );
    expect(out.result.score.home).toBeGreaterThanOrEqual(0);
  });
});

describe("squads as named groups (ADR 0007 §3)", () => {
  it("round-trips a squad through its stored groups", () => {
    const squad: MatchdaySquad = {
      ...autoPickSquad(players),
      subPlan: [{ minute: 60, outId: "a", inId: "b" }],
    };
    const groups = squadToGroups(squad);
    expect(groups.starters).toEqual(squad.lineup);
    expect(squadFromGroups(groups)).toEqual(squad);
    // Groups another sport might add are ignored; stray values are dropped.
    expect(
      squadFromGroups({ ...groups, bullpen: ["x"], bench: ["c", 3] })?.bench,
    ).toEqual(["c"]);
  });

  it("returns null for anything that isn't a soccer squad", () => {
    expect(squadFromGroups({})).toBeNull();
    expect(squadFromGroups(null)).toBeNull();
    expect(squadFromGroups({ formation: "4-4-2" })).toBeNull();
  });
});
