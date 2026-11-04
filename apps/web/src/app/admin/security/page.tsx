import type { Metadata } from "next";
import { Suspense } from "react";
import { adminNextPath } from "@/lib/admin-path";
import { requireAdminAccount } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { SecurityPanel } from "./security-panel";

export const metadata: Metadata = { title: "Security" };

export default function SecurityPage({
  searchParams,
}: PageProps<"/admin/security">) {
  return (
    <section className="flex max-w-xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">
          Two-factor sign-in
        </h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Admin pages need a code from an authenticator app (such as Google
          Authenticator, 1Password or Authy) each time you sign in, on top of
          your Google or email sign-in. Without it, nobody can change game
          settings, even with your password or email.
        </p>
      </div>
      <Suspense fallback={<p className="text-sm text-zinc-500">Loading…</p>}>
        <Panel searchParams={searchParams} />
      </Suspense>
    </section>
  );
}

async function Panel({
  searchParams,
}: Pick<PageProps<"/admin/security">, "searchParams">) {
  const profile = await requireAdminAccount();
  const params = await searchParams;
  const next = adminNextPath(
    Array.isArray(params.next) ? params.next[0] : params.next,
  );
  const { data, error } = await (await createClient()).auth.mfa.listFactors();
  if (error) throw new Error(error.message);
  return (
    <SecurityPanel
      twoFactor={profile.twoFactor}
      next={next}
      factors={data.totp.map((f) => ({
        id: f.id,
        name: f.friendly_name ?? "Authenticator app",
      }))}
    />
  );
}
