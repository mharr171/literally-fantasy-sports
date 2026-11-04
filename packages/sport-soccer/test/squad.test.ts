import { createRng } from "@lfs/core";
import { describe, expect, it } from "vitest";
import { generateTeam } from "../src/harness";
import {
  defaultSoccerConfig,
  type MatchTuning,
  type SoccerConfig,
  type SoccerEvent,
  type SoccerTeam,
  simulateMatch,
} from "../src/match";

const base = defaultSoccerConfig();
const withTuning = (t: Partial<MatchTuning>): SoccerConfig => ({
  ...base,
  tuning: { ...base.tuning, ...t },
});

const home = generateTeam(createRng("squad-h"), "h", 65);
const away = generateTeam(createRng("squad-a"), "a", 65);

function play(
  seed: string,
  config = base,
  h: SoccerTeam = home,
  a: SoccerTeam = away,
) {
  return simulateMatch({ home: h, away: a, mode: "league", config }, seed);
}

const ofType = <T extends SoccerEvent["type"]>(
  events: SoccerEvent[],
  type: T,
) =>
  events.filter((e): e is Extract<SoccerEvent, { type: T }> => e.type === type);

const quiet = { injuryRate: 0, yellowRate: 0, redRate: 0 };

describe("fatigue and player reports", () => {
  it("reports minutes and energy for every player in the squad", () => {
    const { result } = play(
      "reports",
      withTuning({ ...quiet, autoSubEnergy: 0 }),
    );
    const starter = home.lineup[5]?.player.id as string;
    const benchPlayer = home.bench?.[0]?.id as string;
    expect(result.players[starter]?.minutes).toBe(90);
    expect(result.players[starter]?.energy).toBeLessThan(100);
    expect(result.players[benchPlayer]).toMatchObject({
      minutes: 0,
      energy: 100,
    });
    expect(Object.keys(result.players)).toHaveLength(44);
  });

  it("tires low-stamina players faster, and keepers slowest", () => {
    const team = structuredClone(home);
    const [gk, lb, cb] = team.lineup;
    (
      lb as { player: { attributes: { stamina: number } } }
    ).player.attributes.stamina = 90;
    (
      cb as { player: { attributes: { stamina: number } } }
    ).player.attributes.stamina = 20;
    const { result } = play(
      "stamina",
      withTuning({ ...quiet, autoSubEnergy: 0 }),
      team,
    );
    const energy = (id: string) => result.players[id]?.energy as number;
    expect(energy(lb?.player.id as string)).toBeGreaterThan(
      energy(cb?.player.id as string),
    );
    expect(energy(gk?.player.id as string)).toBeGreaterThan(
      energy(lb?.player.id as string),
    );
  });

  it("starts players with low match fitness tired (M4 carries fitness between weeks)", () => {
    const id = home.lineup[6]?.player.id as string;
    const team: SoccerTeam = { ...home, fitness: { [id]: 60 } };
    const { result } = play(
      "fitness",
      withTuning({ ...quiet, autoSubEnergy: 0 }),
      team,
    );
    expect(result.players[id]?.energy).toBeLessThan(60);
  });
});

describe("substitutions", () => {
  it("auto-subs tired players, at most 5 subs in at most 3 windows", () => {
    for (let i = 0; i < 40; i++) {
      const { events, result } = play(
        `subs-${i}`,
        withTuning({ autoSubEnergy: 95 }),
      );
      for (const side of ["home", "away"] as const) {
        const subs = ofType(events, "sub").filter((e) => e.side === side);
        expect(subs.length).toBeLessThanOrEqual(5);
        expect(new Set(subs.map((s) => s.minute)).size).toBeLessThanOrEqual(3);
        for (const s of subs) {
          if (s.reason === "tired") expect(s.minute).toBeGreaterThanOrEqual(55);
          // Whoever came on played the rest of the match or less.
          expect(result.players[s.inId]?.minutes).toBeLessThanOrEqual(
            90 - s.minute + 3,
          );
        }
      }
    }
    const { events } = play("subs-0", withTuning({ autoSubEnergy: 95 }));
    expect(ofType(events, "sub").some((s) => s.reason === "tired")).toBe(true);
  });

  it("never brings on a sub who would play worse", () => {
    const weakBench: SoccerTeam = {
      ...home,
      bench: (home.bench ?? []).map((p) => ({
        ...p,
        attributes: Object.fromEntries(
          Object.keys(p.attributes).map((k) => [k, 1]),
        ) as typeof p.attributes,
      })),
    };
    const { events } = play(
      "weak-bench",
      withTuning({ ...quiet, autoSubEnergy: 95 }),
      weakBench,
    );
    expect(ofType(events, "sub").filter((s) => s.side === "home")).toHaveLength(
      0,
    );
  });

  it("follows the manager's sub plan first (D45)", () => {
    const outId = home.lineup[9]?.player.id as string;
    const inId = home.bench?.[9]?.id as string;
    const missingOut = "not-on-the-pitch";
    const team: SoccerTeam = {
      ...home,
      subPlan: [
        { minute: 60, outId, inId },
        { minute: 61, outId: missingOut, inId: home.bench?.[1]?.id as string },
      ],
    };
    const { events, result } = play("plan", withTuning(quiet), team);
    const planned = ofType(events, "sub").filter((s) => s.reason === "plan");
    expect(planned).toEqual([
      expect.objectContaining({ side: "home", outId, inId }),
    ]);
    expect(planned[0]?.minute).toBeGreaterThanOrEqual(60);
    expect(result.players[inId]?.minutes).toBeGreaterThan(0);
  });

  it("waits for a free window before making a planned sub", () => {
    const plan = home.lineup.slice(1, 5).map((s, i) => ({
      minute: 10 + i * 10,
      outId: s.player.id,
      inId: home.bench?.[i + 1]?.id as string,
    }));
    const { events } = play(
      "windows",
      withTuning({ ...quiet, maxSubWindows: 2, autoSubEnergy: 0 }),
      { ...home, subPlan: plan },
    );
    const subs = ofType(events, "sub").filter((s) => s.side === "home");
    // Only two stoppages: the first two plan lines, then no more.
    expect(subs).toHaveLength(2);
  });
});

