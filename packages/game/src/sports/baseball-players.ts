/**
 * Baseball's players as the game layer stores and shows them (ADR 0009 §4).
 * A baseball player's extra traits (pitcher role, presets, how he bats and
 * throws) go in `players.traits`; what managers see never includes the
 * true potential (D48).
 */
import { playerWorth } from "@lfs/core";
import {
  type Bats,
  type BatterPosition,
  battingRating,
  fieldingRating,
  type GeneratedPlayer,
  type PitcherRole,
  type Position,
  type Throws,
} from "./baseball";

/** What `players.traits` holds for a baseball player. */
export interface BaseballTraits {
  role: PitcherRole | null;
  bats: Bats;
  throws: Throws;
  zone: string | null;
  spray: string | null;
  location: string | null;
}

export function traitsOf(p: GeneratedPlayer): BaseballTraits {
  return {
    role: p.pitcherRole,
    bats: p.bats,
    throws: p.throws,
    zone: p.zoneProfile,
    spray: p.sprayProfile,
    location: p.locationProfile,
  };
}

/** A baseball player as a manager scouts him: no true potential. */
export interface ScoutedBaseballPlayer {
  displayName: string;
  nationality: string;
  age: number;
  primaryPosition: Position;
  secondaryPosition: BatterPosition | null;
  pitcherRole: PitcherRole | null;
  bats: Bats;
  throws: Throws;
  overall: number;
  /** Bat and Field at his position (D212); null for a pitcher (and Field for the DH). */
  bat: number | null;
  field: number | null;
  potentialRange: [number, number];
  worth: number;
  chemistryColor: number;
}

export function scoutBaseballPlayer(p: GeneratedPlayer): ScoutedBaseballPlayer {
  const pitcher = p.primaryPosition === "P";
  return {
    displayName: p.displayName,
    nationality: p.nationality,
    age: p.age,
    primaryPosition: p.primaryPosition,
    secondaryPosition: p.secondaryPosition,
    pitcherRole: p.pitcherRole,
    bats: p.bats,
    throws: p.throws,
    overall: p.overall,
    bat: pitcher ? null : battingRating(p.attributes),
    // The DH fields nothing.
    field: pitcher
      ? null
      : fieldingRating(p.attributes, p.primaryPosition as BatterPosition),
    potentialRange: p.potentialRange,
    worth: playerWorth(p),
    chemistryColor: p.chemistryColor,
  };
}

/** The row saved for a kept baseball pack player (resolve_starter_packs and friends). */
export function baseballPlayerRow(p: GeneratedPlayer) {
  return {
    first_name: p.firstName,
    last_name: p.lastName,
    display_name: p.displayName,
    nationality: p.nationality,
    age: p.age,
    primary_position: p.primaryPosition,
    secondary_position: p.secondaryPosition,
    attributes: p.attributes,
    overall: p.overall,
    potential: p.potential,
    potential_low: p.potentialRange[0],
    potential_high: p.potentialRange[1],
    worth: playerWorth(p),
    chemistry_color: p.chemistryColor,
    template_variant: "default",
    secondary_template_variant: "default",
    traits: traitsOf(p),
  };
}
