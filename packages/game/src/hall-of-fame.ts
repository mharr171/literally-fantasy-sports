/**
 * The global hall of fame (D121, ADR 0005): the clubs and players of all
 * time across the game, shown by club name only. Public, like the
 * leaderboard.
 */
import { createServiceClient } from "./db";

import { SOCCER } from "./sports";
export const HALL_SIZE = 25;

export interface HallClub {
  teamId: string;
  name: string;
  colors: string[] | null;
  /** Its best season is on the leaderboard (a ghost), so it can link there. */
  hasGhost: boolean;
  value: number;
}

/** The player lists, by stat key (ADR 0007 §2). */
export const PLAYER_LISTS = [
  { key: "goals", label: "Goals" },
  { key: "assists", label: "Assists" },
  { key: "tackles", label: "Tackles" },
  { key: "saves", label: "Saves" },
  { key: "games", label: "Games" },
] as const;

export type PlayerListKey = (typeof PLAYER_LISTS)[number]["key"];

export interface HallPlayer {
  id: string;
  name: string;
  position: string;
  club: string;
  /** The club's id while it exists, for admin labels. */
  teamId: string | null;
  retired: boolean;
  value: number;
}

export interface GlobalHallOfFame {
  clubs: { titles: HallClub[]; elo: HallClub[]; seasons: HallClub[] };
  players: Record<PlayerListKey, HallPlayer[]>;
}

const club = (r: Record<string, unknown>): HallClub => ({
  teamId: r.team_id as string,
  name: r.name as string,
  colors: (r.colors as string[] | null)?.length ? (r.colors as string[]) : null,
  hasGhost: r.has_ghost === true,
  value: r.value as number,
});

/** The top players of all time in one list, current and retired together. */
async function topPlayers(stat: string): Promise<HallPlayer[]> {
  const { data, error } = await createServiceClient().rpc(
    "hall_of_fame_players",
    { p_sport: SOCCER, p_stat: stat, p_limit: HALL_SIZE },
  );
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((p) => ({
    id: p.id as string,
    name: p.name as string,
    position: p.position as string,
    club: (p.club as string | null) ?? "?",
    teamId: (p.team_id as string | null) ?? null,
    retired: p.retired === true,
    value: p.value as number,
  }));
}

export async function loadGlobalHallOfFame(): Promise<GlobalHallOfFame> {
  const [clubs, ...lists] = await Promise.all([
    createServiceClient().rpc("hall_of_fame_clubs", {
      p_sport: SOCCER,
      p_limit: HALL_SIZE,
    }),
    ...PLAYER_LISTS.map((l) => topPlayers(l.key)),
  ]);
  if (clubs.error) throw new Error(clubs.error.message);
  const c = (clubs.data ?? {}) as Record<string, Record<string, unknown>[]>;
  return {
    clubs: {
      titles: (c.titles ?? []).map(club),
      elo: (c.elo ?? []).map(club),
      seasons: (c.seasons ?? []).map(club),
    },
    players: Object.fromEntries(
      PLAYER_LISTS.map((l, i) => [l.key, lists[i] ?? []]),
    ) as Record<PlayerListKey, HallPlayer[]>,
  };
}
