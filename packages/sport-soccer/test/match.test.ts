import { createRng, sumRows } from "@lfs/core";
import { describe, expect, it } from "vitest";
import { generateTeam } from "../src/harness";
import {
  DEFAULT_MATCH_TUNING,
  defaultSoccerConfig,
  type SoccerEvent,
  type SoccerTeam,
  simulateMatch,
} from "../src/match";
import { soccer } from "../src/sport";
import { flipMap, placeholderTemplates, SOCCER_GRID } from "../src/templates";

const config = defaultSoccerConfig();
const rng = createRng("fixtures");
const teamA = generateTeam(rng, "a", 65);
const teamB = generateTeam(rng, "b", 60);
// An equally rated opponent with different player ids, for even knockout ties.
const twin = generateTeam(createRng("twin"), "twin", 65);

const play = (
  seed: string,
  mode: "league" | "knockout" = "league",
  home = teamA,
  away = teamB,
) => simulateMatch({ home, away, mode, config }, seed);

describe("simulateMatch", () => {
  it("replays exactly from the same inputs and seed", () => {
    const a = play("replay-1");
    const b = play("replay-1");
    expect(b.result).toEqual(a.result);
    expect(b.events).toEqual(a.events);
    expect([...b.influence.home.values]).toEqual([...a.influence.home.values]);
  });

  it("gives different matches for different seeds", () => {
    const results = new Set(
      Array.from({ length: 20 }, (_, i) =>
        JSON.stringify(play(`varied-${i}`).events),
      ),
    );
    expect(results.size).toBeGreaterThan(15);
  });

  it("keeps the score, goal events and winner consistent", () => {
    for (let i = 0; i < 50; i++) {
      const { result, events } = play(`consistent-${i}`);
      const goals = (side: "home" | "away") =>
        events.filter((e) => e.type === "goal" && e.side === side).length;
      expect(goals("home")).toBe(result.score.home);
      expect(goals("away")).toBe(result.score.away);
      const expected =
        result.score.home > result.score.away
          ? "home"
          : result.score.away > result.score.home
            ? "away"
            : null;
      expect(result.winner).toBe(expected);
      expect(result.possession.home + result.possession.away).toBeCloseTo(1);
      expect(result.shots.home).toBeGreaterThanOrEqual(result.score.home);
      expect(events.at(-1)?.type).toBe("full_time");
      expect(result.decidedBy).toBeUndefined();
    }
  });

  it("orders events by minute within 90 minutes in league play", () => {
    const { events } = play("minutes");
    const minutes = events.map((e) => e.minute);
    expect([...minutes].sort((x, y) => x - y)).toEqual(minutes);
    expect(Math.max(...minutes)).toBeLessThanOrEqual(90);
    expect(Math.min(...minutes)).toBeGreaterThanOrEqual(1);
  });

  it("always finds a winner in knockout matches (D30)", () => {
    const seen = new Set<string | undefined>();
    for (let i = 0; i < 300; i++) {
      const { result, events } = play(`ko-${i}`, "knockout", teamA, twin);
      expect(result.winner).not.toBeNull();
      seen.add(result.decidedBy);
      if (result.decidedBy === "penalties") {
        const p = result.penalties as { home: number; away: number };
        expect(p.home).not.toBe(p.away);
        expect(result.winner).toBe(p.home > p.away ? "home" : "away");
        expect(result.score.home).toBe(result.score.away);
        expect(events.some((e) => e.type === "penalty")).toBe(true);
        expect(events.at(-1)).toEqual({ minute: 120, type: "full_time" });
      }
      if (result.decidedBy === "extra_time") {
        expect(result.score.home).not.toBe(result.score.away);
        expect(events.some((e) => e.type === "extra_time")).toBe(true);
      }
    }
    // Over 300 even matches, all three endings happen.
    expect(seen).toEqual(new Set([undefined, "extra_time", "penalties"]));
  });

  it("ends shoot-outs early when one side can't catch up, and plays sudden death when level", () => {
    let early = false;
    let suddenDeath = false;
    for (let i = 0; i < 400 && !(early && suddenDeath); i++) {
      const { result, events } = play(`pens-${i}`, "knockout", teamA, twin);
      if (result.decidedBy !== "penalties") continue;
      const kicks = events.filter(
        (e): e is Extract<SoccerEvent, { type: "penalty" }> =>
          e.type === "penalty",
      ).length;
      if (kicks < 10) early = true;
      if (kicks > 10) suddenDeath = true;
    }
    expect(early).toBe(true);
    expect(suddenDeath).toBe(true);
  });

  it("lets the better team win more often", () => {
    const strong = generateTeam(createRng("strong"), "strong", 80);
    const weak = generateTeam(createRng("weak"), "weak", 50);
    let wins = 0;
    for (let i = 0; i < 200; i++) {
      if (play(`gap-${i}`, "league", strong, weak).result.winner === "home")
        wins++;
    }
    expect(wins / 200).toBeGreaterThan(0.75);
  });

  it("plays 7–10 starters, forfeits below 7, and still needs a keeper (D183)", () => {
    const ten: SoccerTeam = { id: "ten", lineup: teamA.lineup.slice(0, 10) };
    const short = play("x", "league", ten, teamB);
    expect(short.result.decidedBy).toBeUndefined();
    expect(Object.keys(short.result.players).length).toBeGreaterThan(10);
    const six: SoccerTeam = { id: "six", lineup: teamA.lineup.slice(0, 6) };
    const forfeit = play("x", "knockout", six, teamB);
    expect(forfeit.result).toMatchObject({
      score: { home: 0, away: 3 },
      winner: "away",
      decidedBy: "forfeit",
      players: {},
    });
    expect(play("x", "league", teamB, six).result.score).toEqual({
      home: 3,
      away: 0,
    });
    const twelve: SoccerTeam = {
      id: "twelve",
      lineup: [
        ...teamA.lineup,
        teamA.lineup[1] as (typeof teamA.lineup)[number],
      ],
    };
    expect(() => play("x", "league", twelve, teamB)).toThrow(/12 starters/);
    const noKeeper: SoccerTeam = {
      id: "nokeeper",
      lineup: teamA.lineup.map((s) =>
        s.slot === "GK" ? { ...s, slot: "CB" as const } : s,
      ),
    };
    expect(() => play("x", "league", noKeeper, teamB)).toThrow(/no goalkeeper/);
  });

  it("a side a man down wins clearly less often (D183)", () => {
    let full = 0;
    let down = 0;
    for (let i = 0; i < 300; i++) {
      const r = createRng(`md${i}`);
      const a = generateTeam(r, "a", 60);
      const b = generateTeam(r, "b", 60);
      const tenA = {
        ...a,
        lineup: a.lineup.filter((s) => s.slot !== "ST").slice(0, 10),
      };
      const w = play(`md${i}`, "league", tenA, b).result.winner;
      if (w === "home") down++;
      if (w === "away") full++;
    }
    expect(full).toBeGreaterThan(down * 1.3);
  });

  it("returns both influence maps in the home team's frame", () => {
    const { influence } = play("maps");
    const { rows } = SOCCER_GRID;
    // Home attacks towards the high rows; the away team's attackers sit in the low rows.
    expect(sumRows(influence.home, rows - 5, rows)).toBeGreaterThan(
      sumRows(influence.home, 0, 5) * 0.2,
    );
    expect(sumRows(influence.away, 0, 3)).toBeLessThan(
      sumRows(influence.away, rows - 3, rows),
    );
  });
});

