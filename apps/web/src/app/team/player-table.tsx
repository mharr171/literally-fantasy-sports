import type { ScoutedPlayer } from "@/lib/scouting";

/** A read-only list of players. */
export function PlayerTable({
  players,
}: {
  players: (ScoutedPlayer & { id: string })[];
}) {
  return (
    <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[36rem] text-left text-sm">
        <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
          <tr>
            <th className="px-3 py-2">Pos</th>
            <th className="px-3 py-2">Name</th>
            <th className="px-3 py-2">Nat</th>
            <th className="px-3 py-2 text-right">Age</th>
            <th className="px-3 py-2 text-right">Overall</th>
            <th className="px-3 py-2 text-right">Potential</th>
            <th className="px-3 py-2 text-right">Worth</th>
          </tr>
        </thead>
        <tbody>
          {players.map((p) => (
            <tr
              key={p.id}
              className="border-t border-zinc-200 dark:border-zinc-800"
            >
              <td className="px-3 py-2 font-medium">
                {p.primaryPosition}
                {p.secondaryPosition && (
                  <span className="text-zinc-500">
                    {" "}
                    / {p.secondaryPosition}
                  </span>
                )}
              </td>
              <td className="px-3 py-2">{p.displayName}</td>
              <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">
                {p.nationality}
              </td>
              <td className="px-3 py-2 text-right">{p.age}</td>
              <td className="px-3 py-2 text-right font-semibold">
                {p.overall}
              </td>
              <td className="px-3 py-2 text-right">
                {p.potentialRange[0]}–{p.potentialRange[1]}
              </td>
              <td className="px-3 py-2 text-right">
                {p.worth.toLocaleString("en-US")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
