/** A player's form (−1 to 1) as an arrow and a word. */
export function FormLabel({ form }: { form: number }) {
  const [arrow, word, tone] =
    form >= 0.4
      ? ["▲", "Hot", "text-emerald-700 dark:text-emerald-400"]
      : form >= 0.1
        ? ["▲", "Good", "text-emerald-700 dark:text-emerald-400"]
        : form > -0.1
          ? ["–", "Steady", "text-zinc-500"]
          : form > -0.4
            ? ["▼", "Poor", "text-amber-700 dark:text-amber-400"]
            : ["▼", "Cold", "text-red-700 dark:text-red-400"];
  return (
    <span
      className={`text-xs ${tone}`}
      title={`Form ${form.toFixed(2)}: nudges skill by up to ±5%`}
    >
      {arrow} {word}
    </span>
  );
}

/** Team morale (−1 to 1) as a word. */
export function moraleLabel(morale: number): string {
  if (morale >= 0.5) return "Buoyant";
  if (morale >= 0.15) return "Upbeat";
  if (morale > -0.15) return "Steady";
  if (morale > -0.5) return "Low";
  return "Rock bottom";
}
