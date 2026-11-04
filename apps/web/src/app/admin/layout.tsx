import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: { default: "Admin", template: "%s · Admin · LiterallyFantasySports" },
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/admin", label: "Overview" },
  { href: "/admin/settings", label: "Game settings" },
  { href: "/admin/templates", label: "Templates" },
  { href: "/admin/balance", label: "Balance" },
  { href: "/admin/tools", label: "Testing tools" },
  { href: "/admin/security", label: "Security" },
] as const;

export default function AdminLayout({ children }: LayoutProps<"/admin">) {
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <nav
        aria-label="Admin"
        className="flex flex-wrap items-center gap-4 text-sm"
      >
        <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
          Admin
        </span>
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className="hover:underline">
            {item.label}
          </Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
