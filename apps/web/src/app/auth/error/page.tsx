import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Sign-in problem" };

export default function AuthErrorPage() {
  return (
    <section className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-4 px-4 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">
        That sign-in didn&apos;t work
      </h1>
      <p className="text-zinc-600 dark:text-zinc-400">
        The link may have expired or already been used, or it was opened in a
        different browser. Request a new one and open it on the same device.
      </p>
      <Link
        href="/sign-in"
        className="self-start rounded-md bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        Back to sign in
      </Link>
    </section>
  );
}
