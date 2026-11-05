import { createRng } from "@lfs/core";
import { describe, expect, it } from "vitest";
import { balanceFromValues } from "../src/balance";
import { availableSquad } from "../src/condition";
import { generateTeam } from "../src/harness";
import {
  defaultSoccerConfig,
  PROPOSED_OUT_OF_POSITION,
  type SoccerTeam,
  simulateMatch,
} from "../src/match";
import {
  autoPickSquad,
  formation,
  type PickablePlayer,
  playsPosition,
  slotRating,
} from "../src/matchday";
import type { Position } from "../src/positions";

const base = defaultSoccerConfig();
const on = {
  ...base,
  tuning: { ...base.tuning, outOfPosition: PROPOSED_OUT_OF_POSITION },
};

const player = (
  id: string,
  primaryPosition: Position,
  level: number,
  secondaryPosition: Position | null = null,
): PickablePlayer => ({
  id,
  primaryPosition,
  secondaryPosition,
  chemistryColor: 0,
  overall: level,
  attributes: {
    pace: level,
    shooting: level,
    passing: level,
    defending: level,
    physical: level,
    stamina: level,
    goalkeeping: primaryPosition === "GK" ? level : 15,
  },
});

/** A full 4-4-2 roster of 22 at one level, plus extras. */
const squadOf = (level: number, extra: PickablePlayer[] = []) => {
  const slots = formation("4-4-2")?.slots.map((s) => s.position) ?? [];
  return [
    ...slots.map((p, i) => player(`s${i}`, p, level)),
    ...slots.map((p, i) => player(`b${i}`, p, level - 5)),
    ...extra,
  ];
};

describe("out of position (D135)", () => {
  it("is off by default and in settings saved before it", () => {
    expect(base.tuning.outOfPosition).toBe(0);
    expect(
      balanceFromValues({ tuning: { phases: 30 } }).tuning.outOfPosition,
    ).toBe(0);
  });

  it("halves a player's rating outside their two positions", () => {
    const winger = player("w", "LW", 70, "ST");
    expect(slotRating(winger, "CB")).toBe(slotRating(winger, "CB", 0));
    expect(slotRating(winger, "CB", -0.5)).toBe(
      Math.round(slotRating(winger, "CB") * 0.5),
    );
    // Primary and secondary positions keep their bonuses.
    expect(slotRating(winger, "LW", -0.5)).toBe(slotRating(winger, "LW"));
    expect(slotRating(winger, "ST", -0.5)).toBe(slotRating(winger, "ST"));
    expect(playsPosition(winger, "ST")).toBe(true);
    expect(playsPosition(winger, "CB")).toBe(false);
  });

  it("weakens a team that plays people out of position, only when on", () => {
    const home = generateTeam(createRng("oop-h"), "h", 60);
    const away = generateTeam(createRng("oop-a"), "a", 60);
    // Everyone swaps to a slot they don't play: defenders up front and so on.
    const shuffled: SoccerTeam = {
      ...home,
      lineup: home.lineup.map((s, i) => ({
        ...s,
        player: {
          ...s.player,
          primaryPosition: s.slot === "GK" ? "GK" : i % 2 ? "CB" : "ST",
          secondaryPosition: null,
        },
        slot: s.slot,
      })),
    };
    const influence = (config: typeof base) =>
      [
        ...simulateMatch(
          { home: shuffled, away, mode: "league", config },
          "oop",
        ).influence.home.values,
      ].reduce((a, b) => a + b, 0);
    expect(influence(on)).toBeLessThan(influence(base));
  });

  it("makes auto-pick choose a weaker player in position over a stronger one out of it", () => {
    // A star centre-forward and only a weak right back for the RB slot.
    const roster = squadOf(60).map((p) =>
      p.primaryPosition === "RB" ? player(p.id, "RB", 40) : p,
    );
    roster.push(player("star", "ST", 90));
    const squad = autoPickSquad(roster);
    const slots = formation("4-4-2")?.slots ?? [];
    slots.forEach((s, i) => {
      const id = squad.lineup[i] as string;
      const p = roster.find((x) => x.id === id) as PickablePlayer;
      expect(playsPosition(p, s.position)).toBe(true);
    });
  });

  it("still fills a slot out of position when nobody else can", () => {
    // No keeper on the roster at all.
    const roster = squadOf(60).filter((p) => p.primaryPosition !== "GK");
    const squad = autoPickSquad(roster);
    expect(squad.lineup.filter(Boolean)).toHaveLength(11);
  });

  it("covers an injured starter with someone who plays the position first", () => {
    const roster = squadOf(60, [player("star", "ST", 95)]);
    const squad = autoPickSquad(roster.filter((p) => p.id !== "star"));
    const injured = squad.lineup[1] as string; // a defender
    const { replaced } = availableSquad(
      { ...squad, bench: [...squad.bench.slice(0, 10), "star"] },
      roster,
      (id) => id !== injured,
    );
    const stand = roster.find(
      (p) => p.id === replaced[0]?.in,
    ) as PickablePlayer;
    const slot = formation("4-4-2")?.slots[1]?.position as Position;
    expect(playsPosition(stand, slot)).toBe(true);
  });
});
