import { createRng } from "@lfs/core";
import { describe, expect, it } from "vitest";
import { generateAiTeam } from "../src/ai-team";
import { playoffBracket } from "../src/bracket";
import { defaultSoccerConfig } from "../src/match";
import { squadToTeam } from "../src/matchday";
import {
  newLeague,
  playWeek,
  type SeasonFixture,
  type SeasonState,
  table,
} from "../src/season-play";

const config = defaultSoccerConfig();

function managerSide() {
  const t = generateAiTeam(createRng("manager"), 1500, "me");
  return {
    team: squadToTeam("me", t.squad, new Map(t.players.map((p) => [p.id, p]))),
    names: new Map(t.players.map((p) => [p.id, p.displayName])),
  };
}

/** Plays a season, returning the state after every week. */
function seasonStates(seed: string, size?: number): SeasonState[] {
  const league = newLeague(
    seed,
    { name: "My Club", elo: 1500 },
    [],
    undefined,
    undefined,
    size,
  );
  let state: SeasonState = {
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
  const states = [state];
  const manager = managerSide();
  let next = state.fixtures.length;
  while (state.status !== "finished") {
    const out = playWeek(state, manager, config);
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
    states.push(state);
  }
  return states;
}

describe("playoff bracket (D184)", () => {
  const states = seasonStates("bracket");
  const end = states.at(-1) as SeasonState;

  it("draws a 12-club bracket that matches every playoff fixture played", () => {
    const b = playoffBracket(end.slots, end.fixtures);
    expect(b.final).toBe(true);
    expect(b.rounds.map((r) => [r.stage, r.matches.length])).toEqual([
      ["play_in", 1],
      ["quarter", 4],
      ["semi", 2],
      ["final", 1],
    ]);
    const playoffs = end.fixtures.filter((f) => f.stage !== "league");
    const drawn = b.rounds.flatMap((r) => r.matches.map((m) => m.fixture?.id));
    expect(new Set(drawn)).toEqual(new Set(playoffs.map((f) => f.id)));
    for (const r of b.rounds)
      for (const m of r.matches) expect(m.winner).not.toBeNull();
    // Seeds are league places: 1st meets the play-in winner.
    const places = table(end.slots, end.fixtures).map((s) => Number(s.team));
    const q1 = b.rounds[1]?.matches[0];
    expect(q1?.home.slot).toBe(places[0]);
    expect(q1?.home.seed).toBe(1);
    expect(q1?.away.slot).toBe(b.rounds[0]?.matches[0]?.winner);
  });

  it("shows places and placeholders before the playoffs are played", () => {
    const mid = states.find((s) => s.week === 10) as SeasonState;
    const b = playoffBracket(mid.slots, mid.fixtures);
    expect(b.final).toBe(false);
    const q = b.rounds[1]?.matches[1];
    expect([q?.home.seed, q?.away.seed]).toEqual([2, 7]);
    expect(q?.fixture).toBeNull();
    const final = b.rounds[3]?.matches[0];
    expect(final?.home.slot).toBeNull();
    expect(final?.home.placeholder).toBe("Winner of semi-final 1");
  });

  it("draws semi-finals and a final for an 8-club season", () => {
    const old = seasonStates("bracket8", 8).at(-1) as SeasonState;
    const b = playoffBracket(old.slots, old.fixtures);
    expect(b.rounds.map((r) => r.stage)).toEqual(["semi", "final"]);
    expect(b.rounds[1]?.matches[0]?.winner).not.toBeNull();
    expect(b.rounds[0]?.matches[0]?.home.seed).toBe(1);
  });
});
