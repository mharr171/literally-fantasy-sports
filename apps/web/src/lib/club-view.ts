import "server-only";
import {
  type Attributes,
  aiTeam,
  MANAGER_SLOT,
  type MatchdaySquad,
  type Position,
  type SnapshotPlayer,
} from "@lfs/sport-soccer";
import { loadLatestSeason } from "./season";
import { createServiceClient } from "./supabase/service";
import { loadMyTeam, loadRoster, loadSquad, SOCCER } from "./team";

/**
 * What another manager may see of a player (D111): no hidden potential, no
 * shown range either (that's the owner's scouting), no condition.
 */
export interface ClubPlayer {
  id: string;
  displayName: string;
  primaryPosition: Position;
  secondaryPosition: Position | null;
  overall: number;
  chemistryColor: number;
  /**
   * For working out the squad score on the server. Club pages are server
   * components, so this never reaches the browser.
   */
  attributes: Attributes;
}

export interface ClubView {
  name: string;
  kind: "manager" | "ai" | "ghost";
  /** Club colors; null shows colors worked out from the name (D107). */
  colors: string[] | null;
  elo: number | null;
  players: ClubPlayer[];
  squad: MatchdaySquad | null;
  /** E.g. "Season 3" for a leaderboard entry. */
  subtitle?: string;
}

const pick = (p: {
  id: string;
  displayName: string;
  primaryPosition: Position;
  secondaryPosition: Position | null;
  overall: number;
  chemistryColor: number;
  attributes: Attributes;
}): ClubPlayer => ({
  id: p.id,
  displayName: p.displayName,
  primaryPosition: p.primaryPosition,
  secondaryPosition: p.secondaryPosition,
  overall: p.overall,
  chemistryColor: p.chemistryColor,
  attributes: p.attributes,
});

/**
 * A club in the manager's latest season, by league slot, as it plays there:
 * the manager's own squad, an AI club rebuilt from the season, or a ghost's
 * frozen snapshot. Null when there's no such club.
 */
export async function loadLeagueClub(
  ownerId: string,
  slot: number,
): Promise<ClubView | null> {
  const team = await loadMyTeam(ownerId);
  if (!team) return null;
  const season = await loadLatestSeason(team.id);
  const info = season?.slots.find((s) => s.slot === slot);
  if (!season || !info) return null;
  if (slot === MANAGER_SLOT) {
    const [roster, squad] = await Promise.all([
      loadRoster(team.id),
      loadSquad(team.id),
    ]);
    return {
      name: team.name,
      kind: "manager",
      colors: team.colors,
      elo: team.elo,
      players: roster.map(pick),
      squad,
    };
  }
  if (info.kind === "ghost" && info.ghostId) {
    const { data, error } = await createServiceClient()
      .from("team_snapshots")
      .select("players, squad")
      .eq("id", info.ghostId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (data)
      return {
        name: info.name,
        kind: "ghost",
        // The league may show a ghost under another name, so its real
        // colors stay out of it.
        colors: null,
        elo: info.elo,
        players: (data.players as SnapshotPlayer[]).map(pick),
        squad: data.squad as MatchdaySquad,
      };
  }
  // An AI club, or a ghost whose snapshot is gone (it plays as AI).
  const ai = aiTeam(season.seed, slot, info.startRating);
  return {
    name: info.name,
    kind: "ai",
    colors: null,
    elo: info.elo,
    players: ai.players.map(pick),
    squad: ai.squad,
  };
}

/** A finished season from the leaderboard, as it finished (D111). */
export async function loadSnapshotClub(id: string): Promise<ClubView | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("team_snapshots")
    .select("team_id, team_name, season_number, elo, players, squad")
    .eq("id", id)
    .eq("sport", SOCCER)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  const { data: team } = await db
    .from("teams")
    .select("colors")
    .eq("id", data.team_id)
    .maybeSingle();
  return {
    name: data.team_name as string,
    kind: "ghost",
    colors: (team?.colors as string[] | null) ?? null,
    elo: data.elo as number,
    players: (data.players as SnapshotPlayer[]).map(pick),
    squad: data.squad as MatchdaySquad,
    subtitle: `Season ${data.season_number as number}, as it finished`,
  };
}
