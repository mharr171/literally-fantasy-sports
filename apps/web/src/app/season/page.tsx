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
import { WithTemplates } from "@/components/player/with-templates";
import { getCurrentUser } from "@/lib/auth";
import { scoutPlayer } from "@/lib/scouting";
import {
  liveGenerationSettings,
  liveSoccerConfig,
  loadLatestSeason,
  type SeasonReview,
} from "@/lib/season";
import { loadEnergySettings } from "@/lib/sport-settings";
import {
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
          You&apos;ll play 7 AI clubs home and away over 14 weeks, from 300 Elo
          below yours to 300 above. The top 4 go into the playoffs. Every match
          pays {money(payouts.perMatch)}, plus {money(payouts.win)} for a win or{" "}
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
  if (season.status !== "finished") {
    const [roster, squad] = await Promise.all([
      loadRoster(team.id),
      loadSquad(team.id),
    ]);
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
      notice={notice}
      morale={team.morale}
      energy={
        energyNow && {
          energy: energyNow.energy,
          max: energySettings.max,
          nextAt: energyNow.nextAt?.toISOString() ?? null,
        }
      }
      season={season}
      teamName={team.name}
      elo={team.elo}
      funds={team.funds}
      wrapUp={wrapUp}
    />
  );
}

function Review({ review }: { review: SeasonReview }) {
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