describe("cards", () => {
  it("sends players off and leaves the team a player short", () => {
    const { events } = play(
      "reds",
      withTuning({ redRate: 0.2, injuryRate: 0, yellowRate: 0 }),
    );
    const reds = ofType(events, "red");
    expect(reds.length).toBeGreaterThan(0);
    // Red cards are never replaced by a sub.
    for (const red of reds) {
      expect(ofType(events, "sub").some((s) => s.outId === red.playerId)).toBe(
        false,
      );
    }
  });

  it("turns a second yellow into a red", () => {
    let found = false;
    for (let i = 0; i < 20 && !found; i++) {
      const { events, result } = play(
        `yellows-${i}`,
        withTuning({ yellowRate: 0.9, redRate: 0, injuryRate: 0 }),
      );
      const second = ofType(events, "red").find((r) => r.secondYellow);
      if (second) {
        found = true;
        expect(result.players[second.playerId]).toMatchObject({
          yellowCards: 2,
          redCard: true,
        });
      }
    }
    expect(found).toBe(true);
  });

  it("puts an outfielder in goal when the keeper is sent off and no subs are left", () => {
    let moved = false;
    for (let i = 0; i < 60 && !moved; i++) {
      const { events } = play(
        `keeper-${i}`,
        withTuning({ redRate: 0.3, yellowRate: 0, injuryRate: 0, maxSubs: 0 }),
      );
      moved = ofType(events, "position_change").some((e) => e.slot === "GK");
    }
    expect(moved).toBe(true);
  });
});

describe("injuries", () => {
  it("replaces injured players and records how long they're out", () => {
    const { events, result } = play(
      "injuries",
      withTuning({ injuryRate: 0.01, ...{ yellowRate: 0, redRate: 0 } }),
    );
    const injuries = ofType(events, "injury");
    expect(injuries.length).toBeGreaterThan(0);
    for (const inj of injuries) {
      expect(inj.weeks).toBeGreaterThanOrEqual(1);
      expect(inj.weeks).toBeLessThanOrEqual(4);
      expect(result.players[inj.playerId]?.injuryWeeks).toBe(inj.weeks);
    }
    expect(
      ofType(events, "sub").some(
        (s) => s.reason === "injury" || s.reason === "keeper",
      ),
    ).toBe(true);
  });

  it("plays on a player short when there's nobody left to bring on", () => {
    const noBench: SoccerTeam = { ...home, bench: [] };
    const { events } = play(
      "short",
      withTuning({ injuryRate: 0.02, yellowRate: 0, redRate: 0 }),
      noBench,
    );
    expect(ofType(events, "injury").some((e) => e.side === "home")).toBe(true);
    expect(ofType(events, "sub").filter((s) => s.side === "home")).toHaveLength(
      0,
    );
  });
});

describe("validation", () => {
  it("rejects a player listed twice", () => {
    const dup: SoccerTeam = {
      ...home,
      bench: [home.lineup[0]?.player as never],
    };
    expect(() => play("dup", base, dup)).toThrow(/more than once/);
  });

  it("still plays a team reduced to nobody without crashing", () => {
    const { result } = play(
      "chaos",
      withTuning({ redRate: 1, yellowRate: 0, injuryRate: 0 }),
      { ...home, bench: [] },
      { ...away, bench: [] },
    );
    expect(result.winner === null || typeof result.winner === "string").toBe(
      true,
    );
  });
});
