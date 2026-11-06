/**
 * Baseball positions (D195): the pitcher, the eight fielders and the
 * designated hitter. Pitchers only pitch and fielders never pitch (no
 * two-way players); secondary positions are for fielders and the DH.
 */
export const POSITIONS = [
  "P",
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "LF",
  "CF",
  "RF",
  "DH",
] as const;

export type Position = (typeof POSITIONS)[number];

/** Positions in the field besides the pitcher. */
export const FIELD_POSITIONS = [
  "C",
  "1B",
  "2B",
  "3B",
  "SS",
  "LF",
  "CF",
  "RF",
] as const satisfies readonly Position[];

export type FieldPosition = (typeof FIELD_POSITIONS)[number];

/** Positions a batter can hold: the fielders and the DH. */
export type BatterPosition = Exclude<Position, "P">;

/** What a pitcher prefers to do (ADR 0008 §2). */
export type PitcherRole = "starter" | "reliever";

/**
 * What a rating is worked out for: a batter's position, or a pitcher in
 * one of the two roles (SP starter, RP reliever).
 */
export type RatingSlot = BatterPosition | "SP" | "RP";

export const POSITION_NAMES: Record<Position, string> = {
  P: "Pitcher",
  C: "Catcher",
  "1B": "First baseman",
  "2B": "Second baseman",
  "3B": "Third baseman",
  SS: "Shortstop",
  LF: "Left fielder",
  CF: "Center fielder",
  RF: "Right fielder",
  DH: "Designated hitter",
};

export function isPosition(value: string): value is Position {
  return (POSITIONS as readonly string[]).includes(value);
}

/** The rating slot for a position, with a pitcher's role. */
export function ratingSlot(
  position: Position,
  role: PitcherRole = "starter",
): RatingSlot {
  if (position !== "P") return position;
  return role === "starter" ? "SP" : "RP";
}
