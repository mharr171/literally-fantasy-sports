import type { ReactNode } from "react";

/** The admin-only color (D163): violet, so it never looks like game info. */
export const ADMIN_TEXT = "text-violet-700 dark:text-violet-300";

/** The small "Admin" label beside admin-only information (D163). */
export function AdminTag({ children }: { children?: ReactNode }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded bg-violet-100 px-1.5 py-0.5 text-[0.7rem] font-semibold uppercase tracking-wide dark:bg-violet-950 ${ADMIN_TEXT}`}
    >
      Admin
      {children && (
        <span className="font-medium normal-case tracking-normal">
          · {children}
        </span>
      )}
    </span>
  );
}

/** A block of admin-only information on a public page (D163). */
export function AdminNote({ children }: { children: ReactNode }) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-md border border-violet-300 bg-violet-50 p-3 text-sm dark:border-violet-800 dark:bg-violet-950/40 ${ADMIN_TEXT}`}
    >
      <div>
        <AdminTag />
      </div>
      {children}
    </div>
  );
}
