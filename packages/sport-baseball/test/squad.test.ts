import { createRng } from "@lfs/core";
import { describe, expect, it } from "vitest";
import {
  autoPickSquad,
  type BaseballPlayer,
  type BaseballSquad,
  defaultBaseballConfig,
  generatePlayer,
  LINEUP_SLOTS,
  type Position,
  simulateGame,
  squadFromData,
  squadFromPicked,
  squadProblems,
  squadToTeam,
} from "../src/index";

const roster = (seed: string): BaseballPlayer[] => {
  const rng = createRng(seed);
  const make = (pos: Position, i: number, role?: "starter" | "reliever") => {
    const g = generatePlayer(rng.fork(`${pos}${i}`), {
      position: pos,
      overall: 55 + (i % 10),
      ...(role ? { role } : {}),
    });
    return { ...g, id: `${seed}-${pos}-${i}` } as BaseballPlayer;
  };
  return [
    ...Array.from({ length: 6 }, (_, i) => make("P", i, "starter")),
    ...Array.from({ length: 8 }, (_, i) => make("P", i + 6, "reliever")),
    ...(
      [
        "C",
        "1B",
        "2B",
        "3B",
        "SS",
        "LF",
        "CF",
        "RF",
        "DH",
        "C",
        "SS",
        "CF",
        "1B",
      ] as Position[]
    ).map((p, i) => make(p, i + 20)),
  ];
};

describe("the saved baseball squad (ADR 0009 §8)", () => {
  const players = roster("club");
  const squad = squadFromPicked(autoPickSquad(players), "batFirst");

  it("turns auto-pick into a squad that can play", () => {
    expect(squad.style).toBe("batFirst");
    expect(squad.order).toHaveLength(9);
    expect(new Set(squad.order.map((b) => b.slot))).toEqual(
      new Set(LINEUP_SLOTS),
    );
    expect(squad.rotation).toHaveLength(5);
    expect(squad.bullpen.length).toBeLessThanOrEqual(8);
    expect(squad.bullpen).toContain(squad.closer);
    expect(squad.bullpen).toContain(squad.setup);
    expect(squad.starterPitchLimit).toBe(100);
    expect(squad.bench.length).toBeLessThanOrEqual(5);
    expect(squadProblems(squad, players)).toEqual([]);
  });

  it("explains every rule it breaks", () => {
    const pitcher = squad.rotation[0] as string;
    const lefty = players.find(
      (p) => p.primaryPosition === "1B",
    ) as BaseballPlayer;
    const bad = (s: Partial<BaseballSquad>, r = players) =>
      squadProblems({ ...squad, ...s }, r);
    expect(bad({ order: squad.order.slice(0, 8) })).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/needs 9 batters/),
        expect.stringMatching(/missing/),
      ]),
    );
    expect(
      bad({ order: [{ id: pitcher, slot: "DH" }, ...squad.order.slice(1)] }),
    ).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/Pitchers don't bat/),
        expect.stringMatching(/twice/),
      ]),
    );
    expect(bad({ rotation: squad.rotation.slice(0, 4) })).toEqual([
      expect.stringMatching(/needs 5 starting/),
    ]);
    expect(
      bad({ bullpen: [...squad.bullpen, squad.order[0]?.id as string] }),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/Only pitchers/)]));
    expect(bad({ closer: "nobody" })).toEqual([
      expect.stringMatching(/closer must be in the bullpen/),
    ]);
    expect(bad({ setup: squad.closer })).toEqual([
      expect.stringMatching(/different relievers/),
    ]);
    expect(bad({ starterPitchLimit: 30 })).toEqual([
      expect.stringMatching(/50–140/),
    ]);
    expect(
      bad({ bench: [...squad.bench, { id: pitcher, role: "injury" }] }),
    ).toEqual(expect.arrayContaining([expect.stringMatching(/not the bench/)]));
    expect(squadProblems(squad, players, 2)).toEqual([
      expect.stringMatching(/at most 2/),
    ]);
    expect(
      bad({
        bench: [
          {
            id: squad.bench[0]?.id as string,
            role: "defense",
            replaces: pitcher,
          },
        ],
      }),
    ).toEqual([expect.stringMatching(/not in the batting order/)]);
    expect(bad({}, players.slice(1))).toEqual(
      expect.arrayContaining([expect.stringMatching(/isn't on your roster/)]),
    );
    const atShort = squad.order.findIndex((b) => b.slot === "SS");
    const leftyRoster = players.map((p) =>
      p.id === squad.order[atShort]?.id ? { ...p, throws: "L" as const } : p,
    );
    expect(bad({}, leftyRoster)).toEqual([
      expect.stringMatching(/left-handed thrower/),
    ]);
    expect(lefty).toBeDefined();
  });

  it("reads back from stored data, and plays a game", () => {
    expect(squadFromData(JSON.parse(JSON.stringify(squad)))).toEqual(squad);
    expect(squadFromData({ order: [] })).toBeNull();
    expect(squadFromData(null)).toBeNull();
    expect(
      squadFromData({ order: [], rotation: [], bullpen: [], bench: [] }),
    ).toMatchObject({
      style: "balanced",
      closer: null,
      starterPitchLimit: 100,
    });
    const byId = new Map(players.map((p) => [p.id, p]));
    const other = roster("other");
    const team = squadToTeam("home", squad, byId, squad.rotation[0] as string, [
      squad.closer as string,
    ]);
    expect(team.batters).toHaveLength(9);
    expect(team.plan?.closer).toBe(squad.closer);
    expect(team.plan?.order).not.toContain(squad.closer);
    expect(team.unavailable).toEqual([squad.closer]);
    const away = squadToTeam(
      "away",
      squadFromPicked(autoPickSquad(other)),
      new Map(other.map((p) => [p.id, p])),
      squadFromPicked(autoPickSquad(other)).rotation[0] as string,
    );
    const g = simulateGame(
      { home: team, away, mode: "league", config: defaultBaseballConfig() },
      "squad",
    );
    expect(g.result.score.home).not.toBe(g.result.score.away);
    expect(() => squadToTeam("x", squad, byId, "nobody")).toThrow(
      /starting pitcher/,
    );
  });
});
