import type { Tribute } from "@/lib/history";

const pct = (t: Tribute) => {
  const n = t.wins + t.draws + t.losses;
  return n > 0 ? `${Math.round((t.wins / n) * 100)}%` : "–";
};

/** A career card for each player who retired (D121, ADR 0005). */
export function RetirementTributes({
  tributes,
  title = "Retiring with thanks",
  greatIds = [],
}: {
  tributes: readonly Tribute[];
  title?: string;
  /** Players on any of the club's all-time lists. */
  greatIds?: readonly string[];
}) {
  if (tributes.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="font-semibold">{title}</h3>
      <ul className="grid gap-3 sm:grid-cols-2">
        {tributes.map((t) => {
          const lines: [string, string | number][] = [
            ["Seasons", t.seasons],
            ["Games", t.games],
            ["W-D-L", `${t.wins}-${t.draws}-${t.losses}`],
            ["Win %", pct(t)],
            ["Goals", t.goals],
            ["Assists", t.assists],
            ["Tackles", t.tackles],
            ...(t.position === "GK" || t.saves > 0
              ? ([["Saves", t.saves]] as [string, number][])
              : []),
            ["Best overall", t.bestOverall],
          ];
          return (
            <li
              key={t.id}
              className="flex flex-col gap-2 rounded-md border border-amber-200 bg-amber-50/60 p-3 text-sm dark:border-amber-900 dark:bg-amber-950/30"
            >
              <p>
                <span className="font-semibold">{t.name}</span>{" "}
                <span className="text-zinc-600 dark:text-zinc-400">
                  · {t.position} · retired at {t.age} after season{" "}
                  {t.retiredSeason}
                </span>
                {greatIds.includes(t.id) && (
                  <span className="ml-2 inline-block whitespace-nowrap rounded bg-amber-200 px-1.5 py-0.5 text-xs font-semibold text-amber-900 dark:bg-amber-800 dark:text-amber-100">
                    ★ One of the club&apos;s greats
                  </span>
                )}
              </p>
              <dl className="grid grid-cols-3 gap-x-3 gap-y-1 sm:grid-cols-4">
                {lines.map(([label, value]) => (
                  <div key={label}>
                    <dt className="text-xs text-zinc-500">{label}</dt>
                    <dd className="font-semibold tabular-nums">{value}</dd>
                  </div>
                ))}
              </dl>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
