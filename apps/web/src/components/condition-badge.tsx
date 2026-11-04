import type { PlayerCondition } from "@lfs/sport-soccer";

/** Fitness, plus injury or ban status, for a player (M4). */
export function ConditionBadge({
  condition,
  compact = false,
}: {
  condition: PlayerCondition;
  compact?: boolean;
}) {
  if (condition.injuredWeeks > 0)
    return (
      <span
        className="rounded bg-red-100 px-1 text-xs text-red-800 dark:bg-red-950 dark:text-red-300"
        title={`Injured for ${condition.injuredWeeks} more week${condition.injuredWeeks === 1 ? "" : "s"}`}
      >
        ✚ {condition.injuredWeeks}w
      </span>
    );
  if (condition.suspendedWeeks > 0)
    return (
      <span
        className="rounded bg-amber-100 px-1 text-xs text-amber-900 dark:bg-amber-950 dark:text-amber-300"
        title={`Suspended for ${condition.suspendedWeeks} more match${condition.suspendedWeeks === 1 ? "" : "es"}`}
      >
        ⛔ {condition.suspendedWeeks}
      </span>
    );
  const tone =
    condition.fitness >= 85
      ? "text-emerald-700 dark:text-emerald-400"
      : condition.fitness >= 70
        ? "text-amber-700 dark:text-amber-400"
        : "text-red-700 dark:text-red-400";
  return (
    <span
      className={`text-xs tabular-nums ${tone}`}
      title="Match fitness at the next kickoff"
    >
      {compact ? "" : "Fit "}
      {condition.fitness}%
    </span>
  );
}