describe("templates", () => {
  it("have one normalised template per position on the 25 × 17 grid", () => {
    const templates = placeholderTemplates();
    for (const t of Object.values(templates)) {
      expect(t.size).toEqual({ rows: 25, cols: 17 });
      expect(t.values.reduce((a, b) => a + b, 0)).toBeCloseTo(1);
    }
    // The keeper lives near their own goal; the striker near the opponent's.
    expect(sumRows(templates.GK, 0, 5)).toBeGreaterThan(0.9);
    expect(sumRows(templates.ST, 17, 25)).toBeGreaterThan(0.7);
  });

  it("flips a map end to end", () => {
    const flipped = flipMap(placeholderTemplates().GK);
    expect(sumRows(flipped, 20, 25)).toBeGreaterThan(0.9);
  });
});

describe("soccer sport", () => {
  it("implements the Sport interface", () => {
    expect(soccer.id).toBe("soccer");
    expect(soccer.grid).toEqual(SOCCER_GRID);
    expect(soccer.playersOnField).toBe(11);
    expect(soccer.allowsDraws).toBe(true);
    const out = soccer.simulate(
      { home: teamA, away: teamB, mode: "league", config },
      7,
    );
    expect(out.result.score).toBeDefined();
  });

  it("keeps the agreed tuning defaults", () => {
    expect(DEFAULT_MATCH_TUNING).toMatchObject({
      phases: 30,
      chanceRate: 0.34,
      shotRate: 0.6,
      goalRate: 0.45,
      chanceSharpness: 1.5,
    });
  });
});
