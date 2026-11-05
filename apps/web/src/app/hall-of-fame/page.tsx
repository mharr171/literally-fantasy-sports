import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { AdminTag } from "@/components/admin-note";
import { ClubBadge } from "@/components/club-badge";
import { EmptyState } from "@/components/empty-state";
import { adminView } from "@/lib/admin-view";
import { type ClubOrigin, loadClubOrigins } from "@/lib/club-view";
import {
  type HallClub,
  type HallPlayer,
  loadGlobalHallOfFame,
  PLAYER_LISTS,
} from "@/lib/hall-of-fame";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Hall of fame" };

/** The best clubs and players of all time (D121, ADR 0005). */
export default function HallOfFamePage() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Hall of fame</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          The clubs and players of all time in soccer, current and retired
          together. Players count only their own club&apos;s matches.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Hall />
      </Suspense>
    </section>
  );
}

async function Hall() {
  await connection();
  if (!getSupabaseEnv())
    return <p className="text-sm text-zinc-500">No seasons yet.</p>;
  const [hall, admin] = await Promise.all([
    loadGlobalHallOfFame(),
    adminView(),
  ]);
  if (hall.clubs.elo.length === 0)
    return (
      <EmptyState
        title="No finished seasons yet."
        action={{ href: "/season", label: "Play a season" }}
      >
        Finish a season and your club joins the hall of fame.
      </EmptyState>
    );
  // Admins can always tell real clubs from AI ones (D163).
  const origins = admin
    ? await loadClubOrigins([
        ...Object.values(hall.clubs).flatMap((l) => l.map((c) => c.teamId)),
        ...Object.values(hall.players).flatMap((l) =>
          l.flatMap((p) => (p.teamId ? [p.teamId] : [])),
        ),
      ])
    : null;
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Clubs</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <ClubList
            title="Most titles"
            rows={hall.clubs.titles}
            unit="🏆"
            origins={origins}
          />
          <ClubList
            title="Highest Elo"
            rows={hall.clubs.elo}
            origins={origins}
          />
          <ClubList
            title="Most seasons"
            rows={hall.clubs.seasons}
            origins={origins}
          />
        </div>
      </div>
      <div className="flex flex-col gap-3">
        <h2 className="text-2xl font-semibold tracking-tight">Players</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {PLAYER_LISTS.filter(({ key }) => hall.players[key].length > 0).map(
            ({ key, label }) => (
              <PlayerList
                key={key}
                title={label}
                rows={hall.players[key]}
                origins={origins}
              />
            ),
          )}
        </div>
      </div>
    </div>
  );
}

function Origin({
  origins,
  teamId,
}: {
  origins: Map<string, ClubOrigin> | null;
  teamId: string | null;
}) {
  if (!origins || !teamId) return null;
  return <AdminTag>{origins.get(teamId)?.real ? "Real" : "AI"}</AdminTag>;
}

function ClubList({
  title,
  rows,
  unit,
  origins,
}: {
  title: string;
  rows: HallClub[];
  unit?: string;
  origins: Map<string, ClubOrigin> | null;
}) {
  return (
    <div className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
      <h3 className="mb-1 font-semibold">{title}</h3>
      {rows.length === 0 && <p className="text-zinc-500">None yet.</p>}
      <ol className="flex flex-col gap-0.5">
        {rows.map((c, i) => {
          const name = (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <ClubBadge name={c.name} colors={c.colors} />
              <span className="truncate">{c.name}</span>
            </span>
          );
          return (
            <li
              key={c.teamId}
              className="flex items-center justify-between gap-2"
            >
              <span className="flex min-w-0 items-center gap-1.5">
                <span className="w-5 shrink-0 text-right tabular-nums text-zinc-500">
                  {i + 1}
                </span>
                {c.hasGhost ? (
                  <Link
                    href={`/leaderboard/${c.teamId}`}
                    className="min-w-0 hover:underline"
                    title="See its best season"
                  >
                    {name}
                  </Link>
                ) : (
                  name
                )}
                <Origin origins={origins} teamId={c.teamId} />
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                {unit ? `${unit} ${c.value}` : c.value}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function PlayerList({
  title,
  rows,
  origins,
}: {
  title: string;
  rows: HallPlayer[];
  origins: Map<string, ClubOrigin> | null;
}) {
  return (
    <div className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800">
      <h3 className="mb-1 font-semibold">{title}</h3>
      <ol className="flex flex-col gap-0.5">
        {rows.map((p, i) => (
          <li key={p.id} className="flex justify-between gap-2">
            <span className="min-w-0">
              <span className="mr-1.5 tabular-nums text-zinc-500">{i + 1}</span>
              {p.name}{" "}
              <span className="text-xs text-zinc-500">
                {p.position} · {p.club}
                {p.retired ? " · retired" : ""}
              </span>{" "}
              <Origin origins={origins} teamId={p.teamId} />
            </span>
            <span className="shrink-0 font-semibold tabular-nums">
              {p.value}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
