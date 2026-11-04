"use server";

import {
  MANAGER_SLOT,
  newLeague,
  playWeek,
  rosterWarning,
  squadProblems,
  squadToTeam,
} from "@lfs/sport-soccer";
import { refresh } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { configFor, liveSoccerConfig, loadLatestSeason } from "@/lib/season";
import { createServiceClient } from "@/lib/supabase/service";
import {
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
    if (latest)
      throw new Error(
        "The next season opens once season-end (ageing and youth intake) is ready.",
      );
    const seed = crypto.randomUUID();
    const { label } = await liveSoccerConfig();
    const league = newLeague(seed, { name: team.name, elo: team.elo });
    const { error } = await createServiceClient().rpc("start_season", {
      p_team: team.id,
      p_seed: seed,
      p_config_version: label,
      p_slots: league.slots.map((s) => ({
        slot: s.slot,
        kind: s.kind,
        name: s.name,
        start_rating: s.startRating,
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
