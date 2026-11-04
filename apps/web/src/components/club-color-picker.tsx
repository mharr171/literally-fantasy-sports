"use client";

import { CLUB_COLORS, CLUB_COLORS_MAX, CLUB_COLORS_MIN } from "@lfs/core";
import { ClubBadge } from "./club-badge";

/**
 * Pick 2 or 3 club colors (D107), main color first. Clicking a color adds
 * it; clicking a picked one removes it. Picked colors are also sent with the
 * form as hidden `colors` fields.
 */
export function ClubColorPicker({
  value,
  onChange,
  name = "",
}: {
  value: string[];
  onChange: (colors: string[]) => void;
  /** The club name, for the preview badge. */
  name?: string;
}) {
  const toggle = (key: string) =>
    onChange(
      value.includes(key)
        ? value.filter((k) => k !== key)
        : value.length < CLUB_COLORS_MAX
          ? [...value, key]
          : value,
    );
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium">Club colors</legend>
      <p className="text-xs text-zinc-500">
        Pick {CLUB_COLORS_MIN} or {CLUB_COLORS_MAX}, main color first. Just for
        show: chemistry colors are separate.
      </p>
      <div className="flex flex-wrap gap-2">
        {CLUB_COLORS.map((c) => {
          const at = value.indexOf(c.key);
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => toggle(c.key)}
              aria-pressed={at >= 0}
              title={c.name}
              className={`relative h-8 w-8 rounded-full ring-1 ring-zinc-300 dark:ring-zinc-600 ${at >= 0 ? "outline outline-2 outline-offset-2 outline-zinc-900 dark:outline-zinc-100" : ""}`}
              style={{ background: c.hex }}
            >
              <span className="sr-only">{c.name}</span>
              {at >= 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-zinc-900 text-[10px] font-bold text-white dark:bg-zinc-100 dark:text-zinc-900">
                  {at + 1}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <p className="flex items-center gap-2 text-sm">
        {value.length >= CLUB_COLORS_MIN ? (
          <>
            <ClubBadge name={name} colors={value} size="h-5 w-8" />
            <span>
              {value
                .map((k) => CLUB_COLORS.find((c) => c.key === k)?.name)
                .join(", ")}
            </span>
          </>
        ) : (
          <span className="text-zinc-500">
            {value.length === 0
              ? "No colors picked yet."
              : "Pick at least one more."}
          </span>
        )}
      </p>
      {value.map((k) => (
        <input key={k} type="hidden" name="colors" value={k} />
      ))}
    </fieldset>
  );
}
