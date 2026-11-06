import { createRng } from "@lfs/core";
import { describe, expect, it } from "vitest";
import {
  ATTRIBUTES,
  type Attributes,
  autoPickSquad,
  type BaseballPlayer,
  type BaseballTeam,
  type BatterPosition,
  battingOrder,
  battingRating,
  chooseDefense,
  chooseInjuryCover,
  choosePinchHitter,
  choosePinchRunner,
  defaultBaseballConfig,
  FIELD_POSITIONS,
  fieldingRating,
  generatePlayer,
  POSITIONS,
  simulateGame,
  styledRating,
} from "../src/index";

const flat = (v: number): Attributes =>
  Object.fromEntries(ATTRIBUTES.map((k) => [k, v])) as Attributes;
const hitter = (
  id: string,
  primary: BatterPosition,
  extra: Partial<Attributes> = {},
  secondary: BatterPosition | null = null,
): BaseballPlayer => ({
  id,
  attributes: { ...flat(50), ...extra },
  primaryPosition: primary,
  secondaryPosition: secondary,
  pitcherRole: null,
  chemistryColor: 0,
});

describe("bench roles (D212)", () => {
  const batter = hitter("b", "SS");
  const slugger = hitter("ph", "1B", { contact: 80, power: 80, eye: 70 });
  const speedy = hitter("pr", "CF", { speed: 90 });
  const glove = hitter("d", "SS", { fielding: 85, arm: 85 }, "2B");

  it("pinch-hits late when behind or level, with a clearly better bat", () => {
    const bench = [{ player: slugger, role: "pinchHitter" as const }];
    const base = {
      bench,
      used: new Set<string>(),
      batter,
      inning: 7,
      needRuns: true,
    };
    expect(choosePinchHitter(base)?.player.id).toBe("ph");
    expect(choosePinchHitter({ ...base, inning: 6 })).toBeNull();
    expect(choosePinchHitter({ ...base, needRuns: false })).toBeNull();
    expect(choosePinchHitter({ ...base, used: new Set(["ph"]) })).toBeNull();
    // Not clearly better: no change.
    expect(
      choosePinchHitter({
        ...base,
        batter: hitter("good", "SS", { contact: 78, power: 78, eye: 70 }),
      }),
    ).toBeNull();
    // Named for someone else: only for them.
    expect(
      choosePinchHitter({
        ...base,
        bench: [{ player: slugger, role: "pinchHitter", replaces: "x" }],
      }),
    ).toBeNull();
  });

  it("pinch-runs for a slow runner in a close late game", () => {
    const bench = [{ player: speedy, role: "pinchRunner" as const }];
    const base = {
      bench,
      used: new Set<string>(),
      runner: batter,
      inning: 8,
      close: true,
    };
    expect(choosePinchRunner(base)?.player.id).toBe("pr");
    expect(choosePinchRunner({ ...base, close: false })).toBeNull();
    expect(choosePinchRunner({ ...base, inning: 7 })).toBeNull();
    expect(
      choosePinchRunner({ ...base, runner: hitter("f", "LF", { speed: 85 }) }),
    ).toBeNull();
  });

  it("puts a better glove in with a late lead, only where he can play", () => {
    const lineup = [
      { player: batter, slot: "SS" as const },
      { player: hitter("dh", "DH"), slot: "DH" as const },
    ];
    const base = {
      bench: [{ player: glove, role: "defense" as const }],
      used: new Set<string>(),
      lineup,
      inning: 8,
      leading: true,
    };
    expect(chooseDefense(base)).toMatchObject({
      index: 0,
      sub: { player: { id: "d" } },
    });
    expect(chooseDefense({ ...base, leading: false })).toBeNull();
    expect(chooseDefense({ ...base, inning: 7 })).toBeNull();
    // A glove who can't play the position isn't used there.
    const catcherOnly = hitter("c", "C", { fielding: 95, arm: 95 });
    expect(
      chooseDefense({
        ...base,
        bench: [{ player: catcherOnly, role: "defense" }],
      }),
    ).toBeNull();
  });

  it("covers an injury with the best fit left, never a pitcher", () => {
    const pitcher: BaseballPlayer = {
      ...hitter("p", "SS"),
      primaryPosition: "P",
      pitcherRole: "reliever",
    };
    const bench = [
      { player: pitcher, role: "injury" as const },
      { player: hitter("lf", "LF"), role: "injury" as const },
      { player: hitter("ss2", "SS"), role: "pinchRunner" as const },
    ];
    expect(
      chooseInjuryCover({
        bench,
        used: new Set(),
        injured: { player: batter, slot: "SS" },
      })?.player.id,
    ).toBe("ss2");
    expect(
      chooseInjuryCover({
        bench: [bench[0] as never],
        used: new Set(),
        injured: { player: batter, slot: "SS" },
      }),
    ).toBeNull();
  });
});

