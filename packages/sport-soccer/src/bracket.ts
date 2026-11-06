/**
 * The playoff bracket as the season page draws it (D184, ADR 0006): every
 * round with each club's league place, filled in as matches are played and
 * worked out from the league table until then. A 12-club season has a
 * play-in, quarter-finals, semi-finals and a final (D117); the 8-club
 * seasons from before have semi-finals and a final (D30).
 */
import {
  type BracketRoundDef,
  type Bracket as CoreBracket,
  type BracketMatch as CoreBracketMatch,
  drawBracket,
} from "@lfs/core";
import {
  hasBracket,
  type LeagueSlot,
  type SeasonFixture,
  type Stage,
  table,
} from "./season-play";

export type { BracketSide } from "@lfs/core";

/** A playoff stage: every soccer stage but the league. */
export type PlayoffStage = Exclude<Stage, "league">;

export type BracketMatch = CoreBracketMatch<SeasonFixture, PlayoffStage>;
export type Bracket = CoreBracket<SeasonFixture, PlayoffStage>;

const place = (n: number, label: string) => ({ place: n, label });
const winnerOf = (id: string, label: string) => ({ winnerOf: id, label });

/** The 8-club seasons from before D117: semi-finals and a final (D30). */
export const EIGHT_CLUB_ROUNDS: readonly BracketRoundDef<PlayoffStage>[] = [
  {
    stage: "semi",
    matches: [
      { id: "sf1", home: place(1, "1st"), away: place(4, "4th") },
      { id: "sf2", home: place(2, "2nd"), away: place(3, "3rd") },
    ],
  },
  {
    stage: "final",
    matches: [
      {
        id: "f",
        home: winnerOf("sf1", "Winner of 1st v 4th"),
        away: winnerOf("sf2", "Winner of 2nd v 3rd"),
      },
    ],
  },
];

/** A 12-club season (D117): play-in, quarter-finals, semi-finals, final. */
export const TWELVE_CLUB_ROUNDS: readonly BracketRoundDef<PlayoffStage>[] = [
  {
    stage: "play_in",
    matches: [{ id: "pi", home: place(8, "8th"), away: place(9, "9th") }],
  },
  {
    stage: "quarter",
    matches: [
      {
        id: "qf1",
        home: place(1, "1st"),
        away: winnerOf("pi", "Winner of the play-in"),
      },
      { id: "qf2", home: place(2, "2nd"), away: place(7, "7th") },
      { id: "qf3", home: place(3, "3rd"), away: place(6, "6th") },
      { id: "qf4", home: place(4, "4th"), away: place(5, "5th") },
    ],
  },
  {
    stage: "semi",
    matches: [
      {
        id: "sf1",
        home: winnerOf("qf1", "Winner of quarter-final 1"),
        away: winnerOf("qf4", "Winner of quarter-final 4"),
      },
      {
        id: "sf2",
        home: winnerOf("qf2", "Winner of quarter-final 2"),
        away: winnerOf("qf3", "Winner of quarter-final 3"),
      },
    ],
  },
  {
    stage: "final",
    matches: [
      {
        id: "f",
        home: winnerOf("sf1", "Winner of semi-final 1"),
        away: winnerOf("sf2", "Winner of semi-final 2"),
      },
    ],
  },
];

/** Soccer's playoff bracket, drawn by core's bracket (ADR 0007 §4). */
export function playoffBracket(
  slots: readonly LeagueSlot[],
  fixtures: readonly SeasonFixture[],
): Bracket {
  const places = table(slots, fixtures).map((s) => Number(s.team));
  const leagueLeft = fixtures.some(
    (f) => f.stage === "league" && f.homeScore === null,
  );
  return drawBracket(
    hasBracket(slots) ? TWELVE_CLUB_ROUNDS : EIGHT_CLUB_ROUNDS,
    places,
    fixtures,
    !leagueLeft,
  );
}
