import { describe, expect, it } from "vitest";
import { normalizeTeamName, teamNameError } from "../src/team-name";

describe("team names", () => {
  it("trims and collapses spaces", () => {
    expect(normalizeTeamName("  Real   Mad  Lads ")).toBe("Real Mad Lads");
  });

  it("accepts ordinary names in any language", () => {
    for (const name of [
      "FC United",
      "St. Mary's",
      "Brighton & Hove",
      "Borussia Mönchen-Glad",
      "東京 FC",
      "1874",
    ])
      expect(teamNameError(name), name).toBeNull();
  });

  it("rejects names that are too short, too long or oddly shaped", () => {
    expect(teamNameError("FC")).toMatch(/at least 3/);
    expect(teamNameError("x".repeat(31))).toMatch(/at most 30/);
    expect(teamNameError("x".repeat(30))).toBeNull();
    expect(teamNameError("<script>")).toMatch(/letters, numbers/);
    expect(teamNameError("Team 🙂")).toMatch(/letters, numbers/);
    expect(teamNameError("- - -")).toMatch(/letter or number/);
  });
});
