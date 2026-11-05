import type { SeasonReview } from "@/lib/season";

/** Who improved, declined and retired at a season's end (D60). */
export function SeasonReviewPanel({ review }: { review: SeasonReview }) {
  const up = review.changes.filter((c) => c.to > c.from);
  const down = review.changes.filter((c) => c.to < c.from);
  return (
    <div className="grid gap-4 text-sm sm:grid-cols-3">
      <div>
        <h3 className="font-semibold">Improved</h3>
        {up.length === 0 && <p className="text-zinc-500">Nobody this year.</p>}
        <ul>
          {up.map((c) => (
            <li key={c.name}>
              {c.position} {c.name} ({c.age}){" "}
              <span className="text-emerald-700 dark:text-emerald-400">
                {c.from} → {c.to}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="font-semibold">Declined</h3>
        {down.length === 0 && (
          <p className="text-zinc-500">Nobody this year.</p>
        )}
        <ul>
          {down.map((c) => (
            <li key={c.name}>
              {c.position} {c.name} ({c.age}){" "}
              <span className="text-red-700 dark:text-red-400">
                {c.from} → {c.to}
              </span>
            </li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="font-semibold">Retired</h3>
        {review.retired.length === 0 && (
          <p className="text-zinc-500">Nobody this year.</p>
        )}
        <ul>
          {review.retired.map((r) => (
            <li key={r.name}>
              {r.position} {r.name}, {r.age} ({r.overall})
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
