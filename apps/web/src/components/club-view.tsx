import {
  formation,
  POSITIONS,
  type Position,
  slotLabel,
  squadScore,
} from "@lfs/sport-soccer";
import { ChemistryShares } from "@/components/chemistry-shares";
import { ClubBadge } from "@/components/club-badge";
import { ChemistryDot } from "@/components/player/player-card";
import type { ClubPlayer, ClubView } from "@/lib/club-view";

const KIND = {
  manager: "Your club",
  ai: "Club",
  // Other clubs, as the league copied them (D115). AI clubs and real
  // clubs' ghosts look the same (D113).
  ghost: "Club",
} as const;

/**
 * Another club as you'd scout it (D111): its starting 11 and bench in their
 * places, the rest of the roster, its squad score and how its players split
 * across chemistry colors.
 */
export function ClubViewPanel({ club }: { club: ClubView }) {
  const byId = new Map(club.players.map((p) => [p.id, p]));
  const slots = club.squad
    ? (formation(club.squad.formation)?.slots ?? [])
    : [];
  const starters = (club.squad?.lineup ?? [])
    .map((id, i) => {
      const s = slots[i];
      return {
        player: byId.get(id),
        slot: s?.position,
        label: s ? slotLabel(s) : undefined,
      };
    })
    .filter(
      (s): s is { player: ClubPlayer; slot: Position; label: string } =>
        s.player !== undefined && s.slot !== undefined,
    );
  const bench = (club.squad?.bench ?? []).flatMap((id) => byId.get(id) ?? []);
  const inSquad = new Set([
    ...(club.squad?.lineup ?? []),
    ...(club.squad?.bench ?? []),
  ]);
  const rest = club.players
    .filter((p) => !inSquad.has(p.id))
    .sort(
      (a, b) =>
        POSITIONS.indexOf(a.primaryPosition) -
          POSITIONS.indexOf(b.primaryPosition) || b.overall - a.overall,
    );
  const score = squadScore(
    starters.map((s) => ({ player: s.player, slot: s.slot })),
  );
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-wide text-zinc-500">
            {KIND[club.kind]}
            {club.subtitle ? ` · ${club.subtitle}` : ""}
          </p>
          <h1 className="flex items-center gap-3 text-3xl font-semibold tracking-tight">
            <ClubBadge name={club.name} colors={club.colors} size="h-6 w-9" />
            {club.name}
          </h1>
        </div>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {club.elo !== null && <>Elo {club.elo} · </>}
          {club.players.length} players
          {starters.length > 0 && (
            <>
              {" "}
              · Squad score <strong>{score.base.toFixed(1)}</strong>
            </>
          )}
          {club.squad && <> · {club.squad.formation}</>}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <ChemistryShares
          title="Starting 11"
          players={starters.map((s) => s.player)}
        />
        <ChemistryShares title="Whole roster" players={club.players} />
      </div>

      {starters.length > 0 && (
        <PlayerList
          title="Starting 11"
          rows={starters.map((s) => ({ player: s.player, place: s.label }))}
        />
      )}
      {bench.length > 0 && (
        <PlayerList
          title="Bench"
          rows={bench.map((p, i) => ({ player: p, place: `S${i + 1}` }))}
        />
      )}
      {rest.length > 0 && (
        <PlayerList
          title="Rest of the roster"
          rows={rest.map((p) => ({ player: p, place: "" }))}
        />
      )}
      <p className="text-xs text-zinc-500">
        Ratings are overall at each player&apos;s main position. Potential and
        fitness stay with the club&apos;s own manager.
      </p>
    </div>
  );
}

function PlayerList({
  title,
  rows,
}: {
  title: string;
  rows: { player: ClubPlayer; place: string }[];
}) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Place</th>
              <th className="px-3 py-2">Pos</th>
              <th className="px-3 py-2">Name</th>
              <th className="px-3 py-2 text-right">Overall</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ player: p, place }) => (
              <tr
                key={p.id}
                className="border-t border-zinc-200 dark:border-zinc-800"
              >
                <td className="px-3 py-1.5 text-zinc-500">{place}</td>
                <td className="px-3 py-1.5 font-medium">
                  {p.primaryPosition}
                  {p.secondaryPosition && (
                    <span className="text-zinc-500">
                      {" "}
                      / {p.secondaryPosition}
                    </span>
                  )}
                </td>
                <td className="px-3 py-1.5">
                  <span className="inline-flex items-center gap-1.5">
                    <ChemistryDot color={p.chemistryColor} />
                    {p.displayName}
                  </span>
                </td>
                <td className="px-3 py-1.5 text-right font-semibold tabular-nums">
                  {p.overall}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
