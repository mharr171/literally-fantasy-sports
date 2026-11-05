/**
 * The playoff bracket as the season page draws it (D184, ADR 0006): every
 * round with each club's league place, filled in as matches are played and
 * worked out from the league table until then. A 12-club season has a
 * play-in, quarter-finals, semi-finals and a final (D117); the 8-club
 * seasons from before have semi-finals and a final (D30).
 */
import {
  hasBracket,
  type LeagueSlot,
  type SeasonFixture,
  type Stage,
  table,
} from "./season-play";

export interface BracketSide {
  /** The club's league slot, or null while it isn't known yet. */
  slot: number | null;
  /** Its final (or current) league place, 1 = top. */
  seed: number | null;
  /** What fills the place until it's known, e.g. "Winner of the play-in". */
  placeholder: string;
}

export interface BracketMatch {
  stage: Exclude<Stage, "league">;
  home: BracketSide;
  away: BracketSide;
  /** The fixture once it exists, with its score and winner. */
  fixture: SeasonFixture | null;
  /** The winning slot once played. */
  winner: number | null;
}

export interface Bracket {
  /** False while the league is still being played: places can change. */
  final: boolean;
  rounds: { stage: Exclude<Stage, "league">; matches: BracketMatch[] }[];
}

const winnerOf = (f: SeasonFixture | null): number | null => {
  if (!f || f.homeScore === null || f.awayScore === null) return null;
  if (f.winner) return f.winner === "home" ? f.homeSlot : f.awaySlot;
  if (f.homeScore === f.awayScore) return null;
  return f.homeScore > f.awayScore ? f.homeSlot : f.awaySlot;
};

export function playoffBracket(
  slots: readonly LeagueSlot[],
  fixtures: readonly SeasonFixture[],
): Bracket {
  const standings = table(slots, fixtures);
  const seedOf = new Map(standings.map((s, i) => [Number(s.team), i + 1]));
  const atPlace = (place: number) => {
    const s = standings[place - 1];
    return s ? Number(s.team) : null;
  };
  const leagueLeft = fixtures.some(
    (f) => f.stage === "league" && f.homeScore === null,
  );
  const side = (slot: number | null, placeholder: string): BracketSide => ({
    slot,
    seed: slot === null ? null : (seedOf.get(slot) ?? null),
    placeholder,
  });
  // A round's fixture between these clubs, if it has been drawn.
  const find = (stage: Stage, a: number | null, b: number | null) =>
    fixtures.find(
      (f) =>
        f.stage === stage &&
        (a === null || f.homeSlot === a || f.awaySlot === a) &&
        (b === null || f.homeSlot === b || f.awaySlot === b),
    ) ?? null;
  const match = (
    stage: Exclude<Stage, "league">,
    home: BracketSide,
    away: BracketSide,
  ): BracketMatch => {
    const fixture =
      home.slot !== null || away.slot !== null
        ? find(stage, home.slot, away.slot)
        : null;
    // The drawn fixture decides who's at home.
    const h = fixture ? side(fixture.homeSlot, home.placeholder) : home;
    const a = fixture ? side(fixture.awaySlot, away.placeholder) : away;
    return { stage, home: h, away: a, fixture, winner: winnerOf(fixture) };
  };
  const w = (m: BracketMatch, label: string) => side(m.winner, label);

  if (!hasBracket(slots)) {
    const semis = [
      match("semi", side(atPlace(1), "1st"), side(atPlace(4), "4th")),
      match("semi", side(atPlace(2), "2nd"), side(atPlace(3), "3rd")),
    ];
    const final = match(
      "final",
      w(semis[0] as BracketMatch, "Winner of 1st v 4th"),
      w(semis[1] as BracketMatch, "Winner of 2nd v 3rd"),
    );
    return {
      final: !leagueLeft,
      rounds: [
        { stage: "semi", matches: semis },
        { stage: "final", matches: [final] },
      ],
    };
  }

  const playIn = match(
    "play_in",
    side(atPlace(8), "8th"),
    side(atPlace(9), "9th"),
  );
  const quarters = [
    match(
      "quarter",
      side(atPlace(1), "1st"),
      w(playIn, "Winner of the play-in"),
    ),
    match("quarter", side(atPlace(2), "2nd"), side(atPlace(7), "7th")),
    match("quarter", side(atPlace(3), "3rd"), side(atPlace(6), "6th")),
    match("quarter", side(atPlace(4), "4th"), side(atPlace(5), "5th")),
  ] as const;
  const semis = [
    match(
      "semi",
      w(quarters[0], "Winner of quarter-final 1"),
      w(quarters[3], "Winner of quarter-final 4"),
    ),
    match(
      "semi",
      w(quarters[1], "Winner of quarter-final 2"),
      w(quarters[2], "Winner of quarter-final 3"),
    ),
  ] as const;
  const final = match(
    "final",
    w(semis[0], "Winner of semi-final 1"),
    w(semis[1], "Winner of semi-final 2"),
  );
  return {
    final: !leagueLeft,
    rounds: [
      { stage: "play_in", matches: [playIn] },
      { stage: "quarter", matches: [...quarters] },
      { stage: "semi", matches: [...semis] },
      { stage: "final", matches: [final] },
    ],
  };
}
