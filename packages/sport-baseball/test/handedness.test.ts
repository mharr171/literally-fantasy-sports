import { createRng } from "@lfs/core";
import { describe, expect, it } from "vitest";
import {
  ATTRIBUTES,
  type Attributes,
  type BaseballPlayer,
  type BaseballTeam,
  battingSide,
  choosePinchHitter,
  DEFAULT_SKILL_TUNING,
  defaultBaseballConfig,
  generatePlayer,
  handednessLabel,
  harnessTeam,
  mirrorGrid,
  mirrorSpray,
  POSITIONS,
  platoonEdges,
  SPRAY_PRESETS,
  simulateGame,
  ZONE_PRESETS,
} from "../src/index";

const flat = (v: number): Attributes =>
  Object.fromEntries(ATTRIBUTES.map((k) => [k, v])) as Attributes;

describe("handedness at generation (D224)", () => {
  const many = (position: (typeof POSITIONS)[number], n = 1500) =>
    Array.from({ length: n }, (_, i) =>
      generatePlayer(createRng(`hand-${position}-${i}`), {
        position,
        overall: 60,
      }),
    );

  it("makes about 28% of pitchers left-handed", () => {
    const lefties = many("P").filter((p) => p.throws === "L").length / 1500;
    expect(lefties).toBeGreaterThan(0.24);
    expect(lefties).toBeLessThan(0.32);
  });

  it("bats about 58% right, 32% left and 10% both ways", () => {
    const all = POSITIONS.flatMap((p) => many(p, 300));
    const share = (b: string) =>
      all.filter((p) => p.bats === b).length / all.length;
    expect(share("R")).toBeGreaterThan(0.53);
    expect(share("R")).toBeLessThan(0.63);
    expect(share("L")).toBeGreaterThan(0.27);
    expect(share("L")).toBeLessThan(0.37);
    expect(share("S")).toBeGreaterThan(0.07);
    expect(share("S")).toBeLessThan(0.13);
  });

  it("never puts a left-handed thrower at catcher, second, third or short", () => {
    for (const position of POSITIONS) {
      for (const p of many(position, 400)) {
        if (p.throws !== "L") continue;
        expect(["C", "2B", "3B", "SS"]).not.toContain(p.primaryPosition);
        expect(["C", "2B", "3B", "SS"]).not.toContain(p.secondaryPosition);
      }
    }
    expect(many("SS", 400).every((p) => p.throws === "R")).toBe(true);
    expect(many("1B", 400).some((p) => p.throws === "L")).toBe(true);
  });

  it("labels how a player bats and throws", () => {
    expect(handednessLabel({ bats: "L", throws: "R" })).toBe(
      "Bats L · Throws R",
    );
    expect(handednessLabel({ bats: "S", throws: "L" })).toBe(
      "Bats S · Throws L",
    );
    // Players saved before handedness count as right-handed.
    expect(handednessLabel({})).toBe("Bats R · Throws R");
  });
});

describe("the platoon edge (D224)", () => {
  const e = DEFAULT_SKILL_TUNING.platoonEdge;

  it("goes to the batter facing the other arm, to the pitcher otherwise", () => {
    expect(platoonEdges({ bats: "L" }, { throws: "R" })).toEqual({
      batter: e,
      pitcher: 0,
    });
    expect(platoonEdges({ bats: "R" }, { throws: "L" })).toEqual({
      batter: e,
      pitcher: 0,
    });
    expect(platoonEdges({ bats: "R" }, { throws: "R" })).toEqual({
      batter: 0,
      pitcher: e,
    });
    expect(platoonEdges({ bats: "L" }, { throws: "L" })).toEqual({
      batter: 0,
      pitcher: e,
    });
  });

  it("always goes to a switch hitter, who hits from the other side", () => {
    expect(battingSide("S", "R")).toBe("L");
    expect(battingSide("S", "L")).toBe("R");
    expect(battingSide(undefined, "L")).toBe("R");
    for (const throws of ["R", "L"] as const)
      expect(platoonEdges({ bats: "S" }, { throws }).batter).toBe(e);
  });

  it("follows the setting", () => {
    const skill = { ...DEFAULT_SKILL_TUNING, platoonEdge: 0 };
    expect(platoonEdges({ bats: "R" }, { throws: "R" }, skill)).toEqual({
      batter: 0,
      pitcher: 0,
    });
  });

  it("sends up a left-handed pinch hitter against a right-hander", () => {
    const batter: BaseballPlayer = {
      id: "b",
      attributes: flat(55),
      primaryPosition: "LF",
      secondaryPosition: null,
      pitcherRole: null,
      chemistryColor: 0,
      bats: "R",
      throws: "R",
    };
    const lefty = {
      ...batter,
      id: "ph",
      attributes: flat(57),
      bats: "L" as const,
    };
    const base = {
      bench: [{ player: lefty, role: "pinchHitter" as const }],
      used: new Set<string>(),
      batter,
      inning: 8,
      needRuns: true,
    };
    // A little better on paper is not enough alone…
    expect(choosePinchHitter(base)).toBeNull();
    // …but with the platoon edge against a right-hander it is.
    expect(
      choosePinchHitter({ ...base, pitcher: { throws: "R" } })?.player.id,
    ).toBe("ph");
    // Against a left-hander the edge flips to the right-handed batter.
    expect(choosePinchHitter({ ...base, pitcher: { throws: "L" } })).toBeNull();
  });
});

describe("mirrored profiles (D224)", () => {
  it("mirrors zones left to right and spray from line to line", () => {
    const grid = ZONE_PRESETS["middle-in"];
    const m = mirrorGrid(grid);
    for (let r = 0; r < 5; r++)
      for (let c = 0; c < 5; c++) expect(m[r]?.[c]).toBe(grid[r]?.[4 - c]);
    expect(mirrorGrid(m)).toEqual(grid.map((row) => [...row]));
    const pull = SPRAY_PRESETS.pull;
    expect(mirrorSpray(pull)).toEqual([...pull].reverse());
    // A right-handed batter pulls to left field (direction 0).
    expect(pull[0]).toBeGreaterThan(pull[11] as number);
  });

  it("sends a pull hitter's balls to his pull side, by the hand he bats", () => {
    const root = createRng("pull");
    const withHand = (team: BaseballTeam, bats: "R" | "L"): BaseballTeam => ({
      ...team,
      batters: team.batters.map((b) => ({
        ...b,
        player: { ...b.player, bats, sprayProfile: "pull" },
      })),
    });
    const left = (bats: "R" | "L") => {
      let toLeft = 0;
      let toRight = 0;
      for (let i = 0; i < 40; i++) {
        const home = withHand(harnessTeam(root.fork(`h${i}`), "h", 60), bats);
        const away = withHand(harnessTeam(root.fork(`a${i}`), "a", 60), bats);
        const g = simulateGame(
          { home, away, mode: "league", config: defaultBaseballConfig() },
          `pull-${i}`,
        );
        for (const ev of g.events) {
          if (ev.type !== "play" || !ev.batted) continue;
          if (ev.batted.direction < 6) toLeft++;
          else toRight++;
        }
      }
      return toLeft / (toLeft + toRight);
    };
    expect(left("R")).toBeGreaterThan(0.58);
    expect(left("L")).toBeLessThan(0.42);
  });
});
