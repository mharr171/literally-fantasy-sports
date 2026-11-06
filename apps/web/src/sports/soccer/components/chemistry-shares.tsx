import { chemistryShares } from "@lfs/sport-soccer";
import { CHEMISTRY_COLORS } from "@/lib/chemistry-colors";
import { ChemistryDot } from "@/sports/soccer/components/player/player-card";

/** A bar and a list of how players split across chemistry colors (D111, D139). */
export function ChemistryShares({
  title,
  players,
  compact = false,
}: {
  title?: string;
  players: readonly { chemistryColor: number }[];
  /** Just the bar and percentages, for tables. */
  compact?: boolean;
}) {
  const shares = chemistryShares(players);
  const bar = (
    <div className="flex h-3 overflow-hidden rounded" aria-hidden="true">
      {shares.map((s) => (
        <span
          key={s.color}
          style={{
            width: `${s.share * 100}%`,
            background: CHEMISTRY_COLORS[s.color]?.hex ?? "#a1a1aa",
          }}
        />
      ))}
    </div>
  );
  const list = (
    <ul className="flex flex-wrap gap-x-3 gap-y-1">
      {shares.map((s) => (
        <li key={s.color} className="inline-flex items-center gap-1">
          <ChemistryDot color={s.color} />
          {compact ? "" : `${CHEMISTRY_COLORS[s.color]?.name ?? "Unknown"} `}
          <span className="tabular-nums text-zinc-600 dark:text-zinc-400">
            {Math.round(s.share * 100)}%{compact ? "" : ` (${s.count})`}
          </span>
        </li>
      ))}
    </ul>
  );
  if (compact)
    return (
      <div className="flex min-w-40 flex-col gap-1 text-xs">
        {bar}
        {list}
      </div>
    );
  return (
    <div className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
      {title && <h2 className="font-semibold">Chemistry colors · {title}</h2>}
      {shares.length === 0 ? (
        <p className="text-zinc-500">No players.</p>
      ) : (
        <>
          {bar}
          {list}
        </>
      )}
    </div>
  );
}
