/**
 * Drawing a playoff bracket, for every sport (ADR 0007 §4, D184): each
 * round's matches with each club's league place, filled in as games are
 * played and worked out from the league table until then. A sport describes
 * its rounds as data (who meets whom, and how many games a round's series
 * has); soccer plays single games, baseball best-of series.
 */

/** A played or unplayed game, as the bracket needs it. */
export interface BracketFixture {
  stage: string;
  homeSlot: number;
  awaySlot: number;
  homeScore: number | null;
  awayScore: number | null;
  /** Knockout winner, when it was decided after a level score. */
  winner: "home" | "away" | null;
  /** Game number within a series; 1 for a single game. */
  gameNo?: number;
}

/** Who fills one side of a match: a league place, or a match's winner. */
export type BracketRef =
  | { place: number; label: string }
  | { winnerOf: string; label: string };

export interface BracketRoundDef<S extends string = string> {
  stage: S;
  /** Games in each match's series; 1 (a single game) by default. */
  games?: number;
  matches: readonly { id: string; home: BracketRef; away: BracketRef }[];
}

export interface BracketSide {
  /** The club's league slot, or null while it isn't known yet. */
  slot: number | null;
  /** Its final (or current) league place, 1 = top. */
  seed: number | null;
  /** What fills the place until it's known, e.g. "Winner of the play-in". */
  placeholder: string;
}

export interface BracketMatch<
  F extends BracketFixture = BracketFixture,
  S extends string = string,
> {
  stage: S;
  home: BracketSide;
  away: BracketSide;
  /** The series' first game once it exists, with its score and winner. */
  fixture: F | null;
  /** Every game of the series drawn so far, in order. */
  games: F[];
  /** The winning slot once the match (or series) is decided. */
  winner: number | null;
}

export interface Bracket<
  F extends BracketFixture = BracketFixture,
  S extends string = string,
> {
  /** False while the league is still being played: places can change. */
  final: boolean;
  rounds: { stage: S; matches: BracketMatch<F, S>[] }[];
}

/** The winning slot of one game, or null while unplayed or level. */
export function gameWinner(f: BracketFixture | null): number | null {
  if (!f || f.homeScore === null || f.awayScore === null) return null;
  if (f.winner) return f.winner === "home" ? f.homeSlot : f.awaySlot;
  if (f.homeScore === f.awayScore) return null;
  return f.homeScore > f.awayScore ? f.homeSlot : f.awaySlot;
}

/** The winner of a best-of-`games` series: first to more than half. */
export function seriesWinner(
  played: readonly BracketFixture[],
  games = 1,
): number | null {
  const need = Math.floor(games / 2) + 1;
  const wins = new Map<number, number>();
  for (const g of played) {
    const w = gameWinner(g);
    if (w === null) continue;
    const n = (wins.get(w) ?? 0) + 1;
    if (n >= need) return w;
    wins.set(w, n);
  }
  return null;
}

/**
 * Draws the bracket. `places` lists the league's slots best first (index 0
 * is 1st); `leagueDone` is whether every league game has been played.
 */
export function drawBracket<F extends BracketFixture, S extends string>(
  rounds: readonly BracketRoundDef<S>[],
  places: readonly number[],
  fixtures: readonly F[],
  leagueDone: boolean,
): Bracket<F, S> {
  const seedOf = new Map(places.map((slot, i) => [slot, i + 1]));
  const side = (slot: number | null, placeholder: string): BracketSide => ({
    slot,
    seed: slot === null ? null : (seedOf.get(slot) ?? null),
    placeholder,
  });
  // A round's games between these clubs, if they have been drawn.
  const find = (stage: S, a: number | null, b: number | null) =>
    fixtures
      .filter(
        (f) =>
          f.stage === stage &&
          (a === null || f.homeSlot === a || f.awaySlot === a) &&
          (b === null || f.homeSlot === b || f.awaySlot === b),
      )
      .sort((x, y) => (x.gameNo ?? 1) - (y.gameNo ?? 1));
  const winners = new Map<string, number | null>();
  const resolve = (ref: BracketRef): BracketSide =>
    "place" in ref
      ? side(places[ref.place - 1] ?? null, ref.label)
      : side(winners.get(ref.winnerOf) ?? null, ref.label);
  return {
    final: leagueDone,
    rounds: rounds.map((round) => ({
      stage: round.stage,
      matches: round.matches.map((m) => {
        const home = resolve(m.home);
        const away = resolve(m.away);
        const games =
          home.slot !== null || away.slot !== null
            ? find(round.stage, home.slot, away.slot)
            : [];
        const first = games[0] ?? null;
        const winner = seriesWinner(games, round.games ?? 1);
        winners.set(m.id, winner);
        return {
          stage: round.stage,
          // The drawn first game decides who's at home.
          home: first ? side(first.homeSlot, home.placeholder) : home,
          away: first ? side(first.awaySlot, away.placeholder) : away,
          fixture: first,
          games,
          winner,
        };
      }),
    })),
  };
}
