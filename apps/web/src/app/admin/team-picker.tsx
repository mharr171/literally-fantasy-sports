"use client";

import { useRouter } from "next/navigation";
import { type SearchOption, SearchSelect } from "@/components/search-select";

/** Picks any club for the admin pages, searchable, with All / Real / AI tabs. */
export function TeamPicker({
  teams,
  value,
  hrefPrefix,
  label = "Team",
}: {
  teams: readonly SearchOption[];
  value?: string | null;
  /** Where choosing a club goes: this plus its id, e.g. "/admin/tools?team=". */
  hrefPrefix: string;
  label?: string;
}) {
  const router = useRouter();
  return (
    <SearchSelect
      label={label}
      options={teams}
      value={value}
      onSelect={(id) => router.push(`${hrefPrefix}${id}`)}
      filters={[
        { id: "real", label: "Real" },
        { id: "ai", label: "AI" },
      ]}
    />
  );
}
