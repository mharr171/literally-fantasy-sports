/**
 * A club's season steps (ADR 0002): start a season, end it, take youth.
 * The same code runs for a manager pressing a button and for an AI club.
 * Callers check who is acting first; these check the game rules.
 */
import { playerWorth } from "@lfs/core";
import {
  DEFAULT_GHOST_SETTINGS,
  endOfSeason,
  FRESH,
  newLeague,
  type PlayerCondition,
  seasonReset,
  seasonStats,
  snapshotTeam,
  youthIntake,
} from "@lfs/sport-soccer";
import { createServiceClient } from "./db";
import { readyToPlay } from "./play-week";
import { playerRow } from "./scouting";
import {
  liveGenerationSettings,
  liveSoccerConfig,
  loadGhostCandidates,
  loadLatestSeason,
} from "./season";
import { loadAgingPlayers, loadRoster, loadSquad, type MyTeam } from "./team";

/** Starts the club's next season: a league around its Elo (D16, D32). */
export async function startSeasonFor(teamIn: MyTeam): Promise<void> {
  const { team } = await readyToPlay(teamIn);
  const latest = await loadLatestSeason(team.id);
  if (latest && latest.status !== "finished")
    throw new Error("Your season is already under way.");
  if (latest && !(latest.closed && latest.intakeResolved))
    throw new Error("Wrap up last season first: season end and youth intake.");
  const seed = crypto.randomUUID();
  const { label } = await liveSoccerConfig();
  const ghosts = await loadGhostCandidates(
    team.elo,
    DEFAULT_GHOST_SETTINGS.eloWindow,
  );
  const league = newLeague(
    seed,
    { name: team.name, elo: team.elo, teamId: team.id },
    ghosts,
  );
  const { error } = await createServiceClient().rpc("start_season", {
    p_team: team.id,
    p_seed: seed,
    p_config_version: label,
    p_slots: league.slots.map((s) => ({
      slot: s.slot,
      kind: s.kind,
      name: s.name,
      start_rating: s.startRating,
      snapshot_id: s.ghostId ?? null,
    })),
    p_fixtures: league.fixtures.map((f) => ({
      week: f.week,
      stage: f.stage,
      home_slot: f.homeSlot,
      away_slot: f.awaySlot,
    })),
  });
  if (error) {
    if (error.message.includes("already in progress"))
      throw new Error("Your season is already under way.");
    if (error.message.includes("not wrapped up"))
      throw new Error(
        "Wrap up last season first: season end and youth intake.",
      );
    throw new Error(error.message);
  }
}

/**
 * Season end (D35): every player ages a year, young ones grow, older ones
 * decline and some retire. Worked out from the season's seed, so it can
 * only ever come out one way.
 */
export async function endSeasonFor(team: MyTeam): Promise<void> {
  const season = await loadLatestSeason(team.id);
  if (!season || season.status !== "finished")
    throw new Error("Finish the season first.");
  if (season.closed) throw new Error("This season is already wrapped up.");
  const [players, roster, squad] = await Promise.all([
    loadAgingPlayers(team.id),
    loadRoster(team.id),
    loadSquad(team.id),
  ]);
  // Freeze the team as it finished the season: its ghost and leaderboard entry (D59).
  const ghost = snapshotTeam(
    roster.map((p) => ({
      id: p.id,
      displayName: p.displayName,
      attributes: p.attributes,
      primaryPosition: p.primaryPosition,
      secondaryPosition: p.secondaryPosition,
      chemistryColor: p.chemistryColor,
      overall: p.overall,
      templateVariant: p.templateVariant,
    })),
    squad,
  );
  const snapshot = {
    players: ghost.players,
    squad: ghost.squad,
    stats: seasonStats(season.slots, season.fixtures),
    game_version: process.env.GAME_VERSION ?? "unknown",
  };
  const result = endOfSeason(season.seed, players);
  const byId = new Map(players.map((p) => [p.id, p]));
  const updates = result.aged.map((a) => {
    const p = byId.get(a.id) as (typeof players)[number];
    return {
      id: a.id,
      age: a.age,
      attributes: a.attributes,
      overall: a.overall,
      worth: playerWorth({
        overall: a.overall,
        age: a.age,
        potentialRange: p.potentialRange,
      }),
      ...conditionRow(
        seasonReset(roster.find((r) => r.id === a.id)?.condition ?? FRESH),
      ),
    };
  });
  const review = {
    retired: result.retired.map((id) => {
      const p = byId.get(id) as (typeof players)[number];
      return {
        name: p.displayName,
        position: p.primaryPosition,
        age: p.age + 1,
        overall: p.overall,
      };
    }),
    changes: result.aged
      .map((a) => {
        const p = byId.get(a.id) as (typeof players)[number];
        return {
          name: p.displayName,
          position: p.primaryPosition,
          age: a.age,
          from: p.overall,
          to: a.overall,
        };
      })
      .filter((c) => c.from !== c.to)
      .sort((x, y) => y.to - y.from - (x.to - x.from)),
  };
  const { error } = await createServiceClient().rpc("close_season", {
    p_season: season.id,
    p_updates: updates,
    p_retired: result.retired,
    p_review: review,
    p_snapshot: snapshot,
  });
  if (error) {
    if (error.message.includes("cannot be closed"))
      throw new Error("This season is already wrapped up.");
    throw new Error(error.message);
  }
}

/** Youth intake (D53): takes the chosen prospects (by index) into the squad for free. */
export async function takeYouthFor(
  team: MyTeam,
  picks: readonly number[],
): Promise<void> {
  if (new Set(picks).size !== picks.length)
    throw new Error("A prospect was picked twice.");
  const season = await loadLatestSeason(team.id);
  if (!season?.closed || season.intakeResolved)
    throw new Error("The youth intake isn't open.");
  const prospects = youthIntake(
    season.seed,
    undefined,
    await liveGenerationSettings(),
  );
  const rows = picks.map((i) => {
    const p = prospects[i];
    if (!p) throw new Error("That pick isn't valid.");
    return playerRow(p);
  });
  const { error } = await createServiceClient().rpc("resolve_youth_intake", {
    p_season: season.id,
    p_players: rows,
    p_taken: [...picks].sort((a, b) => a - b),
  });
  if (error) {
    if (error.message.includes("not open"))
      throw new Error("The youth intake isn't open.");
    throw new Error(error.message);
  }
}

function conditionRow(c: PlayerCondition) {
  return {
    fitness: c.fitness,
    injured_weeks: c.injuredWeeks,
    suspended_weeks: c.suspendedWeeks,
    yellow_cards: c.yellowCards,
  };
}
