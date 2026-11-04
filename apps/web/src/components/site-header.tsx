import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/auth/actions";
import { ClubBadge } from "@/components/club-badge";
import { getCurrentProfile } from "@/lib/auth";
import { loadMyTeam } from "@/lib/team";

export function SiteHeader() {
  return (
    <header className="border-b border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="text-lg font-semibold tracking-tight">
            LiterallyFantasySports
          </Link>
          <Link
            href="/leaderboard"
            className="hidden text-sm font-medium hover:underline sm:inline"
          >
            Leaderboard
          </Link>
        </div>
        <Suspense fallback={<span className="h-8" />}>
          <AccountMenu />
        </Suspense>
      </div>
    </header>
  );
}

async function AccountMenu() {
  const user = await getCurrentProfile();
  const team = user ? await loadMyTeam(user.id) : null;

  if (!user) {
    return (
      <Link
        href="/sign-in"
        className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-3 text-sm">
      <Link
        href="/team"
        className="inline-flex items-center gap-1.5 font-medium hover:underline"
      >
        {team && <ClubBadge name={team.name} colors={team.colors} />}
        My team
      </Link>
      <Link href="/season" className="font-medium hover:underline">
        Season
      </Link>
      {user.isAdmin && (
        <Link href="/admin" className="font-medium hover:underline">
          Admin
        </Link>
      )}
      <span
        className="truncate text-zinc-600 dark:text-zinc-400"
        title={user.email ?? undefined}
      >
        {user.displayName}
      </span>
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-md border border-zinc-300 px-3 py-1.5 font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Sign out
        </button>
      </form>
    </div>
  );
}
