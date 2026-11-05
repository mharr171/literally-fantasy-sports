import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";
import { ClubViewPanel } from "@/components/club-view";
import { adminView } from "@/lib/admin-view";
import { loadGhostClub } from "@/lib/club-view";
import { getSupabaseEnv } from "@/lib/supabase/env";

export const metadata: Metadata = { title: "Leaderboard entry" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** A finished season from the leaderboard, as it finished (D111). */
export default function LeaderboardEntryPage({
  params,
}: PageProps<"/leaderboard/[id]">) {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <Link href="/leaderboard" className="text-sm hover:underline">
        ← Leaderboard
      </Link>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Entry params={params} />
      </Suspense>
    </section>
  );
}

async function Entry({
  params,
}: Pick<PageProps<"/leaderboard/[id]">, "params">) {
  await connection();
  const { id } = await params;
  if (!UUID.test(id) || !getSupabaseEnv()) notFound();
  const club = await loadGhostClub(id, { admin: await adminView() });
  if (!club) notFound();
  return <ClubViewPanel club={club} />;
}
