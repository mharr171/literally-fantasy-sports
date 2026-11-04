/**
 * Ghost teams (D8, D33, D59) and season stats for the leaderboard (D19).
 * When a season ends, the manager's team is frozen into a snapshot: its
 * players (as the match engine needs them), its matchday squad and its Elo.
 * Snapshots then appear as opponents in other managers' leagues.
 */
import type { Rng } from "@lfs/core";
import type { Attributes } from "./attributes";
import type { SoccerTeam } from "./match";
import {
  autoPickSquad,
  type MatchdaySquad,
  squadProblems,
  squadToTeam,
} from "./matchday";
import type { Position } from "./positions";
import {
  type LeagueSlot,
  MANAGER_SLOT,
  type SeasonFixture,
  table,
} from "./season-play";

/** A player as a ghost keeps them: what the engine and match reports need. */
export interface SnapshotPlayer {
  id: string;
  displayName: string;
  attributes: Attributes;
  primaryPosition: Position;
  secondaryPosition: Position | null;
  chemistryColor: number;
  overall: number;
  /** Template variant at the primary position (D84). */
  templateVariant?: string;
}

export interface GhostSnapshot {
  players: SnapshotPlayer[];
  squad: MatchdaySquad;
}

/**
 * Freezes a roster into a ghost. The saved matchday squad is kept when it's
 * still valid; otherwise the best 22 are picked so the ghost can always play.
 */
export function snapshotTeam(
  players: readonly SnapshotPlayer[],
  squad: MatchdaySquad | null,
): GhostSnapshot {
  const ids = new Set(players.map((p) => p.id));
  const usable =
    squad && squadProblems(squad, ids).length === 0
      ? squad
      : autoPickSquad(players, squad?.formation);
  return {
    players: players.map((p) => ({ ...p })),
    squad: { ...usable, subPlan: usable.subPlan.map((s) => ({ ...s })) },
  };
}

/**
 * A ghost as the engine plays it, with names for match reports. Its players
 * get ids of their own (prefixed with the ghost's id), so a manager can
 * play their own ghost without the same player appearing on both sides.
 */
export function ghostTeam(
  id: string,
  snapshot: GhostSnapshot,
): { team: SoccerTeam; names: Map<string, string> } {
  const key = (playerId: string) => `${id}:${playerId}`;
  const players = new Map(
    snapshot.players.map((p) => [key(p.id), { ...p, id: key(p.id) }]),
  );
  const squad: MatchdaySquad = {
    ...snapshot.squad,
    lineup: snapshot.squad.lineup.map(key),
    bench: snapshot.squad.bench.map(key),
    subPlan: snapshot.squad.subPlan.map((s) => ({
      ...s,
      outId: key(s.outId),
      inId: key(s.inId),
    })),
  };
  return {
    team: squadToTeam(id, squad, players),
    names: new Map([...players.values()].map((p) => [p.id, p.displayName])),
  };
}

export type PlayoffResult = "none" | "semi" | "final" | "champion";

/** A finished season's record for the leaderboard (D19). */
export interface SeasonStats {
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  scored: number;
  conceded: number;
  points: number;
  playoffs: PlayoffResult;
}

export function seasonStats(
  slots: readonly LeagueSlot[],
  fixtures: readonly SeasonFixture[],
  slot: number = MANAGER_SLOT,
): SeasonStats {
  const rows = table(slots, fixtures);
  const index = rows.findIndex((r) => Number(r.team) === slot);
  const row = rows[index];
  if (!row) throw new Error(`No team in slot ${slot}.`);
  const inStage = (stage: "semi" | "final") =>
    fixtures.some(
      (f) => f.stage === stage && (f.homeSlot === slot || f.awaySlot === slot),
    );
  const final = fixtures.find((f) => f.stage === "final" && f.winner !== null);
  const won =
    final !== undefined &&
    (final.winner === "home" ? final.homeSlot : final.awaySlot) === slot;
  return {
    position: index + 1,
    played: row.played,
    won: row.won,
    drawn: row.drawn,
    lost: row.lost,
    scored: row.scored,
    conceded: row.conceded,
    points: row.points,
    playoffs: won
      ? "champion"
      : inStage("final")
        ? "final"
        : inStage("semi")
          ? "semi"
          : "none",
  };
}

/** A ghost that could join a league. */
export interface GhostCandidate {
  id: string;
  /** The team the ghost came from: at most one ghost per team in a league (D33). */
  teamId: string;
  name: string;
  elo: number;
}

/** Ghost settings. Balance defaults: changed only with Gary's OK. */
export interface GhostSettings {
  /** Most ghosts in one league; AI teams fill the rest (D8). */
  maxGhosts: number;
  /** Only ghosts this close to the manager's Elo are considered. */
  eloWindow: number;
}

export const DEFAULT_GHOST_SETTINGS: GhostSettings = {
  maxGhosts: 4,
  eloWindow: 300,
};

/**
 * Picks the ghosts for a league: candidates within the Elo window, one per
 * team, chosen at random (seeded) up to the limit.
 */
export function pickGhosts(
  rng: Rng,
  managerElo: number,
  candidates: readonly GhostCandidate[],
  settings: GhostSettings = DEFAULT_GHOST_SETTINGS,
): GhostCandidate[] {
  const near = candidates.filter(
    (c) => Math.abs(c.elo - managerElo) <= settings.eloWindow,
  );
  const picked: GhostCandidate[] = [];
  const teams = new Set<string>();
  for (const c of rng.shuffle(near)) {
    if (picked.length >= settings.maxGhosts) break;
    if (teams.has(c.teamId)) continue;
    teams.add(c.teamId);
    picked.push(c);
  }
  return picked;
}
