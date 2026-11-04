import { describe, expect, it } from "vitest";
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
  squadProblems,
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

  it("needs a formation, 11 starters, 11 subs and nobody twice", () => {
    expect(squadProblems({ ...base, formation: "x" }, ids)).toContain(
      "Pick a formation.",
    );
    expect(
      squadProblems({ ...base, lineup: base.lineup.slice(1) }, ids),
    ).toContain("Pick 11 starters (10 picked).");
    expect(
      squadProblems({ ...base, bench: base.bench.slice(1) }, ids),
    ).toContain(`Pick ${BENCH_SIZE} substitutes (10 picked).`);
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
