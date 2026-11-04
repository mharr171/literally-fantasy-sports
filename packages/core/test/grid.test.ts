import { describe, expect, it } from "vitest";
import {
  addScaled,
  cellValue,
  createInfluenceMap,
  influenceMapFromRows,
  sumRows,
} from "../src/grid";

describe("influence maps", () => {
  it("creates an empty map of the right size", () => {
    const map = createInfluenceMap({ rows: 17, cols: 25 });
    expect(map.values).toHaveLength(17 * 25);
    expect(map.values.every((v) => v === 0)).toBe(true);
    expect(() => createInfluenceMap({ rows: 0, cols: 5 })).toThrow(RangeError);
    expect(() => createInfluenceMap({ rows: 2.5, cols: 5 })).toThrow(
      RangeError,
    );
  });

  it("builds a map from rows and reads cells", () => {
    const map = influenceMapFromRows([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    expect(map.size).toEqual({ rows: 2, cols: 3 });
    expect(cellValue(map, 1, 2)).toBe(6);
    expect(() => cellValue(map, 2, 0)).toThrow(RangeError);
    expect(() => cellValue(map, 0, -1)).toThrow(RangeError);
  });

  it("rejects ragged rows, negative or non-finite values and empty grids", () => {
    expect(() => influenceMapFromRows([[1, 2], [3]])).toThrow(/Row 1/);
    expect(() => influenceMapFromRows([[1, -1]])).toThrow(RangeError);
    expect(() => influenceMapFromRows([[1, Number.NaN]])).toThrow(RangeError);
    expect(() => influenceMapFromRows([])).toThrow(RangeError);
  });

  it("adds a weighted template into a team map", () => {
    const team = createInfluenceMap({ rows: 2, cols: 2 });
    const template = influenceMapFromRows([
      [1, 0],
      [0, 2],
    ]);
    addScaled(team, template, 1.5);
    addScaled(team, template, 0.5);
    expect([...team.values]).toEqual([2, 0, 0, 4]);
    expect(() =>
      addScaled(team, createInfluenceMap({ rows: 1, cols: 2 }), 1),
    ).toThrow(RangeError);
    expect(() =>
      addScaled(team, createInfluenceMap({ rows: 2, cols: 1 }), 1),
    ).toThrow(RangeError);
  });

  it("sums a band of rows", () => {
    const map = influenceMapFromRows([
      [1, 1],
      [2, 2],
      [3, 3],
    ]);
    expect(sumRows(map, 0, 3)).toBe(12);
    expect(sumRows(map, 2, 3)).toBe(6);
    expect(sumRows(map, 1, 1)).toBe(0);
    expect(() => sumRows(map, -1, 2)).toThrow(RangeError);
    expect(() => sumRows(map, 0, 4)).toThrow(RangeError);
    expect(() => sumRows(map, 2, 1)).toThrow(RangeError);
  });
});
