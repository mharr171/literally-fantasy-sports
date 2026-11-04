import type { Rng } from "../rng";
import { NAME_POOLS, NATIONALITY_CODES, type NationalityCode } from "./pools";

export interface GeneratedName {
  firstName: string;
  lastName: string;
  /** How the name is shown: "Kenji Watanabe", or "Watanabe Kenji" where family name comes first. */
  displayName: string;
}

/** Relative chance of each nationality; missing entries count as 0. */
export type NationalityWeights = Partial<Record<NationalityCode, number>>;

/** Every nationality equally likely (D38: as diverse as possible). */
export const EQUAL_NATIONALITY_WEIGHTS: NationalityWeights = Object.fromEntries(
  NATIONALITY_CODES.map((code) => [code, 1]),
);

export function pickNationality(
  rng: Rng,
  weights: NationalityWeights = EQUAL_NATIONALITY_WEIGHTS,
): NationalityCode {
  const values = NATIONALITY_CODES.map((code) => weights[code] ?? 0);
  return NATIONALITY_CODES[rng.weightedIndex(values)] as NationalityCode;
}

/** A random name styled by nationality (D10). */
export function generateName(
  rng: Rng,
  nationality: NationalityCode,
): GeneratedName {
  const pool = NAME_POOLS[nationality];
  const firstName = rng.pick(pool.firstNames);
  const lastName = rng.pick(pool.lastNames);
  const familyFirst = "familyNameFirst" in pool && pool.familyNameFirst;
  return {
    firstName,
    lastName,
    displayName: familyFirst
      ? `${lastName} ${firstName}`
      : `${firstName} ${lastName}`,
  };
}
