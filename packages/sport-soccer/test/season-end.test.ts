import { createRng } from "@lfs/core";
import { describe, expect, it } from "vitest";
import { generatePlayer } from "../src/generation";
import { overallAt } from "../src/overall";
import {
  type AgingPlayer,
  DEFAULT_SEASON_END_SETTINGS,
  endOfSeason,
  playingTimeFactor,
  retirementChance,
  shiftToOverall,
  yearlyChange,
  youthIntake,
} from "../src/season-end";

function player(
  id: string,
  age: number,
  overall: number,
  potential: number,
): AgingPlayer {
  const p = generatePlayer(createRng(id), { position: "CM", overall });
  return {
    id,
    age,
    attributes: p.attributes,
    primaryPosition: "CM",
    overall: p.overall,
    potential: Math.max(potential, p.overall),
  };
}

describe("shiftToOverall", () => {
  it("moves the overall to the target and leaves other attributes alone", () => {
    const p = generatePlayer(createRng("shift"), {
      position: "ST",
      overall: 60,
    });
    const up = shiftToOverall(p.attributes, "ST", 67);
    expect(overallAt(up, "ST")).toBe(67);
    expect(up.goalkeeping).toBe(p.attributes.goalkeeping);
    expect(overallAt(shiftToOverall(p.attributes, "ST", 52), "ST")).toBe(52);
  });

  it("stops at the 1–99 limits", () => {
    const p = generatePlayer(createRng("top"), { position: "CB", overall: 97 });
    const top = shiftToOverall(p.attributes, "CB", 150);
    expect(overallAt(top, "CB")).toBe(99);
    const bottom = shiftToOverall(p.attributes, "CB", -10);
    expect(overallAt(bottom, "CB")).toBe(1);
  });
});

describe("yearlyChange (D35)", () => {
  const rng = () => createRng("change");
  it("grows young players toward potential, never past it", () => {
    for (let i = 0; i < 50; i++) {
      const c = yearlyChange(createRng(`y${i}`), {
        age: 19,
        overall: 55,
        potential: 75,
      });
      expect(c).toBeGreaterThanOrEqual(5);
      expect(c).toBeLessThanOrEqual(12);
    }
    expect(yearlyChange(rng(), { age: 20, overall: 70, potential: 71 })).toBe(
      1,
    );
    expect(yearlyChange(rng(), { age: 20, overall: 70, potential: 70 })).toBe(
      0,
    );
  });

  it("keeps prime-age players steady and declines older ones", () => {
    for (let i = 0; i < 50; i++) {
      const r = (age: number) =>
        yearlyChange(createRng(`o${i}-${age}`), {
          age,
          overall: 70,
          potential: 70,
        });
      expect(Math.abs(r(28))).toBeLessThanOrEqual(1);
      expect(r(30)).toBeGreaterThanOrEqual(-3);
      expect(r(30)).toBeLessThanOrEqual(-1);
      expect(r(33)).toBeLessThanOrEqual(-2);
      expect(r(36)).toBeLessThanOrEqual(-3);
      expect(r(36)).toBeGreaterThanOrEqual(-6);
    }
  });
});

describe("retirement", () => {
  it("only happens from 33, more likely with age", () => {
    expect(retirementChance(32)).toBe(0);
    expect(retirementChance(33)).toBe(0.1);
    expect(retirementChance(35)).toBe(0.4);
    expect(retirementChance(40)).toBe(0.85);
  });
});

