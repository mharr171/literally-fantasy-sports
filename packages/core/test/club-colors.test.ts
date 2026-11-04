import { describe, expect, it } from "vitest";
import {
  CLUB_COLORS,
  clubColor,
  clubColorsError,
  clubColorsFor,
} from "../src/club-colors";

describe("club colors (D107)", () => {
  it("has a palette of unique keys and hex colors", () => {
    expect(new Set(CLUB_COLORS.map((c) => c.key)).size).toBe(
      CLUB_COLORS.length,
    );
    for (const c of CLUB_COLORS) expect(c.hex).toMatch(/^#[0-9a-f]{6}$/);
    expect(clubColor("navy")?.name).toBe("Navy");
    expect(clubColor("plaid")).toBeUndefined();
  });

  it("allows 2 or 3 different palette colors", () => {
    expect(clubColorsError(["red", "white"])).toBeNull();
    expect(clubColorsError(["red", "white", "black"])).toBeNull();
    expect(clubColorsError(["red"])).toMatch(/2 or 3/);
    expect(clubColorsError(["red", "white", "black", "gold"])).toMatch(
      /2 or 3/,
    );
    expect(clubColorsError(["red", "red"])).toMatch(/once/);
    expect(clubColorsError(["red", "plaid"])).toMatch(/isn't one/);
  });

  it("uses a club's own colors, in order", () => {
    expect(clubColorsFor("Any FC", ["navy", "gold"]).map((c) => c.key)).toEqual(
      ["navy", "gold"],
    );
  });

  it("gives clubs without colors a fixed pair from their name", () => {
    const a = clubColorsFor("Riverside Rovers", null);
    expect(a).toHaveLength(2);
    expect(a[0]?.key).not.toBe(a[1]?.key);
    expect(clubColorsFor("riverside rovers", [])).toEqual(a);
    expect(clubColorsFor("Riverside Rovers", ["red"])).toEqual(a);
    const pairs = new Set(
      ["A", "B", "C", "D", "E", "F", "G", "H"].map((n) =>
        clubColorsFor(`${n} United`, null)
          .map((c) => c.key)
          .join(),
      ),
    );
    expect(pairs.size).toBeGreaterThan(4);
  });
});
