import { youthIntake } from "@lfs/sport-soccer";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getCurrentUser } from "@/lib/auth";
import { scoutPlayer } from "@/lib/scouting";
import { loadLatestSeason, type SeasonReview } from "@/lib/season";
import { loadMyTeam, loadRoster, loadStarterPacks } from "@/lib/team";
import { StartSeasonButton } from "./season-buttons";
import { SeasonView } from "./season-view";
import { EndSeasonButton, YouthIntake } from "./wrap-up";

export const metadata: Metadata = { title: "Season" };

export default function SeasonPage() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <SeasonContent />
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
    return (
      <div className="flex max-w-xl flex-col gap-4">
        <h1 className="text-3xl font-semibold tracking-tight">Season 1</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          You&apos;ll play 7 AI clubs home and away over 14 weeks, from 300 Elo
          below yours to 300 above. The top 4 go into the playoffs. Every match
          pays 1,000, plus 500 for a win or 200 for a draw.
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
            prospects={youthIntake(season.seed).map(scoutPlayer)}
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

  return (
    <SeasonView
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
