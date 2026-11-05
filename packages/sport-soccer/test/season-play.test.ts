import { createRng } from "@lfs/core";
import { describe, expect, it } from "vitest";
import { generateAiTeam } from "../src/ai-team";
import { seasonStats } from "../src/ghosts";
import { defaultSoccerConfig } from "../src/match";
import { squadToTeam } from "../src/matchday";
import {
  aiTeam,
  hasBracket,
  LEAGUE_SIZE,
  leagueWeeks,
  MANAGER_SLOT,
  newLeague,
  playWeek,
  replayFixture,
  type SeasonFixture,
  type SeasonState,
  STAGE_MATCH_NAMES,
  STAGE_NAMES,
  table,
} from "../src/season-play";

const config = defaultSoccerConfig();

/** The manager's side: an AI-built team standing in for a real roster. */
function managerSide(rating: number) {
  const t = generateAiTeam(createRng("manager"), rating, "me");
  return {
    team: squadToTeam("me", t.squad, new Map(t.players.map((p) => [p.id, p]))),
    names: new Map(t.players.map((p) => [p.id, p.displayName])),
  };
}

/** 8-team leagues are what seasons from before D117 had. */
const LEGACY = 8;
const legacyLeague = (seed: string, manager: { name: string; elo: number }) =>
  newLeague(seed, manager, [], undefined, undefined, LEGACY);

function startSeason(seed: string, elo = 1500, size = LEGACY): SeasonState {
  const league = newLeague(
    seed,
    { name: "My Club", elo },
    [],
    undefined,
    undefined,
    size,
  );
  return {
    seed,
    status: "regular",
    week: 1,
    slots: league.slots,
    elo: Object.fromEntries(league.slots.map((s) => [s.slot, s.startRating])),
    fixtures: league.fixtures.map((f, i) => ({
      ...f,
      id: `f${i}`,
      homeScore: null,
      awayScore: null,
      winner: null,
    })),
  };
}

/** Plays a whole season, applying each week's outcome like the web app does. */
function playSeason(
  seed: string,
  elo = 1500,
  squadRating = elo,
  size = LEGACY,
) {
  let state = startSeason(seed, elo, size);
  const manager = managerSide(squadRating);
  let funds = 0;
  let weeks = 0;
  let next = state.fixtures.length;
  while (state.status !== "finished") {
    const out = playWeek(state, manager, config);
    weeks++;
    funds += out.managerFunds;
    const fixtures: SeasonFixture[] = state.fixtures.map((f) => {
      const p = out.played.find((x) => x.id === f.id);
      return p
        ? {
            ...f,
            homeScore: p.homeScore,
            awayScore: p.awayScore,
            winner: p.winner,
          }
        : f;
    });
    for (const n of out.newFixtures)
      fixtures.push({
        ...n,
        id: `f${next++}`,
        homeScore: null,
        awayScore: null,
        winner: null,
      });
    state = {
      ...state,
      status: out.status,
      week: out.week,
      elo: { ...state.elo, ...out.elo },
      fixtures,
    };
  }
  return { state, funds, weeks };
}

describe("newLeague (D8, D16, D32)", () => {
  it("builds 8 teams with unique names and a 14-week schedule", () => {
    const league = legacyLeague("lg", { name: "My Club", elo: 1500 });
    expect(league.slots).toHaveLength(LEGACY);
    expect(league.slots[0]).toEqual({
      slot: 0,
      name: "My Club",
      kind: "manager",
      startRating: 1500,
    });
    expect(league.slots.slice(1).map((s) => s.startRating)).toEqual([
      1200, 1300, 1400, 1500, 1600, 1700, 1800,
    ]);
    expect(new Set(league.slots.map((s) => s.name.toLowerCase())).size).toBe(8);
    for (let i = 0; i < 30; i++) {
      const places = legacyLeague(`places-${i}`, {
        name: "My Club",
        elo: 1500,
      }).slots.map((s) => s.name.slice(0, s.name.lastIndexOf(" ")));
      expect(new Set(places).size, `league ${i}`).toBe(8);
    }
    expect(league.fixtures).toHaveLength(56);
    expect(Math.max(...league.fixtures.map((f) => f.week))).toBe(14);
    expect(legacyLeague("lg", { name: "My Club", elo: 1500 })).toEqual(league);
  });

  it("renames an AI team whose name clashes", () => {
    const first = legacyLeague("clash", { name: "x", elo: 1500 });
    const taken = first.slots[1]?.name as string;
    const again = legacyLeague("clash", { name: taken, elo: 1500 });
    expect(again.slots[1]?.name).not.toBe(taken);
    expect(new Set(again.slots.map((s) => s.name.toLowerCase())).size).toBe(8);
  });

  it("rebuilds the same AI squad from the seed", () => {
    expect(aiTeam("lg", 3, 1400)).toEqual(aiTeam("lg", 3, 1400));
  });
});

