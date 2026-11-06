import { describe, expect, it } from "vitest";
import {
  type BracketFixture,
  type BracketRoundDef,
  drawBracket,
  gameWinner,
  seriesWinner,
} from "../src/bracket";

const game = (
  stage: string,
  home: number,
  away: number,
  score: [number, number] | null,
  gameNo = 1,
): BracketFixture => ({
  stage,
  homeSlot: home,
  awaySlot: away,
  homeScore: score?.[0] ?? null,
  awayScore: score?.[1] ?? null,
  winner: null,
  gameNo,
});

describe("bracket (ADR 0007 §4)", () => {
  it("decides games and best-of series", () => {
    expect(gameWinner(game("final", 1, 2, [2, 1]))).toBe(1);
    expect(gameWinner(game("final", 1, 2, [1, 1]))).toBeNull();
    expect(gameWinner({ ...game("final", 1, 2, [1, 1]), winner: "away" })).toBe(
      2,
    );
    expect(gameWinner(game("final", 1, 2, null))).toBeNull();
    const series = [
      game("semi", 1, 2, [3, 1], 1),
      game("semi", 1, 2, [0, 4], 2),
      game("semi", 2, 1, [2, 5], 3),
    ];
    expect(seriesWinner(series.slice(0, 2), 3)).toBeNull();
    expect(seriesWinner(series, 3)).toBe(1);
  });

  const rounds: BracketRoundDef[] = [
    {
      stage: "semi",
      games: 3,
      matches: [
        {
          id: "a",
          home: { place: 1, label: "1st" },
          away: { place: 4, label: "4th" },
        },
        {
          id: "b",
          home: { place: 2, label: "2nd" },
          away: { place: 3, label: "3rd" },
        },
      ],
    },
    {
      stage: "final",
      matches: [
        {
          id: "f",
          home: { winnerOf: "a", label: "Winner A" },
          away: { winnerOf: "b", label: "Winner B" },
        },
      ],
    },
  ];

  it("fills in seeds from the table and winners as series finish", () => {
    const places = [10, 20, 30, 40];
    const before = drawBracket(rounds, places, [], false);
    expect(before.final).toBe(false);
    expect(before.rounds[0]?.matches[0]?.home).toEqual({
      slot: 10,
      seed: 1,
      placeholder: "1st",
    });
    expect(before.rounds[1]?.matches[0]?.home.slot).toBeNull();

    const fixtures = [
      game("semi", 10, 40, [2, 0], 1),
      game("semi", 40, 10, [1, 3], 2),
      game("semi", 30, 20, [4, 1], 1),
    ];
    const b = drawBracket(rounds, places, fixtures, true);
    const [a, bb] = b.rounds[0]?.matches ?? [];
    expect(a?.games).toHaveLength(2);
    expect(a?.winner).toBe(10);
    // The drawn first game decides who's at home.
    expect(bb?.home.slot).toBe(30);
    expect(bb?.winner).toBeNull();
    expect(b.rounds[1]?.matches[0]?.home.slot).toBe(10);
    expect(b.rounds[1]?.matches[0]?.away.slot).toBeNull();
  });
});