describe("auto-pick and the lineup style (D212)", () => {
  const r = createRng("roster");
  const roster: BaseballPlayer[] = [
    ...POSITIONS.filter((p) => p !== "P").flatMap((pos, i) =>
      [0, 1].map(
        (k) =>
          ({
            id: `${pos}-${k}`,
            ...generatePlayer(r.fork(`${i}-${k}`), {
              position: pos,
              overall: 50 + k * 10,
            }),
          }) as BaseballPlayer,
      ),
    ),
    ...Array.from(
      { length: 13 },
      (_, i) =>
        ({
          id: `P-${i}`,
          ...generatePlayer(r.fork(`p${i}`), {
            position: "P",
            overall: 50 + i,
            role: i < 6 ? "starter" : "reliever",
          }),
        }) as BaseballPlayer,
    ),
  ];

  it("fills every position once, a rotation of 5, a bullpen of 8 and a bench of 5", () => {
    const squad = autoPickSquad(roster);
    expect(squad.batters).toHaveLength(9);
    expect(new Set(squad.batters.map((b) => b.slot))).toEqual(
      new Set([...FIELD_POSITIONS, "DH"]),
    );
    expect(squad.rotation).toHaveLength(5);
    expect(squad.rotation.every((p) => p.pitcherRole === "starter")).toBe(true);
    expect(squad.bullpen).toHaveLength(8);
    expect(squad.bench).toHaveLength(5);
    expect(squad.bench.map((b) => b.role).slice(0, 3)).toEqual([
      "pinchHitter",
      "pinchRunner",
      "defense",
    ]);
    const ids = [
      ...squad.batters.map((b) => b.player.id),
      ...squad.rotation.map((p) => p.id),
      ...squad.bullpen.map((p) => p.id),
      ...squad.bench.map((b) => b.player.id),
    ];
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("plays the better player of two at each position, and skips the injured", () => {
    const squad = autoPickSquad(roster);
    for (const b of squad.batters)
      if (b.slot !== "DH") expect(b.player.id).toBe(`${b.slot}-1`);
    const hurt = autoPickSquad(roster, { available: (id) => id !== "SS-1" });
    expect(hurt.batters.some((b) => b.player.id === "SS-1")).toBe(false);
  });

  it("leans to Bat or to Field with the style", () => {
    const bat = hitter("bat", "SS", {
      contact: 85,
      power: 85,
      eye: 85,
      speed: 60,
      fielding: 35,
      arm: 35,
    });
    const glove = hitter("glove", "SS", {
      contact: 35,
      power: 35,
      eye: 35,
      speed: 50,
      fielding: 85,
      arm: 85,
    });
    expect(styledRating(bat, "SS", "batFirst")).toBeGreaterThan(
      styledRating(glove, "SS", "batFirst"),
    );
    expect(styledRating(glove, "SS", "gloveFirst")).toBeGreaterThan(
      styledRating(bat, "SS", "gloveFirst"),
    );
    // The DH is all bat whatever the style.
    expect(styledRating(bat, "DH", "gloveFirst")).toBe(
      styledRating(bat, "DH", "batFirst"),
    );
    expect(battingRating(bat.attributes)).toBeGreaterThan(
      fieldingRating(bat.attributes, "SS") as number,
    );
  });

  it("leads off with on-base hitters and puts power third to fifth", () => {
    const nine = Array.from({ length: 9 }, (_, i) => ({
      player: hitter(`h${i}`, "LF", {
        eye: i === 7 || i === 8 ? 90 : 50,
        contact: i === 7 || i === 8 ? 90 : 50,
        power: i < 3 ? 90 : 40,
      }),
    }));
    const order = battingOrder(nine).map((b) => b.player.id);
    expect(new Set(order.slice(0, 2))).toEqual(new Set(["h7", "h8"]));
    expect(new Set(order.slice(2, 5))).toEqual(new Set(["h0", "h1", "h2"]));
  });
});

describe("the bench in a game", () => {
  const r = createRng("bench-game");
  const make = (seed: string): BaseballTeam => {
    const roster: BaseballPlayer[] = [
      ...[
        ...FIELD_POSITIONS,
        "DH" as const,
        "LF" as const,
        "SS" as const,
        "CF" as const,
        "1B" as const,
        "C" as const,
      ].map(
        (pos, i) =>
          ({
            id: `${seed}-${pos}-${i}`,
            ...generatePlayer(r.fork(`${seed}${i}`), {
              position: pos,
              overall: 50 + (i % 4) * 8,
            }),
          }) as BaseballPlayer,
      ),
      ...Array.from(
        { length: 13 },
        (_, i) =>
          ({
            id: `${seed}-P${i}`,
            ...generatePlayer(r.fork(`${seed}p${i}`), {
              position: "P",
              overall: 60,
              role: i < 5 ? "starter" : "reliever",
            }),
          }) as BaseballPlayer,
      ),
    ];
    const squad = autoPickSquad(roster);
    // A clearly faster runner and a clearly better glove at shortstop.
    const ss = squad.batters.find((b) => b.slot === "SS")
      ?.player as BaseballPlayer;
    return {
      id: seed,
      batters: squad.batters,
      pitcher: squad.rotation[0] as BaseballPlayer,
      bullpen: squad.bullpen,
      bench: [
        squad.bench[0] as never,
        {
          player: hitter(`${seed}-runner`, "CF", { speed: 99 }),
          role: "pinchRunner" as const,
        },
        {
          player: hitter(`${seed}-glove`, "SS", { fielding: 99, arm: 99 }),
          role: "defense" as const,
          replaces: ss.id,
        },
        ...squad.bench.slice(3),
      ],
    };
  };
  const home = make("h");
  const away = make("a");

  it("makes substitutions, and nobody taken out comes back", () => {
    const roles = new Map<string, number>();
    for (let i = 0; i < 300; i++) {
      const g = simulateGame(
        { home, away, mode: "league", config: defaultBaseballConfig() },
        `sub${i}`,
      );
      const out = new Set<string>();
      for (const e of g.events) {
        if (e.type === "substitution") {
          roles.set(e.role, (roles.get(e.role) ?? 0) + 1);
          expect(out.has(e.in)).toBe(false);
          out.add(e.out);
        }
        if (e.type === "pitch") expect(out.has(e.batter)).toBe(false);
      }
    }
    for (const role of ["pinchHitter", "pinchRunner", "defense"])
      expect(roles.get(role) ?? 0).toBeGreaterThan(0);
  });

  it("records injuries in days, and covers them from the bench", () => {
    const config = {
      ...defaultBaseballConfig(),
      bench: {
        ...defaultBaseballConfig().bench,
        injuryPerPlateAppearance: 0.05,
      },
    };
    let hurt = 0;
    let covered = 0;
    for (let i = 0; i < 50; i++) {
      const g = simulateGame({ home, away, mode: "league", config }, `inj${i}`);
      for (const inj of g.result.injuries) {
        hurt++;
        expect(inj.days).toBeGreaterThanOrEqual(1);
        expect(inj.days).toBeLessThanOrEqual(15);
      }
      covered += g.events.filter(
        (e) => e.type === "substitution" && e.role === "injury",
      ).length;
    }
    expect(hurt).toBeGreaterThan(20);
    expect(covered).toBeGreaterThan(0);
  });
});
