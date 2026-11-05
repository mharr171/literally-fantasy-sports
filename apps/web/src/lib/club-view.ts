import "server-only";
import {
  type Attributes,
  aiTeam,
  MANAGER_SLOT,
  type MatchdaySquad,
  type Position,
  type SnapshotPlayer,
  SOCCER_COLOR_CYCLE,
} from "@lfs/sport-soccer";
import { ensureFormations } from "./formations";
import { configFor, loadClones, loadLatestSeason } from "./season";
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
  /** Only loaded for an admin with the admin view on (D163). */
  admin?: ClubAdmin;
}

/** Where a club comes from, for admins (D163). */
export interface ClubOrigin {
  /** "Real club" or "AI club", or how a league club was made. */
  label: string;
  real: boolean;
  detail: string | null;
}

/** A player's hidden values, for admins (D163). */
export interface AdminPlayer {
  age: number;
  potential: number;
  range: [number, number];
  worth: number | null;
  fitness: number | null;
}

export interface ClubAdmin {
  origin: ClubOrigin;
  startRating: number | null;
  /** True when the player values are today's, not as the copy was made. */
  live: boolean;
  players: Record<string, AdminPlayer>;
}

const titleCase = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Real or AI, the manager, and the live Elo of each club (D163). */
export async function loadClubOrigins(
  teamIds: readonly string[],
): Promise<Map<string, ClubOrigin>> {
  const out = new Map<string, ClubOrigin>();
  const ids = [...new Set(teamIds)];
  if (ids.length === 0) return out;
  const db = createServiceClient();
  const { data: teams, error } = await db
    .from("teams")
    .select("id, kind, owner_id, manager_name, ai, elo")
    .in("id", ids);
  if (error) throw new Error(error.message);
  const owners = (teams ?? []).flatMap((t) =>
    t.owner_id ? [t.owner_id as string] : [],
  );
  const names = new Map<string, string>();
  if (owners.length > 0) {
    const { data: profiles, error: pError } = await db
      .from("profiles")
      .select("id, display_name")
      .in("id", owners);
    if (pError) throw new Error(pError.message);
    for (const p of profiles ?? [])
      names.set(p.id as string, (p.display_name as string | null) ?? "?");
  }
  for (const t of teams ?? []) {
    if (t.kind === "ai") {
      const ai = (t.ai ?? {}) as Partial<{
        personality: string;
        pace: string;
        formation: string;
      }>;
      out.set(t.id as string, {
        label: "AI club",
        real: false,
        detail: `Manager ${t.manager_name as string} · ${titleCase(ai.personality ?? "?")}, ${ai.pace ?? "?"} pace, ${ai.formation ?? "?"} · Elo now ${t.elo as number}`,
      });
    } else {
      out.set(t.id as string, {
        label: "Real club",
        real: true,
        detail: `Manager ${names.get(t.owner_id as string) ?? "?"} · Elo now ${t.elo as number}`,
      });
    }
  }
  return out;
}

/** Players' hidden values as they are now (D163). */
async function loadAdminPlayers(
  ids: readonly string[],
): Promise<Record<string, AdminPlayer>> {
  const out: Record<string, AdminPlayer> = {};
  if (ids.length === 0) return out;
  const { data, error } = await createServiceClient()
    .from("players")
    .select("id, age, potential, potential_low, potential_high, worth, fitness")
    .in("id", [...ids]);
  if (error) throw new Error(error.message);
  for (const p of data ?? [])
    out[p.id as string] = {
      age: p.age as number,
      potential: p.potential as number,
      range: [p.potential_low as number, p.potential_high as number],
      worth: p.worth as number,
      fitness: p.fitness as number,
    };
  return out;
}

const GONE: ClubOrigin = {
  label: "Club deleted",
  real: false,
  detail: "The club this copy came from no longer exists.",
};

/** A copied club's origin and its players' values today (D163). */
async function adminFor(
  sourceTeamId: string | null,
  playerIds: readonly string[],
  startRating: number | null,
): Promise<ClubAdmin> {
  const [origins, players] = await Promise.all([
    loadClubOrigins(sourceTeamId ? [sourceTeamId] : []),
    loadAdminPlayers(playerIds),
  ]);
  return {
    origin: (sourceTeamId && origins.get(sourceTeamId)) || GONE,
    startRating,
    live: true,
    players,
  };
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
 * the manager's own squad, an AI club rebuilt from the season, or the
 * league's frozen copy of a ghost. Null when there's no such club.
 */
export async function loadLeagueClub(
  ownerId: string,
  slot: number,
  { admin = false }: { admin?: boolean } = {},
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
      admin: admin
        ? await adminFor(
            team.id,
            roster.map((p) => p.id),
            info.startRating,
          )
        : undefined,
    };
  }
  if (info.kind === "ghost") {
    const clone = (await loadClones(season.id)).get(slot);
    if (clone)
      return {
        name: info.name,
        kind: "ghost",
        colors: info.colors.length > 0 ? info.colors : null,
        elo: info.elo,
        players: clone.players.map(pick),
        squad: clone.squad,
        admin: admin
          ? await adminFor(
              info.ghostId ?? null,
              clone.players.map((p) => p.id),
              info.startRating,
            )
          : undefined,
      };
  }
  // An AI club, or a ghost whose copy is gone (it plays as AI).
  const ai = aiTeam(season.seed, slot, info.startRating);
  return {
    name: info.name,
    kind: "ai",
    colors: null,
    elo: info.elo,
    players: ai.players.map(pick),
    squad: ai.squad,
    admin: admin
      ? {
          origin: {
            label:
              info.kind === "ghost"
                ? "Copy gone, plays as AI"
                : "AI, made for this league",
            real: false,
            detail: "Generated from the season seed; not a club in the game.",
          },
          startRating: info.startRating,
          live: false,
          players: Object.fromEntries(
            ai.players.map((p) => [
              p.id,
              {
                age: p.age,
                potential: p.potential,
                range: p.potentialRange,
                worth: null,
                fitness: null,
              },
            ]),
          ),
        }
      : undefined,
  };
}

