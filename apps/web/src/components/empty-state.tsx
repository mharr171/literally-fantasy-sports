import Link from "next/link";
import type { ReactNode } from "react";

/** A friendly "nothing here yet" block with an optional next step (M6). */
export function EmptyState({
  title,
  children,
  action,
}: {
  title: string;
  children?: ReactNode;
  action?: { href: string; label: string };
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-zinc-300 p-6 text-sm dark:border-zinc-700">
      <p className="font-medium">{title}</p>
      {children && (
        <div className="text-zinc-600 dark:text-zinc-400">{children}</div>
      )}
      {action && (
        <Link
          href={action.href}
          className="mt-1 rounded-md bg-zinc-900 px-3 py-1.5 font-medium text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
        >
          {action.label}
        </Link>
      )}
    </div>
  );
}
