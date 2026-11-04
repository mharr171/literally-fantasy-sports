import { describe, expect, it } from "vitest";
import { nextStep, type OnboardingState, onboardingSteps } from "./onboarding";

const none: OnboardingState = {
  hasTeam: false,
  packsDone: false,
  squadReady: false,
  hasSeason: false,
  playedAWeek: false,
};

describe("getting started (M6)", () => {
  it("starts with naming the club", () => {
    const steps = onboardingSteps(none);
    expect(steps.map((s) => s.done)).toEqual([
      false,
      false,
      false,
      false,
      false,
    ]);
    expect(nextStep(steps)?.id).toBe("team");
  });

  it("walks through the steps in order", () => {
    const order: [Partial<OnboardingState>, string | null][] = [
      [{ hasTeam: true }, "packs"],
      [{ hasTeam: true, packsDone: true }, "squad"],
      [{ hasTeam: true, packsDone: true, squadReady: true }, "season"],
      [
        { hasTeam: true, packsDone: true, squadReady: true, hasSeason: true },
        "play",
      ],
      [
        {
          hasTeam: true,
          packsDone: true,
          squadReady: true,
          hasSeason: true,
          playedAWeek: true,
        },
        null,
      ],
    ];
    for (const [state, next] of order)
      expect(nextStep(onboardingSteps({ ...none, ...state }))?.id ?? null).toBe(
        next,
      );
  });

  it("asks for a squad again if it stops being valid before the season", () => {
    const steps = onboardingSteps({
      ...none,
      hasTeam: true,
      packsDone: true,
      squadReady: false,
    });
    expect(nextStep(steps)?.href).toBe("/team/squad");
  });
});
