/**
 * A baseball game's match page (ADR 0009 §9, D204): replayed from the
 * teams it was played with, the season's settings and its seed, so it
 * comes out exactly as it was played. Only the club's own games keep their
 * teams, and only the club's manager can open them; the season seed never
 * leaves the server.
 */

import { baseballConfigFor } from "./baseball-squad";
import { createServiceClient } from "./db";
import {
  type BaseballEvent,
  type BaseballTeam,
  type BoxScore,
  baseballGameSeed,
  boxScore,
  playText,
  replayGame,
  winProbabilityLine,
} from "./sports/baseball";

export interface BaseballMatch {
  week: number;
  stage: string;
  gameNo: number;
  homeSlot: number;
  awaySlot: number;
  homeName: string;
  awayName: string;
  events: BaseballEvent[];
  box: BoxScore;
  /** Each event's play-by-play line; null for pitches. */
  lines: (string | null)[];
  /** Every player's name, by id. */
  names: Record<string, string>;
  /** The home side's chance of winning before each plate appearance, then the result. */
  winProbability: number[];
}

/** Names on the players the stored teams carry, plus any kept beside them. */
function namesOf(
  teams: { home: BaseballTeam; away: BaseballTeam },
  kept: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {};
  const add = (p: unknown) => {
    const x = p as { id?: string; displayName?: string };
    if (x?.id && x.displayName) out[x.id] = x.displayName;
  };
  for (const t of [teams.home, teams.away]) {
    for (const b of t.batters) add(b.player);
    add(t.pitcher);
    for (const p of t.bullpen ?? []) add(p);
    for (const b of t.bench ?? []) add(b.player);
  }
  return { ...out, ...kept };
}

/** One of the club's own games, replayed; null if it isn't the club's or has no replay. */
export async function loadBaseballMatch(
  teamId: string,
  fixtureId: string,
): Promise<BaseballMatch | null> {
  const db = createServiceClient();
  const { data: f, error } = await db
    .from("fixtures")
    .select(
      "id, season_id, week, stage, game_no, home_slot, away_slot, home_score, away_score, manager_team",
    )
    .eq("id", fixtureId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!f?.manager_team || f.home_score === null) return null;
  const { data: season, error: seasonError } = await db
    .from("seasons")
    .select("seed, config_version, team_id, sport")
    .eq("id", f.season_id)
    .maybeSingle();
  if (seasonError) throw new Error(seasonError.message);
  // Only the club's own season, and only baseball.
  if (!season || season.team_id !== teamId || season.sport !== "baseball")
    return null;
  const { data: slots, error: slotsError } = await db
    .from("season_teams")
    .select("slot, name")
    .eq("season_id", f.season_id);
  if (slotsError) throw new Error(slotsError.message);
  const kept = f.manager_team as {
    teams: { home: BaseballTeam; away: BaseballTeam };
    names?: Record<string, string>;
  };
  const config = await baseballConfigFor(season.config_version);
  const output = replayGame(
    kept.teams,
    config,
    baseballGameSeed(season.seed, f.id),
    f.stage !== "league",
  );
  const names = namesOf(kept.teams, kept.names ?? {});
  const name = (id: string) => names[id] ?? "?";
  const slotName = (slot: number) =>
    (slots ?? []).find((s) => s.slot === slot)?.name ?? `Club ${slot}`;
  return {
    week: f.week,
    stage: f.stage,
    gameNo: f.game_no ?? 1,
    homeSlot: f.home_slot,
    awaySlot: f.away_slot,
    homeName: slotName(f.home_slot),
    awayName: slotName(f.away_slot),
    events: output.events,
    box: boxScore(output),
    lines: output.events.map((e) => playText(e, name)),
    names,
    winProbability: winProbabilityLine(
      output.events,
      output.result.winner === "home",
    ),
  };
}
