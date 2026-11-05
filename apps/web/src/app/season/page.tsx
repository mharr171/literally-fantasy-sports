import { currentEnergy } from "@lfs/core";
import {
  availableSquad,
  FRESH,
  isAvailable,
  youthIntake,
} from "@lfs/sport-soccer";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FormationMoved } from "@/components/formation-moved";
import { GettingStarted } from "@/components/getting-started";
import { WithTemplates } from "@/components/player/with-templates";
import { SeasonReviewPanel as Review } from "@/components/season-review";
import { adminView } from "@/lib/admin-view";
import { getCurrentUser } from "@/lib/auth";
import { loadClubOrigins } from "@/lib/club-view";
import { scoutPlayer } from "@/lib/scouting";
import {
  liveGenerationSettings,
  liveSoccerConfig,
  loadLatestSeason,
} from "@/lib/season";
import { loadEnergySettings } from "@/lib/sport-settings";
import {
  loadMovedFrom,
  loadMyTeam,
  loadRoster,
  loadSquad,
  loadStarterPacks,
} from "@/lib/team";
import { StartSeasonButton } from "./season-buttons";
import { SeasonView } from "./season-view";
import { EndSeasonButton, YouthIntake } from "./wrap-up";

export const metadata: Metadata = { title: "Season" };

export default function SeasonPage() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <Suspense fallback={null}>
        <GettingStarted />
      </Suspense>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <WithTemplates>
          <SeasonContent />
        </WithTemplates>
      </Suspense>
    </section>
  );
}

async function SeasonContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const team = await loadMyTeam(user.id);
  if (!team) redirect("/team");
  const packs = await loadStarterPacks(team.id);
  if (packs.some((p) => !p.resolved)) redirect("/team");
  const season = await loadLatestSeason(team.id);

  if (!season) {
    const { payouts } = (await liveSoccerConfig()).balance;
    const money = (n: number) => n.toLocaleString("en-US");
    return (
      <div className="flex max-w-xl flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Season 1</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          You&apos;ll play 11 clubs home and away over 22 weeks, from 300 Elo
          below yours to 300 above. The top 7 go into the quarter-finals, and
          8th and 9th play off for the last place. Every match pays{" "}
          {money(payouts.perMatch)}, plus {money(payouts.win)} for a win or{" "}
          {money(payouts.draw)} for a draw.
        </p>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Your saved{" "}
          <Link href="/team/squad" className="underline">
            matchday squad
          </Link>{" "}
          plays every match, so set it up first.
        </p>
        <StartSeasonButton number={1} />
      </div>
    );
  }

  let wrapUp: React.ReactNode = null;
  if (season.status === "finished") {
    if (!season.closed) {
      wrapUp = (
        <div className="mt-3 flex flex-col gap-2 text-sm">
          <p className="text-zinc-600 dark:text-zinc-400">
            End the season to move on: every player gets a year older, young
            players grow toward their potential, older ones decline and some
            retire. Then the youth intake opens.
          </p>
          <EndSeasonButton />
        </div>
      );
    } else if (!season.intakeResolved) {
      const roster = await loadRoster(team.id);
      wrapUp = (
        <div className="mt-3 flex flex-col gap-4">
          {season.review && <Review review={season.review} />}
          <YouthIntake
            prospects={youthIntake(
              season.seed,
              undefined,
              await liveGenerationSettings(),
            ).map(scoutPlayer)}
            rosterSize={roster.length}
          />
        </div>
      );
    } else {
      wrapUp = (
        <div className="mt-3 flex flex-col gap-3 text-sm">
          <p className="text-zinc-600 dark:text-zinc-400">
            Season {season.number} is wrapped up. Check your{" "}
            <Link href="/team/squad" className="underline">
              matchday squad
            </Link>{" "}
            (retired players leave it) and your roster size, then start the next
            one.
          </p>
          <StartSeasonButton number={season.number + 1} />
        </div>
      );
    }
  }

  const energySettings = await loadEnergySettings("soccer");
  const energyNow = energySettings.enabled
    ? currentEnergy(
        { energy: team.energy, updatedAt: new Date(team.energyUpdatedAt) },
        new Date(),
        energySettings,
      )
    : null;

  let notice: React.ReactNode = null;
  let moved: React.ReactNode = null;
  if (season.status !== "finished") {
    const [roster, squad, movedFrom] = await Promise.all([
      loadRoster(team.id),
      loadSquad(team.id),
      loadMovedFrom(team.id),
    ]);
    if (squad && movedFrom)
      moved = <FormationMoved from={movedFrom} to={squad.formation} />;
    const out = roster.filter((p) => !isAvailable(p.condition));
    if (squad && out.length > 0) {
      const name = new Map(roster.map((p) => [p.id, p.displayName]));
      let swaps: { out: string; in: string }[] = [];
      let short = false;
      try {
        swaps = availableSquad(squad, roster, (id) =>
          isAvailable(roster.find((p) => p.id === id)?.condition ?? FRESH),
        ).replaced;
      } catch {
        short = true;
      }
      notice = (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-800 dark:bg-amber-950/40">
          <p className="font-medium">
            Unavailable this week:{" "}
            {out
              .map(
                (p) =>
                  `${p.displayName} (${p.condition.injuredWeeks > 0 ? `injured ${p.condition.injuredWeeks}w` : "suspended"})`,
              )
              .join(", ")}
          </p>
          {short ? (
            <p className="text-red-700 dark:text-red-400">
              Fewer than 11 players can play. Buy a pack or take youth players
              to fill the squad.
            </p>
          ) : (
            swaps.length > 0 && (
              <p className="text-zinc-700 dark:text-zinc-300">
                Stepping in:{" "}
                {swaps
                  .map((s) => `${name.get(s.in)} for ${name.get(s.out)}`)
                  .join(", ")}
                . Change it in your{" "}
                <Link href="/team/squad" className="underline">
                  matchday squad
                </Link>
                .
              </p>
            )
          )}
        </div>
      );
    }
  }

  return (
    <SeasonView
      adminLabels={await seasonAdminLabels(season)}
      notice={
        moved || notice ? (
          <>
            {moved}
            {notice}
          </>
        ) : null
      }
      morale={team.morale}
      skipIdleWeeks={team.skipIdleWeeks}
      energy={
        energyNow && {
          energy: energyNow.energy,
          max: energySettings.max,
          nextAt: energyNow.nextAt?.toISOString() ?? null,
        }
      }
      season={season}
      teamName={team.name}
      teamColors={team.colors}
      elo={team.elo}
      funds={team.funds}
      wrapUp={wrapUp}
    />
  );
}

/** Admins can always tell real clubs from AI ones (D163). */
async function seasonAdminLabels(
  season: NonNullable<Awaited<ReturnType<typeof loadLatestSeason>>>,
): Promise<Record<number, string> | undefined> {
  if (!(await adminView())) return undefined;
  const origins = await loadClubOrigins(
    season.slots.flatMap((s) => (s.ghostId ? [s.ghostId] : [])),
  );
  return Object.fromEntries(
    season.slots.map((s) => [
      s.slot,
      s.kind === "manager"
        ? "You"
        : s.kind === "ai"
          ? "AI, made for this league"
          : s.ghostId
            ? (origins.get(s.ghostId)?.label ?? "Club deleted")
            : "Copy gone, plays as AI",
    ]),
  );
}
