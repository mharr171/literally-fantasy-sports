import { currentEnergy, spendEnergy } from "@lfs/core";
import { createServiceClient } from "./db";
import { loadLatestSeason } from "./season";
import { MANAGER_SLOT, type SeasonModule } from "./season-module";
import { loadEnergySettings } from "./sport-settings";
import { sportModule } from "./sports";
import type { MyTeam } from "./team";

/** The club's sport's season part (ADR 0009 §1). */
export function seasonOf(team: MyTeam): SeasonModule {
  const season = sportModule(team.sport).season;
  if (!season) throw new Error("Seasons for this sport aren't open yet.");
  return season;
}

/**
 * Checks the club can play: its sport's rules for a picked, valid squad.
 * Returns what the sport found, for the week it plays.
 */
export function readyToPlay(team: MyTeam): Promise<unknown> {
  return seasonOf(team).readyToPlay(team);
}

/**
 * Plays the team's current week: their match with their saved squad and
 * every other match in the league, then saves results, Elo, earnings,
 * energy and player condition. `useEnergy: false` is for admin testing.
 * Returns the season's status afterwards.
 */
export async function playOneWeek(
  team: MyTeam,
  { useEnergy }: { useEnergy: boolean },
): Promise<"regular" | "playoffs" | "finished"> {
  const ready = await readyToPlay(team);
  const season = await loadLatestSeason(team.id);
  if (!season || season.status === "finished")
    throw new Error("Start a season first.");
  // 1 energy = 1 game week (D17, D93), unless an admin has switched it off.
  // A week without the club's own match is free: the play-in for clubs
  // already in the quarter-finals, and the rounds after it's knocked out (D117).
  const hasMatch = hasOwnMatch(season);
  const energySettings = await loadEnergySettings(team.sport);
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
  const week = await seasonOf(team).playWeek(team, ready, season);
  const { error } = await createServiceClient().rpc("record_week", {
    p_season: season.id,
    p_week: season.week,
    ...week.args,
    p_energy: energyAfter?.energy ?? null,
    p_energy_updated_at: energyAfter?.updatedAt.toISOString() ?? null,
  });
  if (error) {
    if (error.message.includes("already played"))
      throw new Error("That week has already been played.");
    throw new Error(error.message);
  }
  return week.status;
}

/** Whether the club has its own match in the season's current week. */
export function hasOwnMatch(season: {
  week: number;
  fixtures: readonly {
    week: number;
    homeScore: number | null;
    homeSlot: number;
    awaySlot: number;
  }[];
}): boolean {
  return season.fixtures.some(
    (f) =>
      f.week === season.week &&
      f.homeScore === null &&
      (f.homeSlot === MANAGER_SLOT || f.awaySlot === MANAGER_SLOT),
  );
}

/**
 * Plays the club's current week, then, if it skips idle weeks (D134), every
 * following week without its own match (free, the club rests), stopping
 * at its next match or the end of the season.
 */
export async function playWeekFor(
  team: MyTeam,
  { useEnergy }: { useEnergy: boolean },
): Promise<"regular" | "playoffs" | "finished"> {
  let status = await playOneWeek(team, { useEnergy });
  if (!team.skipIdleWeeks) return status;
  for (let i = 0; i < 8 && status !== "finished"; i++) {
    const season = await loadLatestSeason(team.id);
    if (!season || season.status === "finished" || hasOwnMatch(season)) break;
    status = await playOneWeek(team, { useEnergy });
  }
  return status;
}
