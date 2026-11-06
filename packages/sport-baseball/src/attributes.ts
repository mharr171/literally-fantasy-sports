/**
 * Baseball attributes (D198), each a whole number from 1 to 99. Batters
 * have contact, power, eye and speed; fielders fielding and arm; pitchers
 * velocity, control, movement and stamina. Every player has all ten, but a
 * pitcher's batting and a fielder's pitching sit low and don't count.
 */
export const BATTING_ATTRIBUTES = ["contact", "power", "eye", "speed"] as const;

export const FIELDING_ATTRIBUTES = ["fielding", "arm"] as const;

export const PITCHING_ATTRIBUTES = [
  "velocity",
  "control",
  "movement",
  "stamina",
] as const;

export const ATTRIBUTES = [
  ...BATTING_ATTRIBUTES,
  ...FIELDING_ATTRIBUTES,
  ...PITCHING_ATTRIBUTES,
] as const;

export type Attribute = (typeof ATTRIBUTES)[number];

export type Attributes = Record<Attribute, number>;

export const ATTRIBUTE_MIN = 1;
export const ATTRIBUTE_MAX = 99;

/** Throws if any attribute is missing, not a whole number, or outside 1–99. */
export function assertValidAttributes(attributes: Attributes): void {
  for (const key of ATTRIBUTES) {
    const value = attributes[key];
    if (
      !Number.isInteger(value) ||
      value < ATTRIBUTE_MIN ||
      value > ATTRIBUTE_MAX
    ) {
      throw new RangeError(
        `Invalid ${key}: ${value} (expected ${ATTRIBUTE_MIN}–${ATTRIBUTE_MAX})`,
      );
    }
  }
}
