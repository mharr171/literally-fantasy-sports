/**
 * Seasons for every sport (D16, D18, D30, D32, D39): the fixture list,
 * the league table, the playoff bracket, payouts and the spread of AI
 * opponents' ratings. Sport-specific parts (how a rating becomes a team)
 * live in the sport packages.
 */

/** One match in the schedule. */
export interface Fixture {
  /** 1-based week number. */
  week: number;
  home: string;
  away: string;
}

/**
 * A round-robin schedule (circle method): every team plays every other team
 * once per round, home and away alternating between rounds. With an odd
 * number of teams one team rests each week. 8 teams and 2 rounds give 14
 * weeks of 4 matches (D16).
 */
export function roundRobin(teamIds: readonly string[], rounds = 2): Fixture[] {
  if (new Set(teamIds).size !== teamIds.length)
    throw new Error("Each team can only appear once.");
  if (teamIds.length < 2) return [];
  const BYE = "\u0000bye";
  const teams = teamIds.length % 2 === 0 ? [...teamIds] : [...teamIds, BYE];
  const n = teams.length;
  const weeksPerRound = n - 1;
  const fixtures: Fixture[] = [];
  let rotation = [...teams];
  for (let w = 0; w < weeksPerRound; w++) {
    for (let i = 0; i < n / 2; i++) {
      const a = rotation[i] as string;
      const b = rotation[n - 1 - i] as string;
      if (a === BYE || b === BYE) continue;
      // The fixed team alternates weekly; the rest alternate by pairing.
      // Each team gets 3–4 home games of 7, never 3 in a row.
      const flip = i === 0 ? w % 2 === 1 : i % 2 === 1;
      for (let r = 0; r < rounds; r++) {
        const swap = flip !== (r % 2 === 1);
        fixtures.push({
          // Odd rounds run in reverse, mirrored, so a team's last game of
          // one round and first of the next are at different grounds.
          week: r * weeksPerRound + (r % 2 === 1 ? weeksPerRound - w : w + 1),
          home: swap ? b : a,
          away: swap ? a : b,
        });
      }
    }
    // Keep the first team fixed and rotate the rest one place.
    rotation = [
      rotation[0] as string,
      rotation[n - 1] as string,
      ...rotation.slice(1, n - 1),
    ];
  }
  return fixtures.sort((x, y) => x.week - y.week);
}

/** A played match, as the table needs it. */
export interface PlayedMatch {
  home: string;
  away: string;
  homeScore: number;
  awayScore: number;
}

export interface PointsRule {
  win: number;
  draw: number;
  loss: number;
}

export const SOCCER_POINTS: PointsRule = { win: 3, draw: 1, loss: 0 };

export interface Standing {
  team: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  scored: number;
  conceded: number;
  difference: number;
  points: number;
}

/**
 * The league table: points, then goal difference, then goals scored, then
 * wins, then the order the teams were given in (stable and deterministic).
 */
export function leagueTable(
  teamIds: readonly string[],
  matches: readonly PlayedMatch[],
  points: PointsRule = SOCCER_POINTS,
): Standing[] {
  const rows = new Map<string, Standing>(
    teamIds.map((team) => [
      team,
      {
        team,
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        scored: 0,
        conceded: 0,
        difference: 0,
        points: 0,
      },
    ]),
  );
  const add = (team: string, scored: number, conceded: number) => {
    const row = rows.get(team);
    if (!row) throw new Error(`${team} isn't in this league.`);
    row.played++;
    row.scored += scored;
    row.conceded += conceded;
    row.difference = row.scored - row.conceded;
    if (scored > conceded) {
      row.won++;
      row.points += points.win;
    } else if (scored === conceded) {
      row.drawn++;
      row.points += points.draw;
    } else {
      row.lost++;
      row.points += points.loss;
    }
  };
  for (const m of matches) {
    add(m.home, m.homeScore, m.awayScore);
    add(m.away, m.awayScore, m.homeScore);
  }
  const order = new Map(teamIds.map((t, i) => [t, i]));
  return [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.difference - a.difference ||
      b.scored - a.scored ||
      b.won - a.won ||
      (order.get(a.team) as number) - (order.get(b.team) as number),
  );
}

/**
 * Playoff semi-finals for the top 4 (D30): 1st v 4th and 2nd v 3rd, single
 * matches, higher seed listed at home. The winners meet in the final.
 */
export function playoffSemis(table: readonly Standing[]): Fixture[] {
  if (table.length < 4) throw new Error("Playoffs need at least 4 teams.");
  const seed = (i: number) => (table[i] as Standing).team;
  return [
    { week: 1, home: seed(0), away: seed(3) },
    { week: 1, home: seed(1), away: seed(2) },
  ];
}

/** Funds paid for results (D14, D39). Balance defaults: changed only with Gary's OK. */
export interface PayoutSettings {
  perMatch: number;
  win: number;
  draw: number;
  /** Bonus for reaching the playoffs. */
  playoffs: number;
  /** Extra bonus for reaching the final. */
  final: number;
  /** Extra bonus for winning the final. */
  champion: number;
}

export const DEFAULT_PAYOUTS: PayoutSettings = {
  perMatch: 1_000,
  win: 500,
  draw: 200,
  playoffs: 2_000,
  final: 3_000,
  champion: 5_000,
};

/** Funds for playing one match (regular season or playoff). */
export function matchPayout(
  outcome: "win" | "draw" | "loss",
  settings: PayoutSettings = DEFAULT_PAYOUTS,
): number {
  return (
    settings.perMatch +
    (outcome === "win" ? settings.win : outcome === "draw" ? settings.draw : 0)
  );
}

/** Bonus for how far a team got in the playoffs. */
export function playoffBonus(
  reached: "none" | "semi" | "final" | "champion",
  settings: PayoutSettings = DEFAULT_PAYOUTS,
): number {
  if (reached === "none") return 0;
  let bonus = settings.playoffs;
  if (reached === "final" || reached === "champion") bonus += settings.final;
  if (reached === "champion") bonus += settings.champion;
  return bonus;
}

/**
 * Ratings for the AI teams in a league (D32): evenly spread from `spread`
 * below the manager's rating to `spread` above it.
 */
export function aiOpponentRatings(
  managerRating: number,
  count: number,
  spread = 300,
): number[] {
  if (count <= 0) return [];
  if (count === 1) return [Math.round(managerRating)];
  return Array.from({ length: count }, (_, i) =>
    Math.round(managerRating - spread + (2 * spread * i) / (count - 1)),
  );
}
