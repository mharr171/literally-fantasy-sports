import { describe, expect, it } from "vitest";
import {
  isPosition,
  POSITION_LINE,
  POSITION_NAMES,
  POSITIONS,
} from "../src/positions";

describe("positions (D77)", () => {
  it("has the 12 agreed positions", () => {
    expect(POSITIONS).toEqual([
      "GK",
      "CB",
      "LB",
      "RB",
      "DM",
      "CM",
      "AM",
      "LM",
      "RM",
      "LW",
      "RW",
      "ST",
    ]);
  });

  it("puts every position on a line and gives it a name", () => {
    for (const p of POSITIONS) {
      expect(POSITION_LINE[p]).toBeDefined();
      expect(POSITION_NAMES[p]).toMatch(/\w/);
    }
    expect(POSITIONS.filter((p) => POSITION_LINE[p] === "attack")).toEqual([
      "LW",
      "RW",
      "ST",
    ]);
    expect(POSITIONS.filter((p) => POSITION_LINE[p] === "goal")).toEqual([
      "GK",
    ]);
  });

  it("recognises position codes", () => {
    expect(isPosition("LW")).toBe(true);
    expect(isPosition("CF")).toBe(false);
  });
});
