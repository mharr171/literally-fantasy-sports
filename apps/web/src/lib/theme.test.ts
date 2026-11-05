import { describe, expect, it } from "vitest";
import { isDark, isTheme } from "./theme";

describe("theme (D133)", () => {
  it("knows the three choices", () => {
    expect(isTheme("light")).toBe(true);
    expect(isTheme("dark")).toBe(true);
    expect(isTheme("system")).toBe(true);
    expect(isTheme("blue")).toBe(false);
    expect(isTheme(null)).toBe(false);
  });

  it("shows dark for Dark, or for System on a dark computer", () => {
    expect(isDark("dark", false)).toBe(true);
    expect(isDark("light", true)).toBe(false);
    expect(isDark("system", true)).toBe(true);
    expect(isDark("system", false)).toBe(false);
  });
});
