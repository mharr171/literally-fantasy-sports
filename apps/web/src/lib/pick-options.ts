import {
  DEFAULT_MATCH_TUNING,
  formModifier,
  isAvailable,
  type PickOptions,
} from "@lfs/sport-soccer";
import type { RosterPlayer } from "./team";

/**
 * What auto-pick should weigh this week (M4): injured and suspended players
 * are unavailable, and tired or out-of-form players rate lower, the same way
 * the match engine treats them at kickoff.
 */
export function pickOptions(roster: readonly RosterPlayer[]): PickOptions {
  const byId = new Map(roster.map((p) => [p.id, p]));
  return {
    available: (id) => {
      const p = byId.get(id);
      return p ? isAvailable(p.condition) : false;
    },
    weight: (id) => {
      const p = byId.get(id);
      if (!p) return 1;
      const tiredness =
        DEFAULT_MATCH_TUNING.fatiguePenalty *
        ((100 - p.condition.fitness) / 100);
      return (1 - tiredness) * (1 + formModifier(p.form, 0));
    },
  };
}
