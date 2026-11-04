import type { MatchSummary } from "@lfs/sport-soccer";
import { describe, expect, it } from "vitest";
import { scoreOnly } from "./match-kept";

const full: MatchSummary = {
  possession: { home: 0.55, away: 0.45 },
  shots: { home: 5, away: 3 },
  events: [],
};

describe("scoreOnly", () => {
  it("keeps nothing for a league match", () => {
    expect(scoreOnly(full)).toBeNull();
    expect(scoreOnly(null)).toBeNull();
  });

  it("keeps how a knockout was decided", () => {
    expect(scoreOnly({ ...full, decidedBy: "extra_time" })).toEqual({
      decidedBy: "extra_time",
    });
    expect(
      scoreOnly({
        ...full,
        decidedBy: "penalties",
        penalties: { home: 4, away: 3 },
      }),
    ).toEqual({ decidedBy: "penalties", penalties: { home: 4, away: 3 } });
  });
});
