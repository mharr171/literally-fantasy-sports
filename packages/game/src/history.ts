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
