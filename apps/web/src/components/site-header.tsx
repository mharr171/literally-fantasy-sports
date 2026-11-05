import { cookies } from "next/headers";
import Link from "next/link";
import { Suspense } from "react";
import { signOut } from "@/app/auth/actions";
import { ClubBadge } from "@/components/club-badge";
import { ADMIN_VIEW_COOKIE } from "@/lib/admin-view";
import { toggleAdminView } from "@/lib/admin-view-actions";
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
  const adminOn =
    user?.isAdmin === true &&
    (await cookies()).get(ADMIN_VIEW_COOKIE)?.value !== "off";

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
        <>
          <Link href="/admin" className="font-medium hover:underline">
            Admin
          </Link>
          <form action={toggleAdminView}>
            <button
              type="submit"
              title={
                adminOn
                  ? "Showing admin extras on public pages. Click to see pages as a player does."
                  : "Seeing pages as a player does. Click to show admin extras."
              }
              className={`rounded px-1.5 py-0.5 text-xs font-semibold ${adminOn ? "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300" : "border border-zinc-300 text-zinc-500 dark:border-zinc-700"}`}
            >
              {adminOn ? "Admin view on" : "Player view"}
            </button>
          </form>
        </>
      )}
      <Link
        href="/account"
        className="truncate text-zinc-600 hover:underline dark:text-zinc-400"
        title={`${user.email ?? ""} · account settings`}
      >
        {user.displayName}
      </Link>
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
