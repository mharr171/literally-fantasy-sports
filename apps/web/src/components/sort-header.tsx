"use client";

import type { SortDir, SortState } from "@/lib/table-sort";

/** A table header that sorts by its column when clicked (M7). */
export function SortHeader<K extends string>({
  label,
  column,
  sort,
  onSort,
  firstDir = "desc",
  align = "left",
  title,
}: {
  label: string;
  column: K;
  sort: SortState<K>;
  onSort: (column: K, firstDir: SortDir) => void;
  firstDir?: SortDir;
  align?: "left" | "right";
  title?: string;
}) {
  const active = sort.key === column;
  return (
    <th
      className={`px-3 py-2 ${align === "right" ? "text-right" : ""}`}
      aria-sort={
        active ? (sort.dir === "asc" ? "ascending" : "descending") : "none"
      }
    >
      <button
        type="button"
        onClick={() => onSort(column, firstDir)}
        title={title ?? `Sort by ${label.toLowerCase()}`}
        className={`inline-flex items-center gap-0.5 uppercase tracking-wide hover:text-zinc-900 dark:hover:text-zinc-100 ${active ? "text-zinc-900 dark:text-zinc-100" : ""}`}
      >
        {label}
        <span aria-hidden="true" className="w-3 text-[0.65rem]">
          {active ? (sort.dir === "asc" ? "▲" : "▼") : ""}
        </span>
      </button>
    </th>
  );
}
