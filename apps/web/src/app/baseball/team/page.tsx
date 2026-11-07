import { createRng } from "@lfs/core";
import {
  boxScore,
  defaultBaseballConfig,
  harnessTeam,
  simulateGame,
} from "@lfs/sport-baseball";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ClubBadge } from "@/components/club-badge";
import { CreateClubForm } from "@/components/create-club-form";
import { getCurrentUser } from "@/lib/auth";
import {
  type BaseballRosterPlayer,
  loadBaseballRoster,
  loadBaseballScouting,
} from "@/lib/baseball-squad";
import { otherClub } from "@/lib/other-club";
import { loadRosterLimits, loadSportSwitches } from "@/lib/sport-settings";
import { loadMyTeam } from "@/lib/team";
import { createBaseballClub } from "./actions";
import { ClaimPacks } from "./claim-packs";
import { BaseballScouting } from "./scouting";

export const metadata: Metadata = { title: "Baseball" };

/**
 * Baseball while it's being built: only admins can reach it until its
 * Public switch is on (D207). It plays a sample game between two generated
 * clubs on the real engine (ADR 0008); M18 builds the game around it.
 */
export default function BaseballTeamPage() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">⚾ Baseball</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Baseball is being built. Start a club and scout its first squad; squads,
        seasons and the match screens follow in M18. Below, a sample game
        between two generated clubs, played pitch by pitch.
      </p>
      <Suspense fallback={null}>
        <Status />
      </Suspense>
      <Suspense fallback={null}>
        <Club />
      </Suspense>
      <SampleGame />
    </section>
  );
}

async function Status() {
  // Read per request, never at build time.
  await connection();
  const s = (await loadSportSwitches()).find((x) => x.sport === "baseball");
  if (s?.public) return null;
  return (
    <p className="rounded-md border border-violet-200 bg-violet-50 px-3 py-2 text-sm text-violet-900 dark:border-violet-900 dark:bg-violet-950 dark:text-violet-200">
      Only admins can see this: baseball&apos;s Public switch is off (Admin →
      Sports).
    </p>
  );
}

/** The manager's baseball club, or the form to start one (D192). */
async function Club() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const team = await loadMyTeam(user.id, "baseball");
  if (!team)
    return (
      <CreateClubForm
        action={createBaseballClub}
        intro="Name your baseball club and pick its colors. You'll then scout 16 starter packs and keep your first squad."
        submitLabel="Create baseball club"
        copyFrom={await otherClub(user.id, "baseball")}
      />
    );
  const [{ packs, resolved }, roster, limits] = await Promise.all([
    loadBaseballScouting(team.id),
    loadBaseballRoster(team.id),
    loadRosterLimits("baseball"),
  ]);
  return (
    <div className="flex flex-col gap-4">
      <p className="flex items-center gap-2 text-sm">
        Your club: <ClubBadge name={team.name} colors={team.colors} />
        <strong>{team.name}</strong>
      </p>
      {packs.length === 0 && roster.length === 0 ? (
        <ClaimPacks />
      ) : !resolved ? (
        <BaseballScouting packs={packs} min={limits.min} max={limits.max} />
      ) : (
        <Roster players={roster} />
      )}
    </div>
  );
}

const roleOf = (p: BaseballRosterPlayer) =>
  p.primaryPosition === "P"
    ? p.traits.role === "reliever"
      ? "RP"
      : "SP"
    : p.secondaryPosition
      ? `${p.primaryPosition}/${p.secondaryPosition}`
      : p.primaryPosition;

