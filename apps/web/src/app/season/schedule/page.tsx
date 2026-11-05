import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { ScheduleView } from "@/components/schedule-view";
import { getCurrentUser } from "@/lib/auth";
import { loadSchedule } from "@/lib/club-view";

export const metadata: Metadata = { title: "Schedule" };

/** Every fixture of the season with each opponent's chemistry colors (D139). */
export default function SchedulePage() {
  return (
    <section className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <Link href="/season" className="text-sm hover:underline">
        ← Season
      </Link>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <ScheduleContent />
      </Suspense>
    </section>
  );
}

async function ScheduleContent() {
  const user = await getCurrentUser();
  if (!user) redirect("/sign-in");
  const schedule = await loadSchedule(user.id);
  if (!schedule)
    return (
      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        Start a season to see your schedule.
      </p>
    );
  return <ScheduleView schedule={schedule} />;
}
