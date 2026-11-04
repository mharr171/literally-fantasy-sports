import { createRng } from "@lfs/core";
import { describe, expect, it } from "vitest";
import { generateAiTeam } from "../src/ai-team";
import {
  defaultSoccerConfig,
  type SoccerEvent,
  simulateMatch,
} from "../src/match";
import { squadToTeam } from "../src/matchday";
import { playByPlay } from "../src/play-by-play";

const teams = { home: "Reds", away: "Blues" };
const names = new Map([
  ["a", "Ann"],
  ["b", "Bo"],
]);

describe("playByPlay (M5)", () => {
  it("writes a line per moment with the running score", () => {
    const events: SoccerEvent[] = [
      { minute: 5, type: "chance", side: "home" },
      { minute: 5, type: "goal", side: "home", playerId: "a" },
      { minute: 20, type: "saved", side: "away", playerId: "b" },
      { minute: 30, type: "missed", side: "home", playerId: "a" },
      { minute: 40, type: "yellow", side: "away", playerId: "b" },
      {
        minute: 50,
        type: "red",
        side: "away",
        playerId: "b",
        secondYellow: true,
      },
      { minute: 55, type: "injury", side: "home", playerId: "a", weeks: 1 },
      {
        minute: 55,
        type: "sub",
        side: "home",
        outId: "a",
        inId: "b",
        reason: "injury",
      },
      {
        minute: 60,
        type: "sub",
        side: "home",
        outId: "b",
        inId: "a",
        reason: "plan",
      },
      {
        minute: 61,
        type: "position_change",
        side: "home",
        playerId: "a",
        slot: "ST",
      },
      { minute: 80, type: "goal", side: "away", playerId: "x" },
      { minute: 90, type: "extra_time" },
      {
        minute: 120,
        type: "penalty",
        side: "home",
        playerId: "a",
        scored: true,
      },
      {
        minute: 120,
        type: "penalty",
        side: "away",
        playerId: "b",
        scored: false,
      },
      { minute: 120, type: "full_time" },
    ];
    const lines = playByPlay(events, names, teams);
    expect(lines.map((l) => l.text)).toEqual([
      "Kick-off.",
      "Goal! Ann scores for Reds.",
      "Bo shoots: saved.",
      "Ann shoots: off target.",
      "Bo is booked.",
      "Bo is sent off (second yellow).",
      "Ann is injured: out 1 week.",
      "Bo comes on for Ann (injury).",
      "Ann comes on for Bo.",
      "Ann moves to ST.",
      "Goal! Unknown scores for Blues.",
      "Level after 90 minutes: extra time.",
      "Still level: penalties.",
      "Ann scores in the shoot-out.",
      "Bo misses in the shoot-out.",
      "Full time.",
    ]);
    expect(lines[1]?.score).toEqual({ home: 1, away: 0 });
    expect(lines[10]?.score).toEqual({ home: 1, away: 1 });
    expect(lines[12]?.penalties).toEqual({ home: 0, away: 0 });
    expect(lines.at(-1)?.penalties).toEqual({ home: 1, away: 0 });
    expect(lines.at(-1)?.side).toBeNull();
  });

  it("ends on the real score of a simulated match", () => {
    const all = new Map<string, string>();
    const team = (s: string) => {
      const t = generateAiTeam(createRng(s), 1500, s);
      for (const p of t.players) all.set(p.id, p.displayName);
      return squadToTeam(s, t.squad, new Map(t.players.map((p) => [p.id, p])));
    };
    const home = team("h");
    const away = team("a");
    const { result, events } = simulateMatch(
      { home, away, mode: "league", config: defaultSoccerConfig() },
      "pbp",
    );
    const lines = playByPlay(events, all, teams);
    expect(lines.at(-1)?.score).toEqual(result.score);
    expect(lines.filter((l) => l.kind === "goal")).toHaveLength(
      result.score.home + result.score.away,
    );
    expect(lines.some((l) => l.text.includes("Unknown"))).toBe(false);
  });
});
