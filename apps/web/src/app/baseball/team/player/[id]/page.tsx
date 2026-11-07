import { BASEBALL_STATS, POSITION_NAMES } from "@lfs/sport-baseball";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { loadBaseballPlayerPage } from "@/lib/baseball-player";
import { chemistryColor } from "@/lib/chemistry-colors";
import { loadMyTeam } from "@/lib/team";
import { CALL_COLOR, CALL_NAMES, SprayChart, ZoneChart } from "./charts";

export const metadata: Metadata = { title: "Baseball player" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One of the club's players: ratings, stats and charts (ADR 0009 §9). */
export default function BaseballPlayerPage({
  params,
}: PageProps<"/baseball/team/player/[id]">) {
  return (
    <section className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
      <Link href="/baseball/team" className="text-sm hover:underline">
        ← Your club
      </Link>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Player params={params} />
      </Suspense>
    </section>
  );
}

async function Player({
  params,
}: Pick<PageProps<"/baseball/team/player/[id]">, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const team = await loadMyTeam(user.id, "baseball");
  if (!team) redirect("/baseball/team");
  const p = await loadBaseballPlayerPage(team.id, id);
  if (!p) notFound();
  const pitcher = p.primaryPosition === "P";
  const role = pitcher
    ? p.traits.role === "reliever"
      ? "Relief pitcher"
      : "Starting pitcher"
    : POSITION_NAMES[p.primaryPosition];
  const color = chemistryColor(p.chemistryColor);
  const stat = (key: string) => {
    const def = BASEBALL_STATS.find((s) => s.key === key);
    if (!def) return null;
    if (def.kind === "rate") {
      const num = p.stats[def.numerator ?? ""] ?? 0;
      const den = p.stats[def.denominator ?? ""] ?? 0;
      if (den === 0) return "–";
      const v = (num / den) * (def.scale ?? 1);
      return v.toFixed(def.decimals ?? 2).replace(/^0\./, ".");
    }
    return String(p.stats[key] ?? 0);
  };
  const shown = BASEBALL_STATS.filter((s) =>
    pitcher
      ? [
          "gamesPitched",
          "wins",
          "losses",
          "saves",
          "era",
          "pitchingStrikeouts",
          "outs",
        ].includes(s.key)
      : [
          "games",
          "atBats",
          "hits",
          "avg",
          "homeRuns",
          "rbi",
          "walks",
          "strikeouts",
          "stolenBases",
        ].includes(s.key),
  );
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">
          {p.displayName}
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {role}
          {p.secondaryPosition && ` · also ${p.secondaryPosition}`} · Bats{" "}
          {p.traits.bats ?? "R"} · Throws {p.traits.throws ?? "R"} · Age {p.age}{" "}
          · {p.nationality} ·{" "}
          <span className="inline-flex items-center gap-1">
            <span
              className={`inline-block h-3 w-3 rounded-full ${color.swatch}`}
            />
            {color.name}
          </span>
        </p>
        {(p.injuredDays > 0 || p.restDays > 0) && (
          <p className="text-sm text-amber-700 dark:text-amber-400">
            {p.injuredDays > 0 && `Injured: ${p.injuredDays} days. `}
            {p.restDays > 0 && `Resting: ${p.restDays} days.`}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {[
          { label: "Overall", value: String(p.overall) },
          ...p.ratings.map((r) => ({ label: r.label, value: String(r.value) })),
          {
            label: "Potential",
            value: `${p.potentialRange[0]}–${p.potentialRange[1]}`,
          },
          { label: "Worth", value: p.worth.toLocaleString("en-US") },
        ].map((x) => (
          <div
            key={x.label}
            className="rounded-md border border-zinc-200 px-3 py-2 dark:border-zinc-800"
          >
            <div className="text-xs text-zinc-500">{x.label}</div>
            <div className="text-lg font-semibold">{x.value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-2">
          <h2 className="font-semibold">
            {pitcher ? "Where he pitches" : "Hot and cold zones"}
          </h2>
          <ZoneChart
            grid={p.zone}
            pitches={p.recent.pitches}
            mode={pitcher ? "pitcher" : "batter"}
          />
          <p className="text-xs text-zinc-500">
            Catcher&apos;s view; the box is the strike zone.{" "}
            {pitcher
              ? "Darker red: where he aims most."
              : "Red: he hits well there; blue: he struggles."}{" "}
            {p.recent.games > 0
              ? `Dots: his pitches from the last ${p.recent.games} game${p.recent.games === 1 ? "" : "s"}.`
              : "His pitches show here once he's played."}
          </p>
          {p.recent.pitches.length > 0 && (
            <ul className="flex flex-wrap gap-3 text-xs text-zinc-600 dark:text-zinc-400">
              {Object.entries(CALL_NAMES).map(([call, label]) => (
                <li key={call} className="flex items-center gap-1">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{
                      background: CALL_COLOR[call as keyof typeof CALL_COLOR],
                    }}
                  />
                  {label}
                </li>
              ))}
            </ul>
          )}
        </div>
        {p.spray && (
          <div className="flex flex-col gap-2">
            <h2 className="font-semibold">Spray chart</h2>
            <SprayChart spray={p.spray} batted={p.recent.batted} />
            <p className="text-xs text-zinc-500">
              Green: where he tends to hit the ball (he pulls to{" "}
              {(p.traits.bats ?? "R") === "L" ? "right" : "left"} field
              {p.traits.bats === "S"
                ? " batting left, as against most pitchers"
                : ""}
              ). Dots: his balls in play from recent games (filled = hit).
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-semibold">Career</h2>
        <div className="flex flex-wrap gap-3 text-sm">
          {shown.map((s) => (
            <div key={s.key} className="flex flex-col items-center">
              <span className="text-xs text-zinc-500" title={s.label}>
                {s.short}
              </span>
              <span className="font-medium">{stat(s.key)}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <h2 className="font-semibold">Attributes</h2>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3">
          {Object.entries(p.attributes).map(([k, v]) => (
            <div key={k} className="flex justify-between">
              <span className="text-zinc-600 dark:text-zinc-400">{k}</span>
              <span className="font-medium">{v}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
