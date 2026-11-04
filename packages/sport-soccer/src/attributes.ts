/** Soccer attributes (D78). Every value is a whole number from 1 to 99. */
export const OUTFIELD_ATTRIBUTES = [
  "pace",
  "passing",
  "shooting",
  "defending",
  "physical",
  "stamina",
] as const;

export const ATTRIBUTES = [...OUTFIELD_ATTRIBUTES, "goalkeeping"] as const;

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
