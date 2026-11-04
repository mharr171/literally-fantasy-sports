/** Soccer positions (D77): 12 positions, with both wide midfielders and wingers. */
export const POSITIONS = [
  "GK",
  "CB",
  "LB",
  "RB",
  "DM",
  "CM",
  "AM",
  "LM",
  "RM",
  "LW",
  "RW",
  "ST",
] as const;

export type Position = (typeof POSITIONS)[number];

export type Line = "goal" | "defence" | "midfield" | "attack";

export const POSITION_LINE: Record<Position, Line> = {
  GK: "goal",
  CB: "defence",
  LB: "defence",
  RB: "defence",
  DM: "midfield",
  CM: "midfield",
  AM: "midfield",
  LM: "midfield",
  RM: "midfield",
  LW: "attack",
  RW: "attack",
  ST: "attack",
};

export const POSITION_NAMES: Record<Position, string> = {
  GK: "Goalkeeper",
  CB: "Centre-back",
  LB: "Left-back",
  RB: "Right-back",
  DM: "Defensive midfielder",
  CM: "Central midfielder",
  AM: "Attacking midfielder",
  LM: "Left midfielder",
  RM: "Right midfielder",
  LW: "Left winger",
  RW: "Right winger",
  ST: "Striker",
};

export function isPosition(value: string): value is Position {
  return (POSITIONS as readonly string[]).includes(value);
}
