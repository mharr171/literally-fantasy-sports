import { describe, expect, it } from "vitest";
import {
  DEFAULT_EFFECTIVE_SKILL_CONFIG,
  effectiveSkill,
  positionFit,
} from "../src/effective-skill";
import { overallAt } from "../src/overall";
import { attrs, player } from "./fixtures";

describe("positionFit", () => {
  it("knows primary, secondary and other positions", () => {
    const p = player({ primaryPosition: "CM", secondaryPosition: "DM" });
    expect(positionFit(p, "CM")).toBe("primary");
    expect(positionFit(p, "DM")).toBe("secondary");
    expect(positionFit(p, "ST")).toBe("other");
    expect(positionFit(player({ secondaryPosition: null }), "DM")).toBe(
      "other",
    );
  });
});

describe("effectiveSkill", () => {
  const cm = player({
    attributes: attrs(),
    primaryPosition: "CM",
    secondaryPosition: "DM",
  });

  it("adds +25% at the primary position and +10% at the secondary", () => {
    expect(
      effectiveSkill({ player: cm, slot: "CM", chemistryBoost: 0 }),
    ).toBeCloseTo(62.5);
    expect(
      effectiveSkill({ player: cm, slot: "DM", chemistryBoost: 0 }),
    ).toBeCloseTo(55);
    expect(
      effectiveSkill({ player: cm, slot: "ST", chemistryBoost: 0 }),
    ).toBeCloseTo(50);
  });

  it("adds chemistry on top: 70 at primary with +15% chemistry → 98", () => {
    const p = player({
      attributes: attrs({
        passing: 70,
        stamina: 70,
        defending: 70,
        shooting: 70,
        physical: 70,
        pace: 70,
      }),
    });
    expect(
      effectiveSkill({ player: p, slot: "CM", chemistryBoost: 0.15 }),
    ).toBeCloseTo(98);
  });

  it("rates the player at the slot's position, not their own", () => {
    const striker = player({
      attributes: attrs({ shooting: 90, pace: 85, defending: 25 }),
      primaryPosition: "ST",
      secondaryPosition: null,
    });
    expect(
      effectiveSkill({ player: striker, slot: "CB", chemistryBoost: 0 }),
    ).toBe(overallAt(striker.attributes, "CB"));
  });

  it("applies extra modifiers and never goes below zero", () => {
    expect(
      effectiveSkill({
        player: cm,
        slot: "ST",
        chemistryBoost: 0,
        extraModifiers: [0.1, -0.2],
      }),
    ).toBeCloseTo(45);
    expect(
      effectiveSkill({
        player: cm,
        slot: "ST",
        chemistryBoost: 0,
        extraModifiers: [-2],
      }),
    ).toBe(0);
  });

  it("uses the configured position bonuses", () => {
    const config = {
      ...DEFAULT_EFFECTIVE_SKILL_CONFIG,
      positionFit: { primary: 0.5, secondary: 0.2 },
    };
    expect(
      effectiveSkill({ player: cm, slot: "CM", chemistryBoost: 0 }, config),
    ).toBeCloseTo(75);
    expect(
      effectiveSkill({ player: cm, slot: "DM", chemistryBoost: 0 }, config),
    ).toBeCloseTo(60);
  });
});
