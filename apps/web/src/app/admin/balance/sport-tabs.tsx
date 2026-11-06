import Link from "next/link";

/** Switches the balance editor between sports (ADR 0007 §7). */
export function SportTabs({ current }: { current: "soccer" | "baseball" }) {
  const tab = (sport: "soccer" | "baseball", label: string, href: string) => (
    <Link
      href={href}
      aria-current={current === sport ? "page" : undefined}
      className={`rounded-md px-3 py-1 text-sm font-medium ${
        current === sport
          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
          : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      }`}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Sport" className="flex gap-2">
      {tab("soccer", "⚽ Soccer", "/admin/balance")}
      {tab("baseball", "⚾ Baseball", "/admin/balance/baseball")}
    </nav>
  );
}
