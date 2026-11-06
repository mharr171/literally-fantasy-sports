import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ClubBadge } from "@/components/club-badge";
import { CreateClubForm } from "@/components/create-club-form";
import { getCurrentUser } from "@/lib/auth";
import { otherClub } from "@/lib/other-club";
import { loadSportSwitches } from "@/lib/sport-settings";
import { sportModule } from "@/lib/sports";
import { loadMyTeam } from "@/lib/team";
import { createBaseballClub } from "./actions";

export const metadata: Metadata = { title: "Baseball" };

/**
 * Baseball while it's being built (ADR 0007 §12): only admins can reach it
 * until its Public switch is on. It plays a stand-in game to show the
 * second sport runs through the shared registry; M17 brings the real one.
 */
export default function BaseballTeamPage() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 px-4 py-8 sm:px-6">
      <h1 className="text-3xl font-semibold tracking-tight">⚾ Baseball</h1>
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Baseball is being built. Clubs, squads and seasons arrive with M17 and
        M18; for now this page plays a stand-in game through the same sport
        registry the real engine will use.
      </p>
      <Suspense fallback={null}>
        <Status />
      </Suspense>
      <Suspense fallback={null}>
        <Club />
      </Suspense>
      <StandInGame />
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
        intro="Name your baseball club and pick its colors. Players, squads and seasons come with M17 and M18."
        submitLabel="Create baseball club"
        copyFrom={await otherClub(user.id, "baseball")}
      />
    );
  return (
    <p className="flex items-center gap-2 text-sm">
      Your club: <ClubBadge name={team.name} colors={team.colors} />
      <strong>{team.name}</strong>
    </p>
  );
}

function StandInGame() {
  const { engine } = sportModule("baseball");
  const team = (name: string) => ({
    name,
    battingOrder: Array.from({ length: 9 }, (_, i) => `${name} ${i + 1}`),
  });
  const { result, events } = engine.simulate(
    {
      home: team("Home"),
      away: team("Away"),
      mode: "league",
      config: {},
    },
    "baseball-stand-in",
  );
  const innings = events.length / 2;
  return (
    <div className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">
      <h2 className="font-semibold">A stand-in game</h2>
      <p className="tabular-nums">
        Home {result.score.home} – {result.score.away} Away, after {innings}{" "}
        innings
        {result.decidedBy === "extra_innings" ? " (extra innings)" : ""}.
      </p>
    </div>
  );
}
