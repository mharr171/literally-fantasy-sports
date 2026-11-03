import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-3 px-4 py-6 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between sm:px-6 dark:text-zinc-400">
        <p>© 2026 LiterallyFantasySports</p>
        <nav aria-label="Legal" className="flex gap-4">
          <Link className="hover:underline" href="/privacy-policy">
            Privacy policy
          </Link>
          <Link className="hover:underline" href="/terms-of-service">
            Terms of service
          </Link>
          <a
            className="hover:underline"
            href="mailto:admin@literallyfantasysports.com"
          >
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}
