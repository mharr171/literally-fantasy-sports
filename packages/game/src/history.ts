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
