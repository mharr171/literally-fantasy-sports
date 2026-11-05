import { describe, expect, it } from "vitest";
import {
  autoPickSquad,
  buildFormation,
  FORMATIONS,
  formation,
  formationProblems,
  registerFormations,
} from "../src";
import { STARTER_PACKS } from "../src/generation";
import { packContents } from "../src/roster";

const roster = STARTER_PACKS.flatMap(({ focus, count }) =>
  Array.from({ length: count }, (_, i) =>
    packContents(`cf-${focus}-${i}`, focus, "starter"),
  ).flat(),
).map((p, i) => ({ ...p, id: `cf-${i}` }));

const slots451 = [
  { position: "ST", x: 50, y: 85 },
  { position: "GK", x: 50, y: 6 },
  { position: "LB", x: 12, y: 26 },
  { position: "CB", x: 37, y: 22 },
  { position: "CB", x: 63, y: 22 },
  { position: "RB", x: 88, y: 26 },
  { position: "LM", x: 12, y: 58 },
  { position: "CM", x: 30, y: 52 },
  { position: "CM", x: 50, y: 48 },
  { position: "CM", x: 70, y: 52 },
  { position: "RM", x: 88, y: 58 },
] as const;

describe("admin-made formations (D140)", () => {
  it("builds keeper first with sides for shared positions", () => {
    const f = buildFormation("4-5-1", slots451);
    expect(f.slots[0]?.position).toBe("GK");
    const cms = f.slots.filter((s) => s.position === "CM");
    expect(cms.map((s) => s.side)).toEqual(["left", undefined, "right"]);
    expect(f.slots.find((s) => s.position === "ST")?.side).toBeUndefined();
  });

  it("finds a formation only once it's registered, and never replaces one", () => {
    expect(formation("4-5-1")).toBeUndefined();
    registerFormations([{ id: "4-5-1", slots: [...slots451] }]);
    expect(formation("4-5-1")?.slots).toHaveLength(11);
    registerFormations([
      { id: "4-5-1", slots: [...slots451].reverse() },
      { id: "4-4-2", slots: [...slots451] },
    ]);
    expect(formation("4-5-1")?.slots[1]?.position).toBe("ST");
    expect(formation("4-4-2")).toBe(FORMATIONS[0]);
  });

  it("auto-picks into a registered formation", () => {
    registerFormations([{ id: "4-5-1", slots: [...slots451] }]);
    const squad = autoPickSquad(roster, "4-5-1");
    expect(squad.formation).toBe("4-5-1");
    expect(squad.lineup).toHaveLength(11);
  });

  it("lists what's wrong with a new formation", () => {
    expect(formationProblems("4-1-4-1b", slots451, [])).toEqual([]);
    expect(formationProblems("4-4-2", slots451, [])).toEqual([
      "4-4-2 already exists.",
    ]);
    expect(formationProblems("4-5-2x", slots451, ["4-5-2x"])).toEqual([
      "4-5-2x already exists.",
    ]);
    expect(
      formationProblems(
        "Bad name",
        [...slots451.slice(0, 10), { position: "GK", x: 50, y: 85 }],
        [],
      ),
    ).toEqual([
      'Name it like "4-5-1" or "4-3-2-1b".',
      "Use exactly one goalkeeper.",
      "Two slots share a spot.",
    ]);
    expect(
      formationProblems(
        "3-3-3",
        [...slots451.slice(0, 9), { position: "CM", x: 101, y: 4.5 }],
        [],
      ),
    ).toEqual([
      "Use 11 slots (10 now).",
      "Place every slot on the pitch (0 to 100 each way).",
    ]);
  });
});