/** The squad once it's picked; the squad builder comes next (M18 step 7). */
function Roster({ players }: { players: BaseballRosterPlayer[] }) {
  const pitchers = players.filter((p) => p.primaryPosition === "P");
  const batters = players.filter((p) => p.primaryPosition !== "P");
  const table = (title: string, list: BaseballRosterPlayer[]) => (
    <div className="flex flex-col gap-1">
      <h3 className="text-sm font-semibold">
        {title} ({list.length})
      </h3>
      <div className="overflow-x-auto rounded-md border border-zinc-200 dark:border-zinc-800">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-left text-xs text-zinc-500 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2">Player</th>
              <th className="px-3 py-2">Pos</th>
              <th className="px-3 py-2" title="Bats · Throws">
                B/T
              </th>
              <th className="px-3 py-2 text-right">Age</th>
              <th className="px-3 py-2 text-right">OVR</th>
              <th className="px-3 py-2 text-right">Potential</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr
                key={p.id}
                className="border-t border-zinc-100 dark:border-zinc-800"
              >
                <td className="px-3 py-1.5">
                  <Link
                    href={`/baseball/team/player/${p.id}`}
                    className="hover:underline"
                  >
                    {p.displayName}
                  </Link>
                </td>
                <td className="px-3 py-1.5">{roleOf(p)}</td>
                <td className="px-3 py-1.5">
                  {p.traits.bats ?? "R"}/{p.traits.throws ?? "R"}
                </td>
                <td className="px-3 py-1.5 text-right">{p.age}</td>
                <td className="px-3 py-1.5 text-right font-medium">
                  {p.overall}
                </td>
                <td className="px-3 py-1.5 text-right">
                  {p.potentialRange[0]}–{p.potentialRange[1]}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-semibold">Your squad</h2>
        <Link
          href="/baseball/season"
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Season
        </Link>
        <Link
          href="/baseball/team/squad"
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          Game-day squad
        </Link>
      </div>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {players.length} players. Set your batting order, rotation, bullpen and
        bench under Game-day squad.
      </p>
      {table("Pitchers", pitchers)}
      {table("Batters", batters)}
    </div>
  );
}

/** A sample game on the real engine, the same every time (from its seed). */
function SampleGame() {
  const rng = createRng("baseball-sample");
  const home = harnessTeam(rng.fork("home"), "home", 60);
  const away = harnessTeam(rng.fork("away"), "away", 60);
  const game = simulateGame(
    { home, away, mode: "league", config: defaultBaseballConfig() },
    "baseball-sample",
  );
  const box = boxScore(game);
  const { result } = game;
  const innings = result.lineScore.away.length;
  const names = new Map(
    [home, away].flatMap((t) =>
      [t.pitcher, ...(t.bullpen ?? [])].map((p) => [p.id, p] as const),
    ),
  );
  const pitcherName = (id: string | null) =>
    id
      ? ((names.get(id) as { displayName?: string } | undefined)?.displayName ??
        id)
      : "—";
  const row = (side: "away" | "home", label: string) => (
    <tr className="border-t border-zinc-200 dark:border-zinc-800">
      <th className="py-1 pr-3 text-left font-medium">{label}</th>
      {Array.from({ length: innings }, (_, i) => (
        // Innings are fixed for the page: their position is their identity.
        // biome-ignore lint/suspicious/noArrayIndexKey: innings have no other id
        <td key={i} className="px-1.5 py-1 text-center">
          {result.lineScore[side][i] ?? "x"}
        </td>
      ))}
      <td className="px-2 py-1 text-center font-semibold">
        {result.score[side]}
      </td>
      <td className="px-2 py-1 text-center">{result.hits[side]}</td>
      <td className="px-2 py-1 text-center">{result.errors[side]}</td>
    </tr>
  );
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
      <h2 className="font-semibold">A sample game</h2>
      <div className="overflow-x-auto">
        <table className="tabular-nums">
          <thead className="text-zinc-500">
            <tr>
              <th />
              {Array.from({ length: innings }, (_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: innings have no other id
                <th key={i} className="px-1.5 font-normal">
                  {i + 1}
                </th>
              ))}
              <th className="px-2 font-normal">R</th>
              <th className="px-2 font-normal">H</th>
              <th className="px-2 font-normal">E</th>
            </tr>
          </thead>
          <tbody>
            {row("away", "Away")}
            {row("home", "Home")}
          </tbody>
        </table>
      </div>
      <p className="text-zinc-600 dark:text-zinc-400">
        {result.decidedBy === "extra_innings" ? "Won in extra innings. " : ""}W:{" "}
        {pitcherName(box.decisions.win)} · L: {pitcherName(box.decisions.loss)}
        {box.decisions.save ? ` · S: ${pitcherName(box.decisions.save)}` : ""} ·{" "}
        {game.events.filter((e) => e.type === "pitch").length} pitches
      </p>
    </div>
  );
}
