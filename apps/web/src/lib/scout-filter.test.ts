import { describe, expect, it } from "vitest";
import { matchesFilter, NO_FILTER } from "./scout-filter";

const cb = {
  primaryPosition: "CB" as const,
  secondaryPosition: "LB" as const,
  chemistryColor: 2,
};

describe("scouting filters (D108)", () => {
  it("lets everyone through with no filter", () => {
    expect(matchesFilter(cb, false, NO_FILTER)).toBe(true);
  });

  it("matches a position by primary or secondary", () => {
    expect(matchesFilter(cb, false, { ...NO_FILTER, position: "CB" })).toBe(
      true,
    );
    expect(matchesFilter(cb, false, { ...NO_FILTER, position: "LB" })).toBe(
      true,
    );
    expect(matchesFilter(cb, false, { ...NO_FILTER, position: "ST" })).toBe(
      false,
    );
  });

  it("filters by chemistry colour, including colour 0", () => {
    expect(matchesFilter(cb, false, { ...NO_FILTER, color: 2 })).toBe(true);
    expect(matchesFilter(cb, false, { ...NO_FILTER, color: 0 })).toBe(false);
  });

  it("can show only ticked players", () => {
    const f = { ...NO_FILTER, tickedOnly: true };
    expect(matchesFilter(cb, true, f)).toBe(true);
    expect(matchesFilter(cb, false, f)).toBe(false);
  });
});
