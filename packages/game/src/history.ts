/**
 * Season history (D121, ADR 0005): every season a club has played, from its
 * permanent one-line records (D120), and what a past season's page shows.
 */
import { MANAGER_SLOT } from "@lfs/sport-soccer";
import { createServiceClient } from "./db";
import type { LoadedSeason } from "./season";

export type Playoffs = "champion" | "final" | "semi" | "quarter" | "none";

export interface SeasonLine {
  seasonNumber: number;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  scored: number;
  conceded: number;
  points: number;
  eloBefore: number;
  eloAfter: number;
  playoffs: Playoffs;
}

/** The club's finished seasons, newest first. */
export async function loadClubHistory(teamId: string): Promise<SeasonLine[]> {
  const { data, error } = await createServiceClient()
    .from("season_records")
    .select(
      "season_number, position, played, won, drawn, lost, scored, conceded, points, elo_before, elo_after, playoffs",
    )
    .eq("team_id", teamId)
    .order("season_number", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map((r) => ({
    seasonNumber: r.season_number as number,
    position: r.position as number,
    played: r.played as number,
    won: r.won as number,
    drawn: r.drawn as number,
    lost: r.lost as number,
    scored: r.scored as number,
    conceded: r.conceded as number,
    points: r.points as number,
    eloBefore: r.elo_before as number,
    eloAfter: r.elo_after as number,
    playoffs: r.playoffs as Playoffs,
  }));
}

/**
 * The club's scorers in one season, most goals first, counted from the goal
 * events of its own matches' summaries (ADR 0005).
 */
export function seasonScorers(
  season: Pick<LoadedSeason, "fixtures">,
): { name: string; goals: number }[] {
  const goals = new Map<string, number>();
  for (const f of season.fixtures) {
    const side =
      f.homeSlot === MANAGER_SLOT
        ? "home"
        : f.awaySlot === MANAGER_SLOT
          ? "away"
          : null;
    if (!side || !f.summary) continue;
    for (const e of f.summary.events)
      if (e.type === "goal" && e.side === side)
        goals.set(e.player, (goals.get(e.player) ?? 0) + 1);
  }
  return [...goals]
    .map(([name, n]) => ({ name, goals: n }))
    .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));
}

/** A retired player's career, for their tribute (D121, ADR 0005). */
export interface Tribute {
  id: string;
  name: string;
  position: string;
  age: number;
  seasons: number;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  assists: number;
  tackles: number;
  saves: number;
  bestOverall: number;
  retiredSeason: number;
}

const tribute = (r: Record<string, unknown>): Tribute => ({
  id: r.id as string,
  name: r.display_name as string,
  position: r.primary_position as string,
  age: r.retired_age as number,
  seasons: r.seasons as number,
  games: r.stat_games as number,
  wins: r.wins as number,
  draws: r.draws as number,
  losses: r.losses as number,
  goals: r.stat_goals as number,
  assists: r.assists as number,
  tackles: r.tackles as number,
  saves: r.saves as number,
  bestOverall: r.best_overall as number,
  retiredSeason: r.retired_season as number,
});

const TRIBUTE_COLUMNS =
  "id, display_name, primary_position, retired_age, seasons, stat_games, wins, draws, losses, stat_goals, assists, tackles, saves, best_overall, retired_season";

/**
 * Careers of the club's players who retired at the end of a season, or of
 * every season when `seasonNumber` is left out, newest first.
 */
