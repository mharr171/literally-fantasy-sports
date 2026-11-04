import { createRng } from "@lfs/core";
import { describe, expect, it } from "vitest";
import { generateAiTeam } from "../src/ai-team";
import {
  type GhostCandidate,
  ghostTeam,
  pickGhosts,
  type SnapshotPlayer,
  seasonStats,
  snapshotTeam,
} from "../src/ghosts";
import { defaultSoccerConfig } from "../src/match";
import { squadProblems, squadToTeam } from "../src/matchday";
import {
  newLeague,
  playWeek,
  type SeasonFixture,
  type SeasonState,
} from "../src/season-play";

function roster(
  seed: string,
  rating = 1500,
): {
  players: SnapshotPlayer[];
  squad: ReturnType<typeof generateAiTeam>["squad"];
} {
  const t = generateAiTeam(createRng(seed), rating, seed);
  return {
    players: t.players.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      attributes: p.attributes,
      primaryPosition: p.primaryPosition,
      secondaryPosition: p.secondaryPosition,
      chemistryColor: p.chemistryColor,
      overall: p.overall,
    })),
    squad: t.squad,
  };
}

const candidate = (
  id: string,
  teamId: string,
  elo: number,
  name = `${id} Club`,
): GhostCandidate => ({
  id,
  teamId,
  name,
  elo,
});

describe("snapshotTeam (D59)", () => {
  it("keeps a valid saved squad", () => {
    const { players, squad } = roster("snap");
    const snap = snapshotTeam(players, squad);
    expect(snap.squad).toEqual(squad);
    expect(snap.players).toHaveLength(22);
  });

  it("picks a fresh 22 when the saved squad no longer works", () => {
    const { players, squad } = roster("snap2");
    const broken = { ...squad, lineup: squad.lineup.slice(1) };
    const snap = snapshotTeam(players, broken);
    expect(
      squadProblems(snap.squad, new Set(players.map((p) => p.id))),
    ).toEqual([]);
    expect(snapshotTeam(players, null).squad.lineup).toHaveLength(11);
  });
});

describe("pickGhosts (D33)", () => {
  const pool = [
    candidate("a1", "A", 1500),
    candidate("a2", "A", 1520),
    candidate("b", "B", 1650),
    candidate("c", "C", 1350),
    candidate("far", "D", 2100),
    candidate("e", "E", 1480),
    candidate("f", "F", 1530),
  ];

  it("takes at most one ghost per team, within the Elo window, up to the limit", () => {
    for (let i = 0; i < 20; i++) {
      const picked = pickGhosts(createRng(`g${i}`), 1500, pool);
      expect(picked.length).toBe(4);
      expect(new Set(picked.map((g) => g.teamId)).size).toBe(picked.length);
      expect(picked.map((g) => g.id)).not.toContain("far");
    }
    expect(
      pickGhosts(createRng("x"), 1500, pool, { maxGhosts: 0, eloWindow: 300 }),
    ).toEqual([]);
    expect(pickGhosts(createRng("x"), 1500, [])).toEqual([]);
  });
});

describe("leagues with ghosts", () => {
  const ghosts = [
    candidate("g1", "T1", 1700, "Northside Lions"),
    candidate("g2", "ME", 1490, "My Club"),
  ];
  const league = newLeague(
    "ghost-league",
    { name: "My Club", elo: 1500, teamId: "ME" },
    ghosts,
  );

  it("puts ghosts in the AI places nearest their Elo, disguising the manager's own", () => {
    const ghostSlots = league.slots.filter((s) => s.kind === "ghost");
    expect(ghostSlots).toHaveLength(2);
    const lions = ghostSlots.find((s) => s.ghostId === "g1");
    expect(lions).toMatchObject({
      slot: 6,
      name: "Northside Lions",
      startRating: 1700,
    });
    const mine = ghostSlots.find((s) => s.ghostId === "g2");
    expect(mine?.slot).toBe(4);
    expect(mine?.name).not.toBe("My Club");
    expect(new Set(league.slots.map((s) => s.name.toLowerCase())).size).toBe(8);
    expect(league.slots.filter((s) => s.kind === "ai")).toHaveLength(5);
  });

  it("plays ghosts with their snapshot squads, or as AI if the snapshot is gone", () => {
    const state: SeasonState = {
      seed: "ghost-league",
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
    const me = roster("me");
    const manager = {
      team: squadToTeam(
        "me",
        me.squad,
        new Map(me.players.map((p) => [p.id, p])),
      ),
      names: new Map(me.players.map((p) => [p.id, p.displayName])),
    };
    const lionsSlot = league.slots.find((s) => s.ghostId === "g1")
      ?.slot as number;
    const lions = roster("lions", 1700);
    const withGhost = playWeek(
      state,
      {
        ...manager,
        ghosts: new Map([
          [
            lionsSlot,
            ghostTeam("g1", snapshotTeam(lions.players, lions.squad)),
          ],
        ]),
      },
      defaultSoccerConfig(),
    );
    const lionsNames = new Set(lions.players.map((p) => p.displayName));
    const lionsGame = state.fixtures.findIndex(
      (f) =>
        f.week === 1 && (f.homeSlot === lionsSlot || f.awaySlot === lionsSlot),
    );
    const played = withGhost.played.find((p) => p.id === `f${lionsGame}`);
    for (const e of played?.summary.events ?? []) {
      const lionsSide =
        state.fixtures[lionsGame]?.homeSlot === lionsSlot ? "home" : "away";
      if (e.side === lionsSide) expect(lionsNames.has(e.player)).toBe(true);
    }
    // Without the snapshot the slot still plays (as an AI club).
    expect(playWeek(state, manager, defaultSoccerConfig()).played).toHaveLength(
      4,
    );
  });
});

describe("seasonStats (D19)", () => {
  const slots = [0, 1, 2, 3].map((slot) => ({
    slot,
    name: `t${slot}`,
    kind: "ai" as const,
    startRating: 1500,
  }));
  const f = (
    id: string,
    stage: SeasonFixture["stage"],
    home: number,
    away: number,
    hs: number,
    as: number,
    winner: SeasonFixture["winner"] = null,
  ): SeasonFixture => ({
    id,
    week: 1,
    stage,
    homeSlot: home,
    awaySlot: away,
    homeScore: hs,
    awayScore: as,
    winner,
  });
  const fixtures = [
    f("1", "league", 0, 1, 2, 0),
    f("2", "league", 2, 3, 1, 1),
    f("3", "league", 1, 0, 1, 1),
    f("4", "semi", 0, 3, 1, 0, "home"),
    f("5", "semi", 1, 2, 0, 2, "away"),
    f("6", "final", 0, 2, 0, 1, "away"),
  ];

  it("records the league record and how far the team got", () => {
    expect(seasonStats(slots, fixtures, 0)).toEqual({
      position: 1,
      played: 2,
      won: 1,
      drawn: 1,
      lost: 0,
      scored: 3,
      conceded: 1,
      points: 4,
      playoffs: "final",
    });
    expect(seasonStats(slots, fixtures, 2).playoffs).toBe("champion");
    expect(seasonStats(slots, fixtures, 1).playoffs).toBe("semi");
    expect(seasonStats(slots, fixtures.slice(0, 3), 3).playoffs).toBe("none");
    expect(() => seasonStats(slots, fixtures, 9)).toThrow(/No team/);
  });
});
