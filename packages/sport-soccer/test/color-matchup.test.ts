import { describe, expect, it } from "vitest";
import { colorMatchups, dominantMatchup } from "../src/color-matchup";

const team = (...colors: number[]) =>
  colors.map((chemistryColor) => ({ chemistryColor }));

describe("color matchups for managers (D139)", () => {
  it("lists what each color beats and loses to", () => {
    // Red (0) beats Yellow (3) and Green (2); loses to Blue (1) and Purple (4).
    expect(colorMatchups(0)).toEqual({ beats: [3, 2], losesTo: [1, 4] });
    expect(colorMatchups(1)).toEqual({ beats: [4, 0], losesTo: [3, 2] });
  });

  it("compares two starting 11s' dominant colors", () => {
    expect(dominantMatchup(team(0, 0, 0, 1), team(2, 2, 4))).toEqual({
      mine: 0,
      theirs: 2,
      edge: 1,
    });
    expect(dominantMatchup(team(2, 2), team(0, 0, 0)).edge).toBe(-1);
    // No dominant color on one side: even.
    expect(dominantMatchup(team(0, 0, 1, 1), team(2, 2, 2))).toEqual({
      mine: null,
      theirs: 2,
      edge: 0,
    });
  });
});
