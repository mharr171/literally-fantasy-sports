import type { MatchSummary } from "./sports/soccer";

/**
 * What's kept of a match the manager wasn't in (D120): its score (stored
 * on the fixture) and, for a knockout, how it was decided.
 */
export function scoreOnly(
  summary: MatchSummary | null | undefined,
): Pick<MatchSummary, "decidedBy" | "penalties"> | null {
  if (!summary?.decidedBy) return null;
  return summary.penalties
    ? { decidedBy: summary.decidedBy, penalties: summary.penalties }
    : { decidedBy: summary.decidedBy };
}
