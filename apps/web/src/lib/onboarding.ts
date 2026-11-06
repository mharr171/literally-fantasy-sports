/**
 * Getting started (M6): the steps from a new account to a first played
 * week, worked out from the team's state. Shown until the first week is
 * played; nothing is stored.
 */

export type StepId = "team" | "packs" | "squad" | "season" | "play";

export interface OnboardingState {
  hasTeam: boolean;
  /** Starter packs all opened and the first squad confirmed. */
  packsDone: boolean;
  /** A valid matchday squad is saved. */
  squadReady: boolean;
  hasSeason: boolean;
  /** At least one week of any season played. */
  playedAWeek: boolean;
}

export interface Step {
  id: StepId;
  title: string;
  help: string;
  href: string;
  /** Button text for the step when it's next. */
  action: string;
  done: boolean;
}

export function onboardingSteps(s: OnboardingState): Step[] {
  return [
    {
      id: "team",
      title: "Name your club",
      help: "Pick a name between 3 and 30 characters. You can play one soccer club.",
      href: "/soccer/team",
      action: "Name your club",
      done: s.hasTeam,
    },
    {
      id: "packs",
      title: "Open your 22 starter packs",
      help: "Each holds 5 players. Keep the 22 to 30 you like best; the rest go back for free.",
      href: "/soccer/team",
      action: "Open your packs",
      done: s.hasTeam && s.packsDone,
    },
    {
      id: "squad",
      title: "Pick your matchday 22",
      help: "Choose a formation, put 11 on the pitch and 11 on the bench. Auto-pick does it in one click.",
      href: "/soccer/team/squad",
      action: "Pick your squad",
      done: s.hasTeam && s.packsDone && s.squadReady,
    },
    {
      id: "season",
      title: "Start season 1",
      help: "11 clubs around your rating, home and away over 22 weeks, then a play-in and an 8-club bracket.",
      href: "/soccer/season",
      action: "Start your season",
      done: s.hasSeason,
    },
    {
      id: "play",
      title: "Play your first week",
      help: "Your saved squad plays. Each week costs 1 energy, which comes back over time.",
      href: "/soccer/season",
      action: "Play week 1",
      done: s.playedAWeek,
    },
  ];
}

/** The first step not done yet, or null once everything is. */
export function nextStep(steps: readonly Step[]): Step | null {
  return steps.find((s) => !s.done) ?? null;
}
