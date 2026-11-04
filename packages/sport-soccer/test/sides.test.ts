import { createRng, sumRows } from "@lfs/core";
import { describe, expect, it } from "vitest";
import { generateTeam } from "../src/harness";
import { defaultSoccerConfig, simulateMatch } from "../src/match";
import { FORMATIONS, formation, slotLabel, squadToTeam } from "../src/matchday";
import { POSITIONS } from "../src/positions";
import {
  mirrorTemplate,
  sideGrid,
  variantNameError,
  variantsToRows,
} from "../src/stored-config";
import { placeholderTemplates, SIDE_SHIFT, sideMap } from "../src/templates";
import { generatedVariants } from "../src/variant-presets";

const centreColumn = (values: ArrayLike<number>, cols: number) => {
  let total = 0;
  let weighted = 0;
  for (let i = 0; i < values.length; i++) {
    total += values[i] as number;
    weighted += (values[i] as number) * (i % cols);
  }
  return weighted / total;
};

describe("left and right versions (D112)", () => {
  const cb = placeholderTemplates().CB;

  it("moves the heatmap towards its touchline and keeps every row's total", () => {
    const left = sideMap(cb, "left");
    const right = sideMap(cb, "right");
    const middle = centreColumn(cb.values, 17);
    expect(centreColumn(left.values, 17)).toBeLessThan(middle - SIDE_SHIFT / 2);
    expect(centreColumn(right.values, 17)).toBeGreaterThan(
      middle + SIDE_SHIFT / 2,
    );
    for (let r = 0; r < 25; r++) {
      expect(sumRows(left, r, r + 1)).toBeCloseTo(sumRows(cb, r, r + 1), 12);
      expect(sumRows(right, r, r + 1)).toBeCloseTo(sumRows(cb, r, r + 1), 12);
    }
  });

  it("leaves slots without a side alone and reuses its work", () => {
    expect(sideMap(cb, undefined)).toBe(cb);
    expect(sideMap(cb, "left")).toBe(sideMap(cb, "left"));
  });

  it("keeps a row whose influence would all fall off the pitch", () => {
    const edge = { ...cb, values: new Float64Array(cb.values.length) };
    edge.values[0] = 1; // row 0, leftmost column
    const left = sideMap(edge, "left");
    expect(left.values[0]).toBe(1);
  });

  it("works on stored grids too", () => {
    const grid = [[0, 0, 1, 0, 0]];
    expect(sideGrid(grid, undefined)).toBe(grid);
  });

  it("marks shared positions left and right in every formation", () => {
    const labels = (id: string) =>
      (formation(id)?.slots ?? []).map((s) => slotLabel(s));
    expect(labels("4-4-2")).toEqual([
      "GK",
      "LB",
      "LCB",
      "RCB",
      "RB",
      "LM",
      "LCM",
      "RCM",
      "RM",
      "LST",
      "RST",
    ]);
    expect(labels("3-5-2").slice(1, 4)).toEqual(["LCB", "CB", "RCB"]);
    expect(labels("5-3-2").slice(6, 9)).toEqual(["LCM", "CM", "RCM"]);
    expect(labels("4-2-3-1").slice(5, 7)).toEqual(["LDM", "RDM"]);
    for (const f of FORMATIONS)
      for (const s of f.slots) {
        const same = f.slots.filter((o) => o.position === s.position);
        if (same.length === 1) expect(s.side).toBeUndefined();
      }
  });

  it("plays the same match, with the pair's heatmaps apart", () => {
    const home = generateTeam(createRng("sides-home"), "h", 65);
    const away = generateTeam(createRng("sides-away"), "a", 65);
    const shape = formation("4-4-2");
    if (!shape) throw new Error("no 4-4-2");
    const players = new Map(
      [...home.lineup.map((s) => s.player), ...(home.bench ?? [])].map((p) => [
        p.id,
        p,
      ]),
    );
    const squad = {
      formation: "4-4-2",
      lineup: home.lineup.map((s) => s.player.id),
      bench: (home.bench ?? []).map((p) => p.id),
      subPlan: [],
    };
    const sided = squadToTeam("h", squad, players);
    expect(sided.lineup[2]?.side).toBe("left");
    expect(sided.lineup[3]?.side).toBe("right");
    expect(sided.lineup[1]?.side).toBeUndefined();
    const plain = {
      ...sided,
      lineup: sided.lineup.map(({ player, slot }) => ({ player, slot })),
    };
    const config = defaultSoccerConfig();
    const a = simulateMatch(
      { home: sided, away, mode: "league", config },
      "same",
    );
    const b = simulateMatch(
      { home: plain, away, mode: "league", config },
      "same",
    );
    expect(a.result).toEqual(b.result);
    expect(a.events).toEqual(b.events);
    expect(Array.from(a.influence.home.values)).not.toEqual(
      Array.from(b.influence.home.values),
    );
    for (let r = 0; r < 25; r++)
      expect(sumRows(a.influence.home, r, r + 1)).toBeCloseTo(
        sumRows(b.influence.home, r, r + 1),
        9,
      );
  });
});

describe("generated variants (D112)", () => {
  const variants = generatedVariants();

  it("has three valid, distinct variants for every position", () => {
    for (const p of POSITIONS) {
      const named = variants[p];
      expect(Object.keys(named)).toHaveLength(3);
      for (const name of Object.keys(named))
        expect(variantNameError(name)).toBeNull();
      const grids = Object.values(named).map((g) => JSON.stringify(g));
      expect(new Set(grids).size).toBe(3);
    }
  });

  it("can be saved as they are", () => {
    const rows = variantsToRows(variants, {});
    expect(rows).toHaveLength(POSITIONS.length + 1);
  });

  it("mirrors the right-sided positions from the left", () => {
    for (const [right, left] of [
      ["RB", "LB"],
      ["RM", "LM"],
      ["RW", "LW"],
    ] as const)
      for (const [name, grid] of Object.entries(variants[left]))
        expect(variants[right][name]).toEqual(mirrorTemplate(grid));
  });
});
