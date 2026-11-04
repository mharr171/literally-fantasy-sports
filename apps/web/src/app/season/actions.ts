"use server";

import { currentEnergy, playerWorth, spendEnergy } from "@lfs/core";
import {
  DEFAULT_GHOST_SETTINGS,
  endOfSeason,
  MANAGER_SLOT,
  newLeague,
  playWeek,
  rosterWarning,
  seasonStats,
  snapshotTeam,
  squadProblems,
  squadToTeam,
  youthIntake,
} from "@lfs/sport-soccer";
import { refresh } from "next/cache";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { playerRow } from "@/lib/scouting";
import {
  configFor,
  liveSoccerConfig,
  loadGhostCandidates,
  loadGhostTeams,
  loadLatestSeason,
} from "@/lib/season";
import { loadEnergySettings } from "@/lib/sport-settings";
import { createServiceClient } from "@/lib/supabase/service";
import {
  loadAgingPlayers,
  loadMyTeam,
  loadRoster,
  loadSquad,
  loadStarterPacks,
} from "@/lib/team";

export type ActionResult = { ok: true } | { ok: false; error: string };

const fail = (e: unknown): { ok: false; error: string } => ({
  ok: false,
  error: e instanceof Error ? e.message : "Something went wrong.",
});

/**
 * Everything a match needs from the manager: a picked starting squad, a
 * roster of 22–30 (D54) and a valid matchday squad (D88).
 */
async function readyTeam() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in first.");
  const team = await loadMyTeam(user.id);
  if (!team) throw new Error("Create your team first.");
  const packs = await loadStarterPacks(team.id);
  if (packs.some((p) => !p.resolved))
    throw new Error("Pick your starting squad first.");
  const [roster, squad] = await Promise.all([
    loadRoster(team.id),
    loadSquad(team.id),
  ]);
  const warning = rosterWarning(roster.length);
  if (warning) throw new Error(warning);
  if (!squad) throw new Error("Save a matchday squad first.");
  const problems = squadProblems(squad, new Set(roster.map((p) => p.id)));
  if (problems.length > 0)
    throw new Error(`Fix your matchday squad first: ${problems.join(" ")}`);
  return { team, roster, squad };
}

/** Starts the team's first season: a league of 7 AI teams and 14 weeks (D16, D32). */
export async function startSeason(): Promise<ActionResult> {
  try {
    const { team } = await readyTeam();
    const latest = await loadLatestSeason(team.id);
    if (latest && latest.status !== "finished")
      throw new Error("Your season is already under way.");
    if (latest && !(latest.closed && latest.intakeResolved))
      throw new Error(
        "Wrap up last season first: season end and youth intake.",
      );
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
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/**
 * Plays the current week: the manager's match with their saved squad and
 * every other match in the league, then saves results, Elo and earnings.
 */
export async function playNextWeek(): Promise<ActionResult> {
  try {
    const { team, roster, squad } = await readyTeam();
    const season = await loadLatestSeason(team.id);
    if (!season || season.status === "finished")
      throw new Error("Start a season first.");
    // 1 energy = 1 game week (D17, D93), unless an admin has switched it off.
    const energySettings = await loadEnergySettings("soccer");
    const now = new Date();
    const stored = {
      energy: team.energy,
      updatedAt: new Date(team.energyUpdatedAt),
    };
    let energyAfter: { energy: number; updatedAt: Date } | null = null;
    if (energySettings.enabled) {
      const current = currentEnergy(stored, now, energySettings);
      if (current.energy < 1) {
        const minutes = Math.max(
          1,
          Math.ceil(
            ((current.nextAt as Date).getTime() - now.getTime()) / 60_000,
          ),
        );
        throw new Error(
          `Out of energy: the next point comes back in ${minutes} minute${minutes === 1 ? "" : "s"}.`,
        );
      }
      energyAfter = spendEnergy(stored, now, energySettings);
    }
    const { config } = await configFor(season.configVersion);
    const elo = Object.fromEntries(season.slots.map((s) => [s.slot, s.elo]));
    elo[MANAGER_SLOT] = team.elo;
    const outcome = playWeek(
      {
        seed: season.seed,
        status: season.status,
        week: season.week,
        slots: season.slots,
        elo,
        fixtures: season.fixtures,
      },
      {
        team: squadToTeam(
          team.id,
          squad,
          new Map(roster.map((p) => [p.id, p])),
        ),
        names: new Map(roster.map((p) => [p.id, p.displayName])),
        ghosts: await loadGhostTeams(season.slots),
      },
      config,
    );
    const { error } = await createServiceClient().rpc("record_week", {
      p_season: season.id,
      p_week: season.week,
      p_results: outcome.played.map((p) => ({
        id: p.id,
        home_score: p.homeScore,
        away_score: p.awayScore,
        winner: p.winner,
        summary: p.summary,
      })),
      p_elo: Object.fromEntries(
        Object.entries(outcome.elo).map(([slot, rating]) => [slot, rating]),
      ),
      p_funds: outcome.managerFunds,
      p_new_fixtures: outcome.newFixtures.map((f) => ({
        week: f.week,
        stage: f.stage,
        home_slot: f.homeSlot,
        away_slot: f.awaySlot,
      })),
      p_status: outcome.status,
      p_next_week: outcome.week,
      p_energy: energyAfter?.energy ?? null,
      p_energy_updated_at: energyAfter?.updatedAt.toISOString() ?? null,
    });
    if (error) {
      if (error.message.includes("already played"))
        throw new Error("That week has already been played.");
      throw new Error(error.message);
    }
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

async function requireTeam() {
  const user = await getCurrentUser();
  if (!user) throw new Error("Sign in first.");
  const team = await loadMyTeam(user.id);
  if (!team) throw new Error("Create your team first.");
  return team;
}

/**
 * Season end (D35): every player ages a year, young ones grow, older ones
 * decline and some retire. Worked out from the season's seed, so it can
 * only ever come out one way.
 */
export async function endSeason(): Promise<ActionResult> {
  try {
    const team = await requireTeam();
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
    refresh();
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

const takenSchema = z.array(z.number().int().min(0).max(21)).max(22);

/** Youth intake (D53): takes the chosen prospects into the squad for free. */
export async function takeYouth(taken: number[]): Promise<ActionResult> {
  try {
    const picks = takenSchema.parse(taken);
    if (new Set(picks).size !== picks.length)
      throw new Error("A prospect was picked twice.");
    const team = await requireTeam();
    const season = await loadLatestSeason(team.id);
    if (!season?.closed || season.intakeResolved)
      throw new Error("The youth intake isn't open.");
    const prospects = youthIntake(season.seed);
    const rows = picks.map((i) =>
      playerRow(prospects[i] as (typeof prospects)[number]),
    );
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
    refresh();
    return { ok: true };
  } catch (e) {
    if (e instanceof z.ZodError)
      return fail(new Error("That pick isn't valid."));
    return fail(e);
  }
}
