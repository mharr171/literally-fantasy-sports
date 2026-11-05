import { currentEnergy, spendEnergy } from "@lfs/core";
import {
  availableSquad,
  FRESH,
  formModifier,
  isAvailable,
  MANAGER_SLOT,
  nextCondition,
  nextForm,
  nextMorale,
  playWeek,
  rosterWarning,
  type SoccerTeam,
  squadProblems,
  squadToTeam,
} from "@lfs/sport-soccer";
import { createServiceClient } from "./db";
import { scoreOnly } from "./match-kept";
import {
  configFor,
  loadGhostTeams,
  loadLatestSeason,
  playedIds,
  type StoredManagerTeam,
} from "./season";
import { loadEnergySettings } from "./sport-settings";
import { loadRoster, loadSquad, loadStarterPacks, type MyTeam } from "./team";

/**
 * Everything a match needs from a team: a picked starting squad, a roster
 * of 22–30 (D54) and a valid matchday squad (D88).
 */
export async function readyToPlay(team: MyTeam) {
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

/**
 * Plays the team's current week: their match with their saved squad and
 * every other match in the league, then saves results, Elo, earnings,
 * energy and player condition. `useEnergy: false` is for admin testing.
 * Returns the season's status afterwards.
 */
export async function playOneWeek(
  teamIn: MyTeam,
  { useEnergy }: { useEnergy: boolean },
): Promise<"regular" | "playoffs" | "finished"> {
  const { team, roster, squad } = await readyToPlay(teamIn);
  const season = await loadLatestSeason(team.id);
  if (!season || season.status === "finished")
    throw new Error("Start a season first.");
  // 1 energy = 1 game week (D17, D93), unless an admin has switched it off.
  // A week without the club's own match is free: the play-in for clubs
  // already in the quarter-finals, and the rounds after it's knocked out (D117).
  const hasMatch = season.fixtures.some(
    (f) =>
      f.week === season.week &&
      f.homeScore === null &&
      (f.homeSlot === MANAGER_SLOT || f.awaySlot === MANAGER_SLOT),
  );
  const energySettings = await loadEnergySettings("soccer");
  const now = new Date();
  const stored = {
    energy: team.energy,
    updatedAt: new Date(team.energyUpdatedAt),
  };
  let energyAfter: { energy: number; updatedAt: Date } | null = null;
  if (useEnergy && energySettings.enabled && hasMatch) {
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
  // The season plays and pays by the settings version it started with.
  const { config, balance } = await configFor(season.configVersion);
  // Injured and suspended players sit out; the best fit players step in.
  const condition = new Map(roster.map((p) => [p.id, p.condition]));
  const { squad: playing } = availableSquad(squad, roster, (id) =>
    isAvailable(condition.get(id) ?? FRESH),
  );
  const elo = Object.fromEntries(season.slots.map((s) => [s.slot, s.elo]));
  elo[MANAGER_SLOT] = team.elo;
  const managerTeam: SoccerTeam = {
    ...squadToTeam(team.id, playing, new Map(roster.map((p) => [p.id, p]))),
    fitness: Object.fromEntries(roster.map((p) => [p.id, p.condition.fitness])),
    // Form and morale nudge skill a little (M4).
    modifiers: Object.fromEntries(
      roster.map((p) => [p.id, formModifier(p.form, team.morale)]),
    ),
  };
  const managerNames = new Map(roster.map((p) => [p.id, p.displayName]));
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
      team: managerTeam,
      names: managerNames,
      ghosts: await loadGhostTeams(season.id),
    },
    config,
    balance.payouts,
  );
  // Kept with the manager's result so the match can be replayed (M5).
  const keptTeam: StoredManagerTeam = {
    team: managerTeam,
    names: Object.fromEntries(
      playedIds(managerTeam).map((id) => [id, managerNames.get(id) ?? "?"]),
    ),
  };
  const isMine = (id: string) => {
    const f = season.fixtures.find((x) => x.id === id);
    return f?.homeSlot === MANAGER_SLOT || f?.awaySlot === MANAGER_SLOT;
  };
  const { error } = await createServiceClient().rpc("record_week", {
    p_season: season.id,
    p_week: season.week,
    p_results: outcome.played.map((p) => ({
      id: p.id,
      home_score: p.homeScore,
      away_score: p.awayScore,
      winner: p.winner,
      // Other clubs' matches keep only their score (D120).
      summary: isMine(p.id) ? p.summary : scoreOnly(p.summary),
      manager_team: isMine(p.id) ? keptTeam : null,
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
    p_morale: nextMorale(team.morale, outcome.managerResult),
    p_players: roster.map((p) => {
      const next = nextCondition(p.condition, outcome.managerReports[p.id]);
      return {
        id: p.id,
        fitness: next.fitness,
        injured_weeks: next.injuredWeeks,
        suspended_weeks: next.suspendedWeeks,
        yellow_cards: next.yellowCards,
        form: nextForm(
          p.form,
          outcome.managerReports[p.id],
          outcome.managerResult,
        ),
        // Career totals for the retirement record (D120).
        appeared: (outcome.managerReports[p.id]?.minutes ?? 0) > 0,
        goals: outcome.managerReports[p.id]?.goals ?? 0,
      };
    }),
  });
  if (error) {
    if (error.message.includes("already played"))
      throw new Error("That week has already been played.");
    throw new Error(error.message);
  }
  return outcome.status;
}