describe("playWeek", () => {
  const { state, funds, weeks } = playSeason("full-season");

  it("plays 14 league weeks, semi-finals and a final", () => {
    expect(weeks).toBe(16);
    expect(state.status).toBe("finished");
    expect(state.week).toBe(16);
    const stages = state.fixtures.map((f) => f.stage);
    expect(stages.filter((s) => s === "league")).toHaveLength(56);
    expect(stages.filter((s) => s === "semi")).toHaveLength(2);
    expect(stages.filter((s) => s === "final")).toHaveLength(1);
    expect(state.fixtures.every((f) => f.homeScore !== null)).toBe(true);
    // Knockout matches always have a winner; league ones don't record one.
    for (const f of state.fixtures)
      if (f.stage === "league") expect(f.winner).toBeNull();
      else expect(f.winner).not.toBeNull();
  });

  it("puts the top 4 into the semis, 1st v 4th and 2nd v 3rd", () => {
    const top = table(state.slots, state.fixtures)
      .slice(0, 4)
      .map((r) => Number(r.team));
    const semis = state.fixtures.filter((f) => f.stage === "semi");
    expect(semis.map((f) => [f.homeSlot, f.awaySlot])).toEqual([
      [top[0], top[3]],
      [top[1], top[2]],
    ]);
  });

  it("keeps Elo zero-sum across the league", () => {
    const total = Object.values(state.elo).reduce((a, b) => a + b, 0);
    expect(total).toBe(1500 * 8);
  });

  it("pays the manager 14+ matches' worth plus any playoff bonus", () => {
    expect(funds).toBeGreaterThanOrEqual(14 * 1_000);
    expect(funds).toBeLessThanOrEqual(16 * 1_500 + 10_000);
  });

  it("is deterministic and refuses to play on", () => {
    expect(playSeason("full-season").state).toEqual(state);
    expect(() => playWeek(state, managerSide(1500), config)).toThrow(/over/);
    const stuck = { ...startSeason("x"), week: 40 };
    expect(() => playWeek(stuck, managerSide(1500), config)).toThrow(
      /Nothing to play/,
    );
  });

  it("records names, goals and stats in match summaries", () => {
    const outcome = playWeek(startSeason("summary"), managerSide(1500), config);
    expect(outcome.played).toHaveLength(4);
    const goals = outcome.played.flatMap((p) =>
      p.summary.events.filter((e) => e.type === "goal"),
    );
    const scored = outcome.played.reduce(
      (a, p) => a + p.homeScore + p.awayScore,
      0,
    );
    expect(goals).toHaveLength(scored);
    for (const g of goals) expect(g.player).not.toBe("Unknown");
    expect(outcome.status).toBe("regular");
    expect(outcome.week).toBe(2);
  });

  it("pays playoff bonuses when the manager's side is much stronger", () => {
    // A squad far above its Elo should reach the playoffs: 16 matches of pay
    // can't exceed 24,000 without a bonus.
    const { state: s, funds: f } = playSeason("strong", 1500, 2100);
    const inPlayoffs = s.fixtures.some(
      (x) =>
        x.stage !== "league" &&
        (x.homeSlot === MANAGER_SLOT || x.awaySlot === MANAGER_SLOT),
    );
    expect(inPlayoffs).toBe(true);
    expect(f).toBeGreaterThan(14 * 1_000 + 2_000);
  });
});

it("knows the manager's slot", () => {
  expect(MANAGER_SLOT).toBe(0);
});

