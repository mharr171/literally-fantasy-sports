/**
 * A club's season steps (ADR 0002): start a season, end it, take youth.
 * The same code runs for a manager pressing a button and for an AI club.
 * Callers check who is acting first; these check the rules every sport
 * shares and ask the club's sport for the rest (ADR 0009 §1).
 */
import { createServiceClient } from "./db";
import { readyToPlay, seasonOf } from "./play-week";
import { loadLatestSeason } from "./season";
import type { MyTeam } from "./team";

/** Starts the club's next season: a league of the clubs nearest its Elo (D115). */
export async function startSeasonFor(team: MyTeam): Promise<void> {
  await readyToPlay(team);
  const latest = await loadLatestSeason(team.id);
  if (latest && latest.status !== "finished")
    throw new Error("Your season is already under way.");
  if (latest && !(latest.closed && latest.intakeResolved))
    throw new Error("Wrap up last season first: season end and youth intake.");
  const seed = crypto.randomUUID();
  const league = await seasonOf(team).newSeason(team, seed);
  const { error } = await createServiceClient().rpc("start_season", {
    p_team: team.id,
    p_seed: seed,
    p_config_version: league.configVersion,
    p_slots: league.slots,
    p_fixtures: league.fixtures,
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
  const { error } = await createServiceClient().rpc(
    "close_season_with_reward",
    {
      p_season: season.id,
      ...(await seasonOf(team).closeSeason(team, season)),
    },
  );
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
  const prospects = await seasonOf(team).youthRows(season.seed);
  const rows = picks.map((i) => {
    const p = prospects[i];
    if (!p) throw new Error("That pick isn't valid.");
    return p;
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
