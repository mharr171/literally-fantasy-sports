import { createRng } from "@lfs/core";
import { describe, expect, it } from "vitest";
import { isRegisteredSport, SOCCER, SPORTS, sportModule } from "../src/sports";
import {
  chooseKeeps,
  choosePack,
  chooseYouth,
  DEFAULT_PACK_PRICES,
  packContents,
  pickStarterKeeps,
  rollAiIdentity,
} from "../src/sports/soccer";

describe("the sport registry (ADR 0007 §1)", () => {
  it("knows soccer and baseball, and refuses sports it can't run yet", () => {
    expect(SPORTS).toEqual(["soccer", "baseball"]);
    expect(isRegisteredSport("soccer")).toBe(true);
    expect(isRegisteredSport("hockey")).toBe(false);
    expect(sportModule(SOCCER).engine.id).toBe("soccer");
    // Baseball's stand-in has no AI manager: its AI world stays off (D207).
    expect(sportModule("baseball").engine.id).toBe("baseball");
    expect(sportModule("baseball").ai).toBeUndefined();
    expect(() => sportModule("hockey")).toThrow(/No sport module/);
  });

  it("soccer's AI decides exactly as before through the interface (§8)", () => {
    const ai = sportModule(SOCCER).ai;
    const profile = {
      personality: "steady" as const,
      pace: "normal" as const,
      formation: "4-4-2",
    };
    const pool = Array.from({ length: 22 }, (_, i) =>
      packContents(`pool-${i}`, "any", "starter"),
    ).flat();
    expect(ai.pickStarters(pool, profile)).toEqual(
      pickStarterKeeps(pool, "steady"),
    );
    const roster = pool.slice(0, 24);
    const pack = packContents("pk", "any", "silver");
    expect(ai.chooseKeeps(pack, roster, profile)).toEqual(
      chooseKeeps(pack, roster, "steady"),
    );
    expect(ai.chooseYouth(pool.slice(0, 22), 24, profile)).toEqual(
      chooseYouth(pool.slice(0, 22), 24, "steady"),
    );
    expect(
      ai.choosePack(40_000, roster, profile, DEFAULT_PACK_PRICES, 3),
    ).toEqual(choosePack(40_000, roster, "steady", DEFAULT_PACK_PRICES, 3));
    expect(ai.rollIdentity(createRng("id"), new Set(), ["4-4-2"])).toEqual(
      rollAiIdentity(createRng("id"), new Set(), ["4-4-2"]),
    );
  });
});

describe("season modules (ADR 0009 §1)", () => {
  it("gives soccer its season part, and none to baseball yet", () => {
    expect(sportModule("soccer").season).toBeDefined();
    expect(sportModule("baseball").season).toBeUndefined();
  });

  it("puts the club in the same league slot as soccer does", async () => {
    const { MANAGER_SLOT } = await import("../src/season-module");
    const soccer = await import("../src/sports/soccer");
    expect(MANAGER_SLOT).toBe(soccer.MANAGER_SLOT);
  });
});
