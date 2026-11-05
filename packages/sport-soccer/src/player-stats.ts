/**
 * Player stats (D143): career totals of games, wins, draws and losses,
 * goals, assists, tackles and saves. Only a club's own matches count, never
 * its copies in other clubs' leagues.
 */
import type { TeamResult } from "./form";
import type { PlayerMatchReport } from "./match";

export interface PlayerStats {
  games: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  assists: number;
  tackles: number;
  saves: number;
}

export const NO_STATS: PlayerStats = {
  games: 0,
  wins: 0,
  draws: 0,
  losses: 0,
  goals: 0,
  assists: 0,
  tackles: 0,
  saves: 0,
};

/**
 * What one match adds to a player's totals. A player who didn't get on the
 * pitch adds nothing. A shoot-out counts for the team that won it.
 */
export function matchStats(
  report: PlayerMatchReport | undefined,
  result: TeamResult | null,
): PlayerStats {
  if (!report || report.minutes <= 0 || !result) return { ...NO_STATS };
  return {
    games: 1,
    wins: result === "win" ? 1 : 0,
    draws: result === "draw" ? 1 : 0,
    losses: result === "loss" ? 1 : 0,
    goals: report.goals,
    assists: report.assists,
    tackles: report.tackles,
    saves: report.saves,
  };
}

/**
 * Share of games won, as a whole percentage; null before the first. Games
 * played before D143 have no result kept, so this counts only the games
 * with one (wins + draws + losses), not every appearance.
 */
export function winPercent(
  stats: Pick<PlayerStats, "wins" | "draws" | "losses">,
): number | null {
  const decided = stats.wins + stats.draws + stats.losses;
  return decided > 0 ? Math.round((stats.wins / decided) * 100) : null;
}
