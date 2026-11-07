/**
 * Baseball's postseason (ADR 0009 §2, D199): the top 7 and the winner of
 * a wildcard game between 8th and 9th; quarterfinals best of 3,
 * semifinals best of 5 and the final best of 7, each round a fresh week.
 * The better seed has home field: the wildcard game, all of a best of 3,
 * games 1, 2 and 5 of a best of 5, and games 1, 2, 6 and 7 of a best of 7.
 * A series is drawn in full; games it doesn't need are marked skipped.
 */
import {
  type Bracket,
  type BracketFixture,
  type BracketRoundDef,
  drawBracket,
  type PayoutSettings,
} from "@lfs/core";
import type { BaseballNewGame } from "./season";

export type PostseasonStage = "wildcard" | "quarter" | "semi" | "final";

/** How far a club got, as season records keep it (D120). */
export type PostseasonFinish =
  | "none"
  | "wildcard"
  | "quarter"
  | "semi"
  | "final"
  | "champion";

/** Clubs that reach the postseason: the top 7 and the wildcard pair. */
export const POSTSEASON_PLACES = 9;

const place = (n: number, label: string) => ({ place: n, label });
const winnerOf = (id: string, label: string) => ({ winnerOf: id, label });

export const BASEBALL_ROUNDS: readonly BracketRoundDef<PostseasonStage>[] = [
  {
    stage: "wildcard",
    games: 1,
    matches: [{ id: "wc", home: place(8, "8th"), away: place(9, "9th") }],
  },
  {
    stage: "quarter",
    games: 3,
    matches: [
      {
        id: "q1",
        home: place(1, "1st"),
        away: winnerOf("wc", "Wildcard winner"),
      },
      { id: "q2", home: place(4, "4th"), away: place(5, "5th") },
      { id: "q3", home: place(2, "2nd"), away: place(7, "7th") },
      { id: "q4", home: place(3, "3rd"), away: place(6, "6th") },
    ],
  },
  {
    stage: "semi",
    games: 5,
    matches: [
      {
        id: "s1",
        home: winnerOf("q1", "Winner of 1st v wildcard"),
        away: winnerOf("q2", "Winner of 4th v 5th"),
      },
      {
        id: "s2",
        home: winnerOf("q3", "Winner of 2nd v 7th"),
        away: winnerOf("q4", "Winner of 3rd v 6th"),
      },
    ],
  },
  {
    stage: "final",
    games: 7,
    matches: [
      {
        id: "f",
        home: winnerOf("s1", "Semifinal winner"),
        away: winnerOf("s2", "Semifinal winner"),
      },
    ],
  },
];

/** Games in each round's series. */
export const SERIES_LENGTH: Record<PostseasonStage, number> = {
  wildcard: 1,
  quarter: 3,
  semi: 5,
  final: 7,
};

/** Games the lower seed hosts, by series length (the rest are the better seed's). */
const AWAY_GAMES: Record<number, readonly number[]> = {
  1: [],
  3: [],
  5: [3, 4],
  7: [3, 4, 5],
};

/** Who hosts game `gameNo` of a series between a better and a worse seed. */
export function seriesHome(
  better: number,
  worse: number,
  games: number,
  gameNo: number,
): { homeSlot: number; awaySlot: number } {
  return (AWAY_GAMES[games] ?? []).includes(gameNo)
    ? { homeSlot: worse, awaySlot: better }
    : { homeSlot: better, awaySlot: worse };
}

/** A game as the postseason needs it: its week too. */
export interface PostseasonFixture extends BracketFixture {
  week: number;
  skipped?: boolean;
}

/**
 * The bracket. `places` lists the slots best first by the final standings;
 * `leagueDone` says whether the regular season is over.
 */
export function baseballBracket<F extends PostseasonFixture>(
  places: readonly number[],
  fixtures: readonly F[],
  leagueDone: boolean,
): Bracket<F, PostseasonStage> {
  // A skipped game was never played: it decides nothing.
  return drawBracket(
    BASEBALL_ROUNDS,
    places,
    fixtures.filter((f) => f.stage !== "league" && !f.skipped),
    leagueDone,
  );
}

/**
 * The next round's games, once the round before is decided and the next
 * isn't drawn yet: every game of every series, in a new week after the
 * latest. Empty while a round is still going, before the regular season
 * is over, and once the final is decided.
 */
export function nextPostseasonGames(
  places: readonly number[],
  fixtures: readonly PostseasonFixture[],
  leagueDone: boolean,
): BaseballNewGame[] {
  if (!leagueDone || places.length < POSTSEASON_PLACES) return [];
  const bracket = baseballBracket(places, fixtures, true);
  const seed = new Map(places.map((slot, i) => [slot, i + 1]));
  const week = Math.max(0, ...fixtures.map((f) => f.week)) + 1;
  for (const round of bracket.rounds) {
    const drawn = round.matches.some((m) => m.games.length > 0);
    if (drawn) {
      if (round.matches.some((m) => m.winner === null)) return [];
      continue;
    }
    const games = SERIES_LENGTH[round.stage];
    return round.matches.flatMap((m) => {
      const a = m.home.slot as number;
      const b = m.away.slot as number;
      const [better, worse] =
        (seed.get(a) ?? 99) <= (seed.get(b) ?? 99) ? [a, b] : [b, a];
      return Array.from({ length: games }, (_, g) => ({
        week,
        stage: round.stage,
        gameNo: g + 1,
        ...seriesHome(better, worse, games, g + 1),
      }));
    });
  }
  return [];
}

/** Whether the final is decided. */
export function postseasonDone(
  bracket: Bracket<PostseasonFixture, PostseasonStage>,
): boolean {
  return (bracket.rounds.at(-1)?.matches[0]?.winner ?? null) !== null;
}

/** How far a club got: the round it went out in, or champion (D120). */
export function postseasonFinish(
  slot: number,
  bracket: Bracket<PostseasonFixture, PostseasonStage>,
): PostseasonFinish {
  let finish: PostseasonFinish = "none";
  for (const round of bracket.rounds)
    for (const m of round.matches) {
      if (m.home.slot !== slot && m.away.slot !== slot) continue;
      if (m.games.length === 0) continue;
      finish = round.stage;
      if (round.stage === "final" && m.winner === slot) return "champion";
    }
  return finish;
}

/**
 * The bonus for reaching a round (D117), on top of the one before:
 * quarterfinals, semifinals, the final, and winning it. The wildcard game
 * pays nothing extra.
 */
export function postseasonBonus(
  reached: PostseasonFinish,
  payouts: Pick<PayoutSettings, "quarter" | "playoffs" | "final" | "champion">,
): number {
  return reached === "quarter"
    ? payouts.quarter
    : reached === "semi"
      ? payouts.playoffs
      : reached === "final"
        ? payouts.final
        : reached === "champion"
          ? payouts.champion
          : 0;
}
