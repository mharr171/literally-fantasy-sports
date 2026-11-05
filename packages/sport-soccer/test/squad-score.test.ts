import { describe, expect, it } from "vitest";
import { STARTER_PACKS } from "../src/generation";
import { autoPickSquad, formation, type PickablePlayer } from "../src/matchday";
import { packContents } from "../src/roster";
import {
  chemistryShares,
  pickWeight,
  ROTATION_FITNESS_EMPHASIS,
  squadScore,
} from "../src/squad-score";
import { player } from "./fixtures";

function roster(seed: string): PickablePlayer[] {
  const players = STARTER_PACKS.flatMap(({ focus, count }) =>
    Array.from({ length: count }, (_, i) =>
      packContents(`${seed}-${focus}-${i}`, focus, "starter"),
    ).flat(),
  );
  const keepers = players.filter((p) => p.primaryPosition === "GK");
  const outfield = players.filter((p) => p.primaryPosition !== "GK");
  return [...keepers.slice(0, 3), ...outfield.filter((_, i) => i % 3 === 0)]
    .slice(0, 30)
    .map((p, i) => ({ ...p, id: `${seed}-${i}` }));
}

describe("pickWeight (D97, D110)", () => {
  it("is 1 for a fresh player in steady form", () => {
    expect(pickWeight(100, 0)).toBe(1);
  });

  it("weighs tiredness three times as much when rotating", () => {
    expect(pickWeight(70, 0)).toBeCloseTo(0.91);
    expect(pickWeight(70, 0, ROTATION_FITNESS_EMPHASIS)).toBeCloseTo(0.73);
    // Never drops to nothing, however tired.
    expect(pickWeight(0, -1, 10)).toBeGreaterThan(0);
  });

  it("nudges by form", () => {
    expect(pickWeight(100, 1)).toBeGreaterThan(1);
    expect(pickWeight(100, -1)).toBeLessThan(1);
  });
});

describe("rotated squad (D110)", () => {
  it("rests tired starters that a normal pick keeps", () => {
    const players = roster("rotate");
    const normal = autoPickSquad(players, "4-4-2");
    // The normal 11 played last week and are at 70; everyone else is fresh.
    const fitness = new Map(players.map((p) => [p.id, 100]));
    for (const id of normal.lineup) fitness.set(id, 70);
    const weigh = (emphasis: number) => ({
      weight: (id: string) => pickWeight(fitness.get(id) ?? 100, 0, emphasis),
    });
    const kept = autoPickSquad(players, "4-4-2", weigh(1));
    const rotated = autoPickSquad(
      players,
      "4-4-2",
      weigh(ROTATION_FITNESS_EMPHASIS),
    );
    const changed = (s: typeof normal) =>
      s.lineup.filter((id) => !normal.lineup.includes(id)).length;
    expect(changed(rotated)).toBeGreaterThan(changed(kept));
    const avgFitness = (s: typeof normal) =>
      s.lineup.reduce((a, id) => a + (fitness.get(id) ?? 100), 0) / 11;
    expect(avgFitness(rotated)).toBeGreaterThan(avgFitness(kept));
  });
});

describe("squadScore (D110)", () => {
  it("averages starters' slot ratings, with chemistry", () => {
    const slots = formation("4-4-2")?.slots ?? [];
    const players = roster("score");
    const squad = autoPickSquad(players, "4-4-2");
    const byId = new Map(players.map((p) => [p.id, p]));
    const starters = squad.lineup.map((id, i) => ({
      player: byId.get(id) as PickablePlayer,
      slot: slots[i]?.position ?? "CM",
    }));
    const score = squadScore(starters);
    expect(score.base).toBeGreaterThan(40);
    expect(score.today).toBeCloseTo(score.base);
    // Tired starters lower today's score, not the base.
    const tired = squadScore(starters.map((s) => ({ ...s, weight: 0.8 })));
    expect(tired.base).toBeCloseTo(score.base);
    expect(tired.today).toBeCloseTo(score.base * 0.8);
  });

  it("counts team morale in today's score, not the base (D162)", () => {
    const starter = [{ player: player(), slot: "CM" as const }];
    const calm = squadScore(starter, 1);
    const happy = squadScore(starter, 1, undefined, { morale: 1 });
    const glum = squadScore(starter, 1, undefined, { morale: -1 });
    expect(happy.base).toBeCloseTo(calm.base);
    expect(happy.today).toBeGreaterThan(calm.today);
    expect(glum.today).toBeLessThan(calm.today);
  });

  it("uses the season's out-of-position penalty (D135)", () => {
    // A centre midfielder put in goal.
    const starter = [{ player: player(), slot: "GK" as const }];
    const off = squadScore(starter, 1);
    const on = squadScore(starter, 1, undefined, { outOfPosition: -0.5 });
    expect(on.base).toBeCloseTo(off.base * 0.5, 0);
  });

  it("counts empty slots as nothing", () => {
    const one = squadScore([{ player: player(), slot: "CM" }]);
    const full = squadScore([{ player: player(), slot: "CM" }], 1);
    expect(one.base).toBeCloseTo(full.base / 11);
  });
});

describe("chemistryShares (D111)", () => {
  it("splits players by color, biggest first", () => {
    const shares = chemistryShares(
      [0, 2, 2, 1, 2, 0].map((chemistryColor) => ({ chemistryColor })),
    );
    expect(shares).toEqual([
      { color: 2, count: 3, share: 0.5 },
      { color: 0, count: 2, share: 2 / 6 },
      { color: 1, count: 1, share: 1 / 6 },
    ]);
    expect(chemistryShares([])).toEqual([]);
  });
});
