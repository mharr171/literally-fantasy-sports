import { packContents } from "@lfs/sport-soccer";
import { describe, expect, it } from "vitest";
import {
  countByLine,
  scoutPlayer,
  sortPacks,
  starterPlayerRow,
} from "./scouting";

const players = packContents("scouting-test", "any", "starter");

describe("scouting", () => {
  it("never shows a player's true potential (D48)", () => {
    for (const p of players) {
      const shown = scoutPlayer(p);
      expect(shown).not.toHaveProperty("potential");
      expect(JSON.stringify(shown)).not.toContain("attributes");
      expect(shown.potentialRange).toEqual(p.potentialRange);
      expect(shown.worth).toBeGreaterThan(0);
    }
  });

  it("saves the full player, true potential included, for the server", () => {
    const [p] = players;
    if (!p) throw new Error("empty pack");
    const row = starterPlayerRow(p);
    expect(row.potential).toBe(p.potential);
    expect([row.potential_low, row.potential_high]).toEqual(p.potentialRange);
    expect(row.worth).toBe(scoutPlayer(p).worth);
    expect(row.attributes).toEqual(p.attributes);
  });

  it("orders packs by focus, then id", () => {
    const sorted = sortPacks([
      { id: "b", focus: "any" },
      { id: "c", focus: "goal" },
      { id: "a", focus: "any" },
      { id: "d", focus: "attack" },
      { id: "e", focus: "unknown" },
    ]);
    expect(sorted.map((p) => p.id)).toEqual(["d", "c", "a", "b", "e"]);
  });

  it("counts players in each line", () => {
    expect(
      countByLine([
        { primaryPosition: "GK" },
        { primaryPosition: "CB" },
        { primaryPosition: "LW" },
        { primaryPosition: "ST" },
      ]),
    ).toEqual({ goal: 1, defence: 1, midfield: 0, attack: 2 });
  });
});
