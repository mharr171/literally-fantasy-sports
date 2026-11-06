import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { ClubViewPanel } from "@/components/club-view";
import { adminView } from "@/lib/admin-view";
import { getCurrentUser } from "@/lib/auth";
import { loadLeagueClub } from "@/lib/club-view";

export const metadata: Metadata = { title: "Club" };

/** A club in your league (D111): its roster, squad and chemistry colors. */
export default function LeagueClubPage({
  params,
}: PageProps<"/soccer/season/club/[slot]">) {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <Link href="/soccer/season" className="text-sm hover:underline">
        ← Season
      </Link>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Club params={params} />
      </Suspense>
    </section>
  );
}

async function Club({
  params,
}: Pick<PageProps<"/soccer/season/club/[slot]">, "params">) {
  const { slot: raw } = await params;
  const slot = Number(raw);
  if (!/^\d{1,2}$/.test(raw) || !Number.isInteger(slot)) notFound();
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const club = await loadLeagueClub(user.id, slot, {
    admin: await adminView(),
  });
  if (!club) notFound();
  return <ClubViewPanel club={club} />;
}