describe("endOfSeason", () => {
  const squad = [
    player("kid", 18, 50, 78),
    player("prime", 27, 70, 72),
    player("vet", 33, 72, 72),
    ...Array.from({ length: 20 }, (_, i) => player(`old${i}`, 36, 60, 60)),
  ];
  const result = endOfSeason("end", squad);

  it("ages everyone who stays a year and keeps overall in step with attributes", () => {
    expect(result.aged.length + result.retired.length).toBe(squad.length);
    for (const a of result.aged) {
      const before = squad.find((p) => p.id === a.id) as AgingPlayer;
      expect(a.age).toBe(before.age + 1);
      expect(a.overall).toBe(overallAt(a.attributes, "CM"));
    }
    const kid = result.aged.find((a) => a.id === "kid");
    expect(kid?.overall).toBeGreaterThan(squad[0]?.overall as number);
    expect(kid?.overall).toBeLessThanOrEqual(78);
  });

  it("retires most players in their late 30s but nobody young", () => {
    expect(result.retired).not.toContain("kid");
    expect(result.retired).not.toContain("prime");
    const old = result.retired.filter((id) => id.startsWith("old")).length;
    expect(old).toBeGreaterThan(10);
  });

  it("is the same for the same seed", () => {
    expect(endOfSeason("end", squad)).toEqual(result);
  });
});

describe("youthIntake (D53)", () => {
  const intake = youthIntake("intake");
  it("offers 22 teenagers around overall 45, two of them keepers", () => {
    expect(intake).toHaveLength(DEFAULT_SEASON_END_SETTINGS.intakeSize);
    expect(intake).toHaveLength(22);
    expect(
      intake.filter((p) => p.primaryPosition === "GK").length,
    ).toBeGreaterThanOrEqual(2);
    for (const p of intake) {
      expect(p.age).toBeGreaterThanOrEqual(16);
      expect(p.age).toBeLessThanOrEqual(18);
      expect(p.overall).toBeGreaterThanOrEqual(34);
      expect(p.overall).toBeLessThanOrEqual(59);
      expect(p.potential).toBeGreaterThanOrEqual(p.overall);
    }
    const mean = intake.reduce((a, p) => a + p.overall, 0) / intake.length;
    expect(mean).toBeGreaterThan(41);
    expect(mean).toBeLessThan(49);
    expect(youthIntake("intake")).toEqual(intake);
  });
});

describe("growth from playing time (D154)", () => {
  const club = { clubMinutes: 26 * 90 };

  it("leaves growth as it was when switched off", () => {
    const kids = Array.from({ length: 20 }, (_, i) => ({
      ...player(`k${i}`, 18, 50, 80),
      seasonMinutes: i * 100,
    }));
    const before = endOfSeason("pt", kids);
    const off = endOfSeason("pt", kids, undefined, undefined, {
      ...club,
      weight: 0,
    });
    expect(off).toEqual(before);
  });

  it("gives regulars full growth and benchwarmers less", () => {
    expect(playingTimeFactor(26 * 90, { ...club, weight: 0.5 })).toBe(1);
    // 70% of the club's minutes is enough to count as a regular.
    expect(playingTimeFactor(0.7 * 26 * 90, { ...club, weight: 0.5 })).toBe(1);
    expect(playingTimeFactor(0, { ...club, weight: 0.5 })).toBe(0.5);
    expect(playingTimeFactor(0, { ...club, weight: 1 })).toBe(0);
    expect(playingTimeFactor(500, undefined)).toBe(1);
  });

  it("makes regulars grow more than benchwarmers over a season", () => {
    let regular = 0;
    let bench = 0;
    for (let i = 0; i < 200; i++) {
      const kid = player(`g${i}`, 18, 50, 80);
      const grown = (minutes: number) =>
        yearlyChange(
          createRng(`grow-${i}`),
          { ...kid, seasonMinutes: minutes },
          DEFAULT_SEASON_END_SETTINGS,
          { ...club, weight: 0.5 },
        );
      regular += grown(26 * 90);
      bench += grown(100);
    }
    expect(regular).toBeGreaterThan(bench * 1.6);
  });

  it("doesn't change older players' decline", () => {
    const vet = { ...player("vet", 33, 72, 72), seasonMinutes: 0 };
    const off = yearlyChange(createRng("v"), vet);
    const on = yearlyChange(createRng("v"), vet, DEFAULT_SEASON_END_SETTINGS, {
      ...club,
      weight: 1,
    });
    expect(on).toBe(off);
  });
});
