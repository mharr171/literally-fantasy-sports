import "server-only";
import { squadProblems } from "@lfs/sport-soccer";
import { type OnboardingState, onboardingSteps, type Step } from "./onboarding";
import { loadLatestSeason } from "./season";
import { loadMyTeam, loadRoster, loadSquad, loadStarterPacks } from "./team";

/** The getting-started steps for a signed-in manager (M6). */
export async function loadOnboarding(userId: string): Promise<Step[]> {
  const team = await loadMyTeam(userId);
  const state: OnboardingState = {
    hasTeam: team !== null,
    packsDone: false,
    squadReady: false,
    hasSeason: false,
    playedAWeek: false,
  };
  if (team) {
    const [packs, season] = await Promise.all([
      loadStarterPacks(team.id),
      loadLatestSeason(team.id),
    ]);
    state.packsDone = packs.length > 0 && packs.every((p) => p.resolved);
    state.hasSeason = season !== null;
    state.playedAWeek =
      season !== null &&
      (season.number > 1 || season.fixtures.some((f) => f.homeScore !== null));
    if (state.packsDone && !state.playedAWeek) {
      const [roster, squad] = await Promise.all([
        loadRoster(team.id),
        loadSquad(team.id),
      ]);
      state.squadReady =
        squad !== null &&
        squadProblems(squad, new Set(roster.map((p) => p.id))).length === 0;
    } else if (state.playedAWeek) state.squadReady = true;
  }
  return onboardingSteps(state);
}
