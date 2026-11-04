import {
  isAvailable,
  type PickOptions,
  pickWeight,
  ROTATION_FITNESS_EMPHASIS,
} from "@lfs/sport-soccer";
import type { RosterPlayer } from "./team";

/**
 * What auto-pick should weigh this week (M4): injured and suspended players
 * are unavailable, and tired or out-of-form players rate lower, the same way
 * the match engine treats them at kickoff. `rotate` weighs fitness much more,
 * so tired starters are rested (D110).
 */
export function pickOptions(
  roster: readonly RosterPlayer[],
  { rotate = false }: { rotate?: boolean } = {},
): PickOptions {
  const byId = new Map(roster.map((p) => [p.id, p]));
  const emphasis = rotate ? ROTATION_FITNESS_EMPHASIS : 1;
  return {
    available: (id) => {
      const p = byId.get(id);
      return p ? isAvailable(p.condition) : false;
    },
    weight: (id) => {
      const p = byId.get(id);
      return p ? pickWeight(p.condition.fitness, p.form, emphasis) : 1;
    },
  };
}
