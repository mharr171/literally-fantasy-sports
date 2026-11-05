"use client";

import { useId, useMemo, useRef, useState } from "react";

export interface SearchOption {
  value: string;
  label: string;
  /** A short note after the label, e.g. "(you)". */
  hint?: string;
  /** Which filter tab it belongs to, e.g. "real" or "ai". */
  group?: string;
}

/**
 * One searchable dropdown for long lists (D133): type to filter, arrow keys
 * to move, Enter to choose, Escape to close. Optional filter tabs narrow
 * the list by group, e.g. All / Real / AI.
 */
export function SearchSelect({
  options,
  value,
  onSelect,
  label,
  placeholder = "Type to search…",
  filters,
}: {
  options: readonly SearchOption[];
  value?: string | null;
  onSelect: (value: string) => void;
  label: string;
  placeholder?: string;
  filters?: readonly { id: string; label: string }[];
}) {
  const id = useId();
  const listId = `${id}-list`;
  const input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [filter, setFilter] = useState("all");
  const selected = options.find((o) => o.value === value);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options.filter(
      (o) =>
        (filter === "all" || o.group === filter) &&
        (q === "" || o.label.toLowerCase().includes(q)),
    );
  }, [options, query, filter]);
  const choose = (o: SearchOption) => {
    onSelect(o.value);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="relative flex w-full max-w-sm flex-col gap-1 text-sm">
      <label htmlFor={`${id}-input`} className="font-medium">
        {label}
      </label>
      {filters && (
        <fieldset className="flex gap-1">
          <legend className="sr-only">Filter</legend>
          {[{ id: "all", label: "All" }, ...filters].map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => {
                setFilter(f.id);
                setActive(0);
                input.current?.focus();
                setOpen(true);
              }}
              className={`rounded px-2 py-0.5 text-xs ${
                filter === f.id
                  ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                  : "border border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
              }`}
            >
              {f.label}
            </button>
          ))}
        </fieldset>
      )}
      <input
        ref={input}
        id={`${id}-input`}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={
          open && shown[active] ? `${id}-opt-${active}` : undefined
        }
        autoComplete="off"
        value={query}
        placeholder={selected ? selected.label : placeholder}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, shown.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
          } else if (e.key === "Enter") {
            const o = shown[active];
            if (open && o) {
              e.preventDefault();
              choose(o);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="rounded-md border border-zinc-300 bg-[var(--background)] px-2 py-1.5 placeholder:text-zinc-500 dark:border-zinc-700"
      />
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label={label}
          className="absolute top-full z-20 mt-1 max-h-72 w-full overflow-auto rounded-md border border-zinc-300 bg-[var(--background)] py-1 shadow-lg dark:border-zinc-700"
        >
          {shown.length === 0 && (
            <p className="px-3 py-1.5 text-zinc-500">No matches.</p>
          )}
          {shown.map((o, i) => (
            <div
              key={o.value}
              id={`${id}-opt-${i}`}
              role="option"
              tabIndex={-1}
              aria-selected={o.value === value}
              // Mouse down, not click, so the input's blur doesn't close it first.
              onMouseDown={(e) => {
                e.preventDefault();
                choose(o);
              }}
              onMouseEnter={() => setActive(i)}
              className={`cursor-pointer px-3 py-1.5 ${i === active ? "bg-zinc-100 dark:bg-zinc-800" : ""} ${o.value === value ? "font-semibold" : ""}`}
            >
              {o.label}
              {o.hint && <span className="text-zinc-500"> {o.hint}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
