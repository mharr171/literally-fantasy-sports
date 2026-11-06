import { describe, expect, it } from "vitest";
import { packContents, starterPackPlan } from "../src/sports/baseball";
import {
  baseballPlayerRow,
  scoutBaseballPlayer,
  traitsOf,
} from "../src/sports/baseball-players";

describe("baseball players in the game layer (ADR 0009 §4)", () => {
  const players = starterPackPlan().flatMap((p, i) =>
    packContents(`seed-${i}`, p.focus, p.tier),
  );
  const pitcher = players.find((p) => p.primaryPosition === "P");
  const dh = packContents("dh", "outfield", "starter")
    .concat(
      ...Array.from({ length: 30 }, (_, i) =>
        packContents(`dh${i}`, "outfield", "starter"),
      ),
    )
    .find((p) => p.primaryPosition === "DH");
  const fielder = players.find((p) => p.primaryPosition === "SS");

  it("never shows a manager the true potential", () => {
    for (const p of players) {
      const seen = scoutBaseballPlayer(p);
      expect(seen).not.toHaveProperty("potential");
      expect(JSON.stringify(seen)).not.toMatch(/"potential":/);
      expect(seen.potentialRange[0]).toBeLessThanOrEqual(p.potential);
      expect(seen.potentialRange[1]).toBeGreaterThanOrEqual(p.potential);
    }
  });

  it("shows Bat and Field for batters, neither for pitchers, no Field for the DH", () => {
    const sp = scoutBaseballPlayer(pitcher as never);
    expect([sp.bat, sp.field]).toEqual([null, null]);
    expect(sp.pitcherRole).not.toBeNull();
    const ss = scoutBaseballPlayer(fielder as never);
    expect(ss.bat).toBeGreaterThan(0);
    expect(ss.field).toBeGreaterThan(0);
    const d = scoutBaseballPlayer(dh as never);
    expect(d.bat).toBeGreaterThan(0);
    expect(d.field).toBeNull();
  });

  it("saves the traits with every kept player", () => {
    const p = pitcher as NonNullable<typeof pitcher>;
    const row = baseballPlayerRow(p);
    expect(row.traits).toEqual(traitsOf(p));
    expect(row.traits).toMatchObject({
      role: p.pitcherRole,
      bats: p.bats,
      throws: p.throws,
      location: p.locationProfile,
    });
    expect(row.potential).toBe(p.potential);
    expect(row.potential_low).toBe(p.potentialRange[0]);
    expect(row.template_variant).toBe("default");
  });
});
