import { describe, expect, it } from "vitest";
import { hasOwnMatch } from "../src/play-week";

const fixture = (
  week: number,
  homeSlot: number,
  awaySlot: number,
  played = false,
) => ({
  week,
  homeSlot,
  awaySlot,
  homeScore: played ? 1 : null,
});

describe("hasOwnMatch (D134)", () => {
  it("is true when the club plays this week, as home or away", () => {
    expect(hasOwnMatch({ week: 3, fixtures: [fixture(3, 0, 4)] })).toBe(true);
    expect(hasOwnMatch({ week: 3, fixtures: [fixture(3, 5, 0)] })).toBe(true);
  });

  it("is false for a week of other clubs' matches, like the play-in for 1st-7th", () => {
    expect(
      hasOwnMatch({
        week: 23,
        fixtures: [fixture(22, 0, 4, true), fixture(23, 8, 9)],
      }),
    ).toBe(false);
    expect(hasOwnMatch({ week: 3, fixtures: [fixture(3, 0, 4, true)] })).toBe(
      false,
    );
  });
});