/** A club's ghost from the leaderboard: its best season, as it finished (D111, D116). */
export async function loadGhostClub(
  teamId: string,
  { admin = false }: { admin?: boolean } = {},
): Promise<ClubView | null> {
  const db = createServiceClient();
  const { data, error } = await db
    .from("ghosts")
    .select("team_id, team_name, season_number, elo, players, squad")
    .eq("team_id", teamId)
    .eq("sport", SOCCER)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) return null;
  await ensureFormations([(data.squad as MatchdaySquad | null)?.formation]);
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
    subtitle: `Season ${data.season_number as number}, its best, as it finished`,
    admin: admin
      ? await adminFor(
          teamId,
          (data.players as SnapshotPlayer[]).map((p) => p.id),
          null,
        )
      : undefined,
  };
}

/** One of the club's fixtures, with the opponent's colors (D139). */
export interface ScheduleRow {
  id: string;
  week: number;
  stage: string;
  home: boolean;
  opponent: { slot: number; name: string; colors: string[] | null };
  /** The opponent's starting 11 colors, from the league's frozen copy. */
  opponentStarters: { chemistryColor: number }[];
  /** Goals for and against, once played. */
  result: { for: number; against: number; won: boolean | null } | null;
}

export interface Schedule {
  seasonNumber: number;
  /** The color cycle the season plays by (D149). */
  cycle: readonly number[];
  week: number;
  /** The club's starting 11 colors as its squad is saved now. */
  myStarters: { chemistryColor: number }[];
  rows: ScheduleRow[];
}

/**
 * Every fixture of the club's latest season with each opponent's starting
 * colors (D139). Leagues are frozen copies (D115), so these stay right all
 * season. Playoff fixtures appear once they're drawn.
 */
export async function loadSchedule(ownerId: string): Promise<Schedule | null> {
  const team = await loadMyTeam(ownerId);
  if (!team) return null;
  const season = await loadLatestSeason(team.id);
  if (!season) return null;
  const [roster, squad, clones] = await Promise.all([
    loadRoster(team.id),
    loadSquad(team.id),
    loadClones(season.id),
  ]);
  const colorsOf = (
    players: readonly { id: string; chemistryColor: number }[],
    lineup: readonly string[],
  ) => {
    const byId = new Map(players.map((p) => [p.id, p]));
    return lineup.flatMap((id) => {
      const p = byId.get(id);
      return p ? [{ chemistryColor: p.chemistryColor }] : [];
    });
  };
  const starters = new Map<number, { chemistryColor: number }[]>();
  const startersOf = (slot: number) => {
    const cached = starters.get(slot);
    if (cached) return cached;
    const info = season.slots.find((s) => s.slot === slot);
    const clone = clones.get(slot);
    const result = clone
      ? colorsOf(clone.players, clone.squad.lineup)
      : info
        ? (() => {
            const ai = aiTeam(season.seed, slot, info.startRating);
            return colorsOf(ai.players, ai.squad.lineup);
          })()
        : [];
    starters.set(slot, result);
    return result;
  };
  const rows = season.fixtures
    .filter((f) => f.homeSlot === MANAGER_SLOT || f.awaySlot === MANAGER_SLOT)
    .sort((a, b) => a.week - b.week)
    .map((f): ScheduleRow => {
      const home = f.homeSlot === MANAGER_SLOT;
      const slot = home ? f.awaySlot : f.homeSlot;
      const info = season.slots.find((s) => s.slot === slot);
      const played = f.homeScore !== null && f.awayScore !== null;
      const goalsFor = (home ? f.homeScore : f.awayScore) ?? 0;
      const goalsAgainst = (home ? f.awayScore : f.homeScore) ?? 0;
      const winnerMine =
        f.winner === null ? null : f.winner === (home ? "home" : "away");
      return {
        id: f.id,
        week: f.week,
        stage: f.stage,
        home,
        opponent: {
          slot,
          name: info?.name ?? "Unknown",
          colors: info && info.colors.length > 0 ? info.colors : null,
        },
        opponentStarters: startersOf(slot),
        result: played
          ? {
              for: goalsFor,
              against: goalsAgainst,
              won:
                goalsFor !== goalsAgainst
                  ? goalsFor > goalsAgainst
                  : winnerMine,
            }
          : null,
      };
    });
  const { config } = await configFor(season.configVersion);
  return {
    seasonNumber: season.number,
    cycle: config.tuning.colorCycle ?? SOCCER_COLOR_CYCLE,
    week: season.week,
    myStarters: squad ? colorsOf(roster, squad.lineup) : [],
    rows,
  };
}
