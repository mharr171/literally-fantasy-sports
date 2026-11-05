/**
 * The global hall of fame (D121, ADR 0005): the clubs and players of all
 * time across the game, shown by club name only. Public, like the
 * leaderboard.
 */
import { createServiceClient } from "./db";

const SOCCER = "soccer";
export const HALL_SIZE = 25;

export interface HallClub {
  teamId: string;
  name: string;
  colors: string[] | null;
  /** Its best season is on the leaderboard (a ghost), so it can link there. */
  hasGhost: boolean;
  value: number;
}

export const PLAYER_LISTS = [
  { key: "goals", label: "Goals", column: "stat_goals" },
  { key: "assists", label: "Assists", column: "assists" },
  { key: "tackles", label: "Tackles", column: "tackles" },
  { key: "saves", label: "Saves", column: "saves" },
  { key: "games", label: "Games", column: "stat_games" },
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
async function topPlayers(column: string): Promise<HallPlayer[]> {
  const db = createServiceClient();
  const [current, retired] = await Promise.all([
    db
      .from("players")
      .select(
        `id, display_name, primary_position, team_id, ${column}, teams(name)`,
      )
      .eq("sport", SOCCER)
      .gt(column, 0)
      .order(column, { ascending: false, nullsFirst: false })
      .limit(HALL_SIZE),
    db
      .from("player_careers")
      .select(`id, display_name, primary_position, team_id, clubs, ${column}`)
      .eq("sport", SOCCER)
      .gt(column, 0)
      .order(column, { ascending: false, nullsFirst: false })
      .limit(HALL_SIZE),
  ]);
  if (current.error) throw new Error(current.error.message);
  if (retired.error) throw new Error(retired.error.message);
  const rows = (x: unknown) => (x ?? []) as Record<string, unknown>[];
  const teamName = (t: unknown) =>
    ((Array.isArray(t) ? t[0] : t) as { name?: string } | null)?.name ?? "?";
  return [
    ...rows(current.data).map((p) => ({
      id: p.id as string,
      name: p.display_name as string,
      position: p.primary_position as string,
      club: teamName(p.teams),
      teamId: p.team_id as string,
      retired: false,
      value: p[column] as number,
    })),
    ...rows(retired.data).map((p) => ({
      id: p.id as string,
      name: p.display_name as string,
      position: p.primary_position as string,
      club: ((p.clubs as string[] | null) ?? []).at(-1) ?? "?",
      teamId: (p.team_id as string | null) ?? null,
      retired: true,
      value: p[column] as number,
    })),
  ]
    .sort((a, b) => b.value - a.value || a.name.localeCompare(b.name))
    .slice(0, HALL_SIZE);
}

export async function loadGlobalHallOfFame(): Promise<GlobalHallOfFame> {
  const [clubs, ...lists] = await Promise.all([
    createServiceClient().rpc("hall_of_fame_clubs", {
      p_sport: SOCCER,
      p_limit: HALL_SIZE,
    }),
    ...PLAYER_LISTS.map((l) => topPlayers(l.column)),
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
