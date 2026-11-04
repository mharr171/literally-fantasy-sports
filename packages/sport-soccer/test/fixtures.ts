import type { Attributes } from "../src/attributes";
import type { SoccerPlayer } from "../src/player";

export function attrs(overrides: Partial<Attributes> = {}): Attributes {
  return {
    pace: 50,
    passing: 50,
    shooting: 50,
    defending: 50,
    physical: 50,
    stamina: 50,
    goalkeeping: 10,
    ...overrides,
  };
}

export function player(overrides: Partial<SoccerPlayer> = {}): SoccerPlayer {
  return {
    id: "p1",
    attributes: attrs(),
    primaryPosition: "CM",
    secondaryPosition: "DM",
    chemistryColor: 0,
    ...overrides,
  };
}