describe("replayFixture", () => {
  it("plays every match of a season again exactly", () => {
    const { state } = playSeason("replay");
    const manager = managerSide(1500);
    // Knockout matches too: extra time and penalties come out the same.
    expect(state.fixtures.some((f) => f.stage === "final")).toBe(true);
    for (const f of state.fixtures) {
      const r = replayFixture(state.seed, state.slots, f, manager, config);
      expect(r.output.result.score).toEqual({
        home: f.homeScore,
        away: f.awayScore,
      });
      if (f.stage !== "league") expect(r.output.result.winner).toBe(f.winner);
    }
  });

  it("gives the same summary, names and heatmaps as the week did", () => {
    const state = startSeason("replay-week");
    const manager = managerSide(1500);
    const out = playWeek(state, manager, config);
    for (const p of out.played) {
      const f = state.fixtures.find((x) => x.id === p.id) as SeasonFixture;
      const r = replayFixture(state.seed, state.slots, f, manager, config);
      expect(r.summary).toEqual(p.summary);
      expect(r.names.size).toBeGreaterThanOrEqual(22);
      const sum = (side: "home" | "away") =>
        r.output.influence[side].values.reduce((a, v) => a + v, 0);
      expect(sum("home")).toBeGreaterThan(0);
      expect(sum("away")).toBeGreaterThan(0);
    }
  });

  it("replays from the manager's team as saved in the database (JSON)", () => {
    const state = startSeason("replay-json");
    const manager = managerSide(1500);
    const out = playWeek(state, manager, config);
    const saved = {
      team: JSON.parse(JSON.stringify(manager.team)),
      names: new Map(
        Object.entries(
          JSON.parse(JSON.stringify(Object.fromEntries(manager.names))),
        ) as [string, string][],
      ),
    };
    for (const p of out.played) {
      const f = state.fixtures.find((x) => x.id === p.id) as SeasonFixture;
      expect(
        replayFixture(state.seed, state.slots, f, saved, config).summary,
      ).toEqual(p.summary);
    }
  });

  it("replays AI v AI matches without the manager's team", () => {
    const state = startSeason("replay-ai");
    const ai = state.fixtures.find(
      (f) =>
        f.week === 1 &&
        f.homeSlot !== MANAGER_SLOT &&
        f.awaySlot !== MANAGER_SLOT,
    ) as SeasonFixture;
    const a = replayFixture(state.seed, state.slots, ai, {}, config);
    const b = replayFixture(state.seed, state.slots, ai, {}, config);
    expect(a.output.events).toEqual(b.output.events);
    const mine = state.fixtures.find(
      (f) => f.homeSlot === MANAGER_SLOT || f.awaySlot === MANAGER_SLOT,
    ) as SeasonFixture;
    expect(() =>
      replayFixture(state.seed, state.slots, mine, {}, config),
    ).toThrow(/wasn't kept/);
  });
});

describe("12-club seasons (D115, D117)", () => {
  it("builds 12 clubs and a 22-week double round-robin", () => {
    const league = newLeague("twelve", { name: "My Club", elo: 1500 });
    expect(league.slots).toHaveLength(LEAGUE_SIZE);
    expect(new Set(league.slots.map((s) => s.name.toLowerCase())).size).toBe(
      12,
    );
    expect(Math.max(...league.fixtures.map((f) => f.week))).toBe(22);
    expect(leagueWeeks(12)).toBe(22);
    expect(leagueWeeks(8)).toBe(14);
    for (let w = 1; w <= 22; w++)
      expect(league.fixtures.filter((f) => f.week === w)).toHaveLength(6);
    for (const s of league.slots)
      expect(
        league.fixtures.filter(
          (f) => f.homeSlot === s.slot || f.awaySlot === s.slot,
        ),
      ).toHaveLength(22);
    expect(hasBracket(league.slots)).toBe(true);
    expect(
      hasBracket(legacyLeague("eight", { name: "X", elo: 1500 }).slots),
    ).toBe(false);
  });

  const { state, weeks } = playSeason("bracket", 1500, 1500, 12);
  const standings = table(state.slots, state.fixtures);
  const seed = (i: number) => Number(standings[i]?.team);
  const round = (stage: string) =>
    state.fixtures.filter((f) => f.stage === stage);
  const winner = (f: SeasonFixture) =>
    f.winner === "home" ? f.homeSlot : f.awaySlot;

  it("plays 22 league weeks, a play-in, quarter-finals, semi-finals and a final", () => {
    expect(weeks).toBe(26);
    expect(round("play_in").map((f) => f.week)).toEqual([23]);
    expect(round("quarter").map((f) => f.week)).toEqual([24, 24, 24, 24]);
    expect(round("semi").map((f) => f.week)).toEqual([25, 25]);
    expect(round("final").map((f) => f.week)).toEqual([26]);
    expect(state.status).toBe("finished");
  });

  it("plays 8th v 9th, then 1 v play-in winner, 2 v 7, 3 v 6, 4 v 5", () => {
    const [pi] = round("play_in") as [SeasonFixture];
    expect([pi.homeSlot, pi.awaySlot]).toEqual([seed(7), seed(8)]);
    const quarters = round("quarter").map((f) => [f.homeSlot, f.awaySlot]);
    expect(quarters).toEqual([
      [seed(0), winner(pi)],
      [seed(1), seed(6)],
      [seed(2), seed(5)],
      [seed(3), seed(4)],
    ]);
    const qw = round("quarter").map(winner);
    const semis = round("semi").map((f) => new Set([f.homeSlot, f.awaySlot]));
    expect(semis).toEqual([new Set([qw[0], qw[3]]), new Set([qw[1], qw[2]])]);
    const [final] = round("final") as [SeasonFixture];
    expect(new Set([final.homeSlot, final.awaySlot])).toEqual(
      new Set(round("semi").map(winner)),
    );
  });

  it("records how far each club got, quarter-finals included", () => {
    const quarterLoser = round("quarter").map((f) =>
      f.winner === "home" ? f.awaySlot : f.homeSlot,
    )[0] as number;
    expect(
      seasonStats(state.slots, state.fixtures, quarterLoser).playoffs,
    ).toBe("quarter");
    expect(seasonStats(state.slots, state.fixtures, seed(11)).playoffs).toBe(
      "none",
    );
  });

  it("pays the quarter-final bonus to a manager who finishes in the top 7", () => {
    // A much stronger manager: top 7 nearly every time, and further.
    const strong = playSeason("bracket-strong", 1500, 1900, 12);
    const table12 = table(strong.state.slots, strong.state.fixtures);
    const place = table12.findIndex((r) => Number(r.team) === MANAGER_SLOT);
    expect(place).toBeLessThan(7);
    expect(strong.funds).toBeGreaterThanOrEqual(22 * 1_000 + 1_000);
    expect(STAGE_NAMES.quarter).toBe("Quarter-finals");
    expect(STAGE_MATCH_NAMES.play_in).toBe("play-in");
  });
});
