import {
  MANAGER_SLOT,
  type PlayLine,
  playByPlay,
  replayFixture,
  STAGE_MATCH_NAMES,
} from "@lfs/sport-soccer";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { AdminNote } from "@/components/admin-note";
import { adminView } from "@/lib/admin-view";
import { getCurrentUser } from "@/lib/auth";
import { loadClubOrigins } from "@/lib/club-view";
import { configFor, loadGhostTeams, loadMatch } from "@/lib/season";
import { loadMyTeam } from "@/lib/team";
import { MatchView, type MatchViewProps } from "./match-view";

export const metadata: Metadata = { title: "Match" };

export default function MatchPage({ params }: PageProps<"/season/match/[id]">) {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <Link href="/season" className="text-sm hover:underline">
        ← Season
      </Link>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <MatchContent params={params} />
      </Suspense>
    </section>
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An influence map as nested rows (row 0 = the home goal), rounded for the page. */
function rows(map: {
  size: { rows: number; cols: number };
  values: Float64Array;
}) {
  const out: number[][] = [];
  for (let r = 0; r < map.size.rows; r++)
    out.push(
      Array.from(
        map.values.subarray(r * map.size.cols, (r + 1) * map.size.cols),
        (v) => Math.round(v * 1000) / 1000,
      ),
    );
  return out;
}

async function MatchContent({
  params,
}: Pick<PageProps<"/season/match/[id]">, "params">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const team = await loadMyTeam(user.id);
  if (!team) redirect("/team");
  const match = await loadMatch(team.id, id);
  if (!match) notFound();
  const { fixture, slots } = match;
  const name = (slot: number) =>
    slots.find((s) => s.slot === slot)?.name ?? "?";
  const teams = { home: name(fixture.homeSlot), away: name(fixture.awaySlot) };
  const title =
    fixture.stage === "league"
      ? `Season ${match.seasonNumber} · week ${fixture.week}`
      : `Season ${match.seasonNumber} · ${STAGE_MATCH_NAMES[fixture.stage]}`;
  const mine =
    fixture.homeSlot === MANAGER_SLOT || fixture.awaySlot === MANAGER_SLOT;

  // Played again from its seed, with the same teams and settings (M5).
  let replay: MatchViewProps["replay"] = null;
  let problem: string | null = null;
  if (mine && !match.managerTeam) {
    problem =
      "This match was played before replays were kept, so only its summary is shown.";
  } else {
    const { config } = await configFor(match.configVersion);
    const r = replayFixture(
      match.seed,
      slots,
      fixture,
      {
        team: match.managerTeam?.team,
        names: new Map(Object.entries(match.managerTeam?.names ?? {})),
        ghosts: await loadGhostTeams(match.seasonId),
      },
      config,
    );
    const same =
      r.output.result.score.home === fixture.homeScore &&
      r.output.result.score.away === fixture.awayScore;
    if (!same) {
      problem =
        "This match can't be replayed exactly any more (a team in it has changed since), so only its summary is shown.";
    } else {
      const lines: PlayLine[] = playByPlay(r.output.events, r.names, teams);
      replay = {
        lines,
        influence: {
          home: rows(r.output.influence.home),
          away: rows(r.output.influence.away),
        },
        length: lines.at(-1)?.minute ?? 90,
      };
    }
  }

  const admin = (await adminView())
    ? await matchAdmin(slots, fixture, match.configVersion)
    : null;

  return (
    <>
      {admin}
      <MatchView
        title={title}
        teams={teams}
        teamColors={{
          home: fixture.homeSlot === MANAGER_SLOT ? team.colors : null,
          away: fixture.awaySlot === MANAGER_SLOT ? team.colors : null,
        }}
        mySide={
          fixture.homeSlot === MANAGER_SLOT
            ? "home"
            : fixture.awaySlot === MANAGER_SLOT
              ? "away"
              : null
        }
        score={{ home: fixture.homeScore, away: fixture.awayScore }}
        summary={fixture.summary}
        replay={replay}
        problem={problem}
      />
    </>
  );
}

/** What an admin sees above a match (D163): settings version and each side's origin. */
async function matchAdmin(
  slots: NonNullable<Awaited<ReturnType<typeof loadMatch>>>["slots"],
  fixture: { homeSlot: number; awaySlot: number },
  configVersion: string,
) {
  const origins = await loadClubOrigins(
    slots.flatMap((s) => (s.ghostId ? [s.ghostId] : [])),
  );
  const side = (slot: number) => {
    const s = slots.find((x) => x.slot === slot);
    if (!s) return "?";
    const what =
      s.kind === "manager"
        ? "this manager's club"
        : s.kind === "ai"
          ? "AI, made for this league"
          : s.ghostId
            ? (origins.get(s.ghostId)?.label ?? "club deleted")
            : "copy gone, plays as AI";
    return `${s.name} (${what}, started at ${s.startRating} Elo)`;
  };
  return (
    <AdminNote>
      <p>
        Played with settings version <strong>{configVersion}</strong>.
      </p>
      <p>Home: {side(fixture.homeSlot)}</p>
      <p>Away: {side(fixture.awaySlot)}</p>
    </AdminNote>
  );
}
