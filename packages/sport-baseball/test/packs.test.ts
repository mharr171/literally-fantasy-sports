import { createRng, starterSelectionError } from "@lfs/core";
import { describe, expect, it } from "vitest";
import {
  allowedColors,
  COLOR_COUNT,
  DEFAULT_ROSTER_LIMITS,
  DEFAULT_SEASON_END_SETTINGS,
  endOfSeason,
  excludedColorsError,
  generatePlayer,
  isPackFocus,
  overallAt,
  PACK_FOCUS_NAMES,
  PACK_FOCUSES,
  packContents,
  ratingSlot,
  shiftToOverall,
  starterMixError,
  starterPackPlan,
  youthIntake,
} from "../src/index";

const INFIELD = ["C", "1B", "2B", "3B", "SS"];
const OUTFIELD = ["LF", "CF", "RF", "DH"];

describe("baseball packs (ADR 0009 §6, D221)", () => {
  it("has five focuses, each named", () => {
    expect(PACK_FOCUSES).toEqual([
      "starters",
      "relievers",
      "infield",
      "outfield",
      "any",
    ]);
    expect(PACK_FOCUS_NAMES.starters).toBe("Starting pitchers");
    expect(isPackFocus("relievers")).toBe(true);
    expect(isPackFocus("attack")).toBe(false);
  });

  it("plans 16 starter packs: 3 starters, 3 relievers, 5 infield, 5 outfield", () => {
    const plan = starterPackPlan();
    expect(plan).toHaveLength(16);
    const count = (f: string) => plan.filter((p) => p.focus === f).length;
    expect([
      count("starters"),
      count("relievers"),
      count("infield"),
      count("outfield"),
    ]).toEqual([3, 3, 5, 5]);
    expect(plan.every((p) => p.tier === "starter")).toBe(true);
  });

  it("fills each pack with its focus, and replays from the seed", () => {
    for (let i = 0; i < 20; i++) {
      const sp = packContents(`s${i}`, "starters", "starter");
      expect(
        sp.every(
          (p) => p.primaryPosition === "P" && p.pitcherRole === "starter",
        ),
      ).toBe(true);
      const rp = packContents(`r${i}`, "relievers", "starter");
      expect(rp.every((p) => p.pitcherRole === "reliever")).toBe(true);
      const inf = packContents(`i${i}`, "infield", "basic");
      expect(inf.every((p) => INFIELD.includes(p.primaryPosition))).toBe(true);
      const out = packContents(`o${i}`, "outfield", "gold");
      expect(out.every((p) => OUTFIELD.includes(p.primaryPosition))).toBe(true);
      expect(out.every((p) => p.overall >= 58)).toBe(true);
    }
    expect(packContents("same", "any", "silver")).toEqual(
      packContents("same", "any", "silver"),
    );
    const any = Array.from({ length: 200 }, (_, i) =>
      packContents(`a${i}`, "any", "basic"),
    ).flat();
    const pitchers =
      any.filter((p) => p.primaryPosition === "P").length / any.length;
    expect(pitchers).toBeGreaterThan(0.38);
    expect(pitchers).toBeLessThan(0.52);
  });

  it("follows special packs' ages and potential, and left-out colors", () => {
    for (let i = 0; i < 20; i++) {
      for (const p of packContents(`p${i}`, "any", "prospect")) {
        expect(p.age).toBeGreaterThanOrEqual(17);
        expect(p.age).toBeLessThanOrEqual(20);
        expect(p.potential).toBeGreaterThanOrEqual(p.overall + 10);
        expect(p.potentialRange[0]).toBeGreaterThanOrEqual(p.overall + 10);
      }
      for (const p of packContents(`v${i}`, "any", "veteran")) {
        expect(p.age).toBeGreaterThanOrEqual(30);
        expect(p.potential).toBe(p.overall);
        expect(p.potentialRange[1]).toBe(p.overall);
      }
      const only = packContents(`c${i}`, "any", "basic", undefined, {
        excludedColors: [0, 1, 2],
      });
      expect(only.every((p) => p.chemistryColor === 3)).toBe(true);
    }
    expect(COLOR_COUNT).toBe(4);
    expect(excludedColorsError([0, 1, 2])).toBeNull();
    expect(excludedColorsError([4])).toMatch(/isn't a chemistry color/);
    expect(allowedColors()).toBeUndefined();
    expect(allowedColors([0])).toEqual([1, 2, 3]);
    // Higher Elo moves the odds up.
    const up = packContents("elo", "infield", "basic", undefined, {
      eloShift: 15,
    });
    expect(up.every((p) => p.overall >= 55)).toBe(true);
  });

  it("keeps 14 to 30 starters, with at least 9 pitchers and 9 batters", () => {
    const packs = starterPackPlan().map((_, i) => ({
      id: `p${i}`,
      opened: true,
      resolved: false,
    }));
    expect(
      starterSelectionError(
        packs,
        { p0: [0, 1, 2, 3, 4], p1: [0, 1, 2, 3, 4], p2: [0, 1, 2] },
        DEFAULT_ROSTER_LIMITS,
      ),
    ).toMatch(/at least 14/);
    const of = (pitchers: number, batters: number) => [
      ...Array.from({ length: pitchers }, () => ({
        primaryPosition: "P" as const,
      })),
      ...Array.from({ length: batters }, () => ({
        primaryPosition: "SS" as const,
      })),
    ];
    expect(starterMixError(of(9, 9))).toBeNull();
    expect(starterMixError(of(8, 12))).toMatch(/9 pitchers \(8 picked\)/);
    expect(starterMixError(of(12, 8))).toMatch(/9 batters \(8 picked\)/);
  });
});

describe("baseball season end (ADR 0009 §6)", () => {
  const make = (
    seed: string,
    position: "P" | "SS",
    age: number,
    role?: "starter" | "reliever",
  ) => {
    const g = generatePlayer(createRng(seed), {
      position,
      overall: 60,
      ...(role ? { role } : {}),
    });
    return { ...g, id: seed, age };
  };

  it("ages players, keeps pitchers rated in their role, and retires old ones", () => {
    const players = [
      make("young", "SS", 20),
      { ...make("rp", "P", 29, "reliever") },
      ...Array.from({ length: 40 }, (_, i) =>
        make(`old${i}`, "P", 38, "starter"),
      ),
    ];
    const { aged, retired } = endOfSeason("season", players);
    const young = aged.find((a) => a.id === "young");
    expect(young?.age).toBe(21);
    expect(young?.overall).toBeGreaterThanOrEqual(60);
    const rp = aged.find((a) => a.id === "rp");
    expect(rp?.overall).toBe(overallAt(rp?.attributes as never, "RP"));
    expect(Math.abs((rp?.overall ?? 0) - 60)).toBeLessThanOrEqual(1);
    expect(retired.length).toBeGreaterThan(25);
    expect(endOfSeason("season", players)).toEqual({ aged, retired });
  });

  it("shifts only the attributes a slot counts", () => {
    const p = make("shift", "P", 30, "starter");
    const slot = ratingSlot("P", "starter");
    const up = shiftToOverall(p.attributes, slot, 70);
    expect(overallAt(up, slot)).toBe(70);
    expect(up.contact).toBe(p.attributes.contact);
    const pinned = shiftToOverall(p.attributes, slot, 150);
    expect(overallAt(pinned, slot)).toBe(99);
  });

  it("offers 18 youth prospects aged 17–19, a starter and a reliever first", () => {
    const intake = youthIntake("youth");
    expect(intake).toHaveLength(DEFAULT_SEASON_END_SETTINGS.intakeSize);
    expect(intake).toHaveLength(18);
    expect(intake[0]?.pitcherRole).toBe("starter");
    expect(intake[1]?.pitcherRole).toBe("reliever");
    expect(intake.every((p) => p.age >= 17 && p.age <= 19)).toBe(true);
    expect(intake.every((p) => p.overall >= 35 && p.overall <= 58)).toBe(true);
    expect(intake.some((p) => p.primaryPosition !== "P")).toBe(true);
    expect(youthIntake("youth")).toEqual(intake);
  });
});