export async function loadTributes(
  teamId: string,
  seasonNumber?: number,
): Promise<Tribute[]> {
  let q = createServiceClient()
    .from("player_careers")
    .select(TRIBUTE_COLUMNS)
    .eq("team_id", teamId);
  if (seasonNumber !== undefined) q = q.eq("retired_season", seasonNumber);
  const { data, error } = await q
    .order("retired_season", { ascending: false })
    .order("best_overall", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(tribute);
}

/** The lists in a club's hall of fame (ADR 0005). */
export const GREAT_LISTS = [
  { key: "games", label: "Games" },
  { key: "goals", label: "Goals" },
  { key: "assists", label: "Assists" },
  { key: "tackles", label: "Tackles" },
  { key: "saves", label: "Saves" },
  { key: "bestOverall", label: "Best overall" },
] as const;

export type GreatKey = (typeof GREAT_LISTS)[number]["key"];

/** A current or retired player as the hall of fame ranks them. */
export interface Great {
  id: string;
  name: string;
  position: string;
  seasons: number;
  retired: boolean;
  games: number;
  goals: number;
  assists: number;
  tackles: number;
  saves: number;
  bestOverall: number;
}

/**
 * The top `size` in each list (ADR 0005), most first; ties go to fewer
 * games, then by name. Nobody with 0 makes a list.
 */
export function rankGreats(
  people: readonly Great[],
  size = 10,
): Record<GreatKey, Great[]> {
  const out = {} as Record<GreatKey, Great[]>;
  for (const { key } of GREAT_LISTS)
    out[key] = people
      .filter((p) => p[key] > 0)
      .sort(
        (a, b) =>
          b[key] - a[key] || a.games - b.games || a.name.localeCompare(b.name),
      )
      .slice(0, size);
  return out;
}

export interface Honours {
  titles: number;
  finals: number;
  bestFinish: number | null;
  highestElo: number | null;
  /** League matches in a row without a defeat, across seasons. */
  unbeatenRun: number;
}

/** Titles, finals, best finish and highest Elo from the season lines. */
export function honoursFrom(
  lines: readonly SeasonLine[],
  unbeatenRun: number,
): Honours {
  return {
    titles: lines.filter((l) => l.playoffs === "champion").length,
    finals: lines.filter(
      (l) => l.playoffs === "champion" || l.playoffs === "final",
    ).length,
    bestFinish: lines.length ? Math.min(...lines.map((l) => l.position)) : null,
    highestElo: lines.length ? Math.max(...lines.map((l) => l.eloAfter)) : null,
    unbeatenRun,
  };
}

/** The longest run of results without a defeat, in the order given. */
export function longestUnbeaten(results: readonly ("w" | "d" | "l")[]): number {
  let best = 0;
  let run = 0;
  for (const r of results) {
    run = r === "l" ? 0 : run + 1;
    best = Math.max(best, run);
  }
  return best;
}

/** The club's league results in order, oldest first, for its unbeaten run. */
async function leagueResults(teamId: string): Promise<("w" | "d" | "l")[]> {
  const db = createServiceClient();
  const { data: seasons, error } = await db
    .from("seasons")
    .select("id, number")
    .eq("team_id", teamId);
  if (error) throw new Error(error.message);
  if (!seasons?.length) return [];
  const order = new Map(
    seasons.map((s) => [s.id as string, s.number as number]),
  );
  const { data: fixtures, error: fError } = await db
    .from("fixtures")
    .select("season_id, week, home_slot, away_slot, home_score, away_score")
    .in("season_id", [...order.keys()])
    .eq("stage", "league")
    .or(`home_slot.eq.${MANAGER_SLOT},away_slot.eq.${MANAGER_SLOT}`)
    .not("home_score", "is", null);
  if (fError) throw new Error(fError.message);
  return (fixtures ?? [])
    .sort(
      (a, b) =>
        (order.get(a.season_id as string) ?? 0) -
          (order.get(b.season_id as string) ?? 0) ||
        (a.week as number) - (b.week as number),
    )
    .map((f) => {
      const home = f.home_slot === MANAGER_SLOT;
      const mine = (home ? f.home_score : f.away_score) as number;
      const theirs = (home ? f.away_score : f.home_score) as number;
      return mine > theirs ? "w" : mine === theirs ? "d" : "l";
    });
}

export interface ClubHallOfFame {
  greats: Record<GreatKey, Great[]>;
  /** Ids of everyone on any list, to mark them on tributes. */
  greatIds: string[];
  honours: Honours;
  retired: Tribute[];
}

/** A club's all-time greats, honours and retired players (ADR 0005). */
export async function loadClubHallOfFame(
  teamId: string,
): Promise<ClubHallOfFame> {
  const db = createServiceClient();
  const [players, retired, lines, results] = await Promise.all([
    db
      .from("players")
      .select(
        "id, display_name, primary_position, seasons, stat_games, stat_goals, assists, tackles, saves, best_overall, overall",
      )
      .eq("team_id", teamId),
    loadTributes(teamId),
    loadClubHistory(teamId),
    leagueResults(teamId),
  ]);
  if (players.error) throw new Error(players.error.message);
  const people: Great[] = [
    ...(players.data ?? []).map((p) => ({
      id: p.id as string,
      name: p.display_name as string,
      position: p.primary_position as string,
      seasons: p.seasons as number,
      retired: false,
      games: p.stat_games as number,
      goals: p.stat_goals as number,
      assists: p.assists as number,
      tackles: p.tackles as number,
      saves: p.saves as number,
      bestOverall: Math.max(
        (p.best_overall as number | null) ?? 0,
        p.overall as number,
      ),
    })),
    ...retired.map((t) => ({
      id: t.id,
      name: t.name,
      position: t.position,
      seasons: t.seasons,
      retired: true,
      games: t.games,
      goals: t.goals,
      assists: t.assists,
      tackles: t.tackles,
      saves: t.saves,
      bestOverall: t.bestOverall,
    })),
  ];
  const greats = rankGreats(people);
  return {
    greats,
    greatIds: [
      ...new Set(Object.values(greats).flatMap((l) => l.map((g) => g.id))),
    ],
    honours: honoursFrom(lines, longestUnbeaten(results)),
    retired,
  };
}
