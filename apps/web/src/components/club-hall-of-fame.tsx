import type { ClubHallOfFame } from "@/lib/history";
import { GREAT_LISTS } from "@/lib/history";
import { RetirementTributes } from "./retirement-tributes";

/** A club's all-time greats, honours and retired players (ADR 0005). */
export function ClubHallOfFamePanel({ hall }: { hall: ClubHallOfFame }) {
  const { honours } = hall;
  const facts: [string, string][] = [
    ["Titles", honours.titles ? `🏆 ${honours.titles}` : "0"],
    ["Finals", String(honours.finals)],
    [
      "Best finish",
      honours.bestFinish === null ? "–" : ordinal(honours.bestFinish),
    ],
    [
      "Highest Elo",
      honours.highestElo === null ? "–" : String(honours.highestElo),
    ],
    ["Longest unbeaten run", `${honours.unbeatenRun} league matches`],
  ];
  const lists = GREAT_LISTS.filter(({ key }) => hall.greats[key].length > 0);
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-2xl font-semibold tracking-tight">Hall of fame</h2>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {facts.map(([label, value]) => (
          <div
            key={label}
            className="rounded-md border border-zinc-200 p-3 dark:border-zinc-800"
          >
            <dt className="text-xs text-zinc-500">{label}</dt>
            <dd className="text-lg font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
      {lists.length === 0 ? (
        <p className="text-sm text-zinc-500">
          Your all-time greats appear here once your players have played.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {lists.map(({ key, label }) => (
            <div
              key={key}
              className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800"
            >
              <h3 className="mb-1 font-semibold">{label}</h3>
              <ol className="flex flex-col gap-0.5">
                {hall.greats[key].map((g, i) => (
                  <li key={g.id} className="flex justify-between gap-2">
                    <span className="min-w-0 truncate">
                      <span className="mr-1.5 tabular-nums text-zinc-500">
                        {i + 1}
                      </span>
                      {g.name}{" "}
                      <span className="text-xs text-zinc-500">
                        {g.position}
                        {g.retired ? " · retired" : ""}
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">{g[key]}</span>
                  </li>
                ))}
              </ol>
            </div>
          ))}
        </div>
      )}
      <RetirementTributes
        tributes={hall.retired}
        greatIds={hall.greatIds}
        title="Retired"
      />
    </div>
  );
}

function ordinal(n: number) {
  const s =
    n % 100 >= 11 && n % 100 <= 13
      ? "th"
      : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[n % 10] ??
        "th");
  return `${n}${s}`;
}
