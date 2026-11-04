"use client";

import { useState } from "react";
import { ClubColorPicker } from "@/components/club-color-picker";
import { setClubColors } from "./actions";
import { useAction } from "./use-action";

/** Change the club's colors later (D107). */
export function ClubColorsEditor({
  name,
  colors,
}: {
  name: string;
  colors: string[];
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(colors);
  const { error, pending, run } = useAction();
  if (!open)
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-sm underline"
      >
        {colors.length === 0 ? "Pick club colors" : "Change club colors"}
      </button>
    );
  return (
    <div className="flex w-full flex-col gap-2 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
      <ClubColorPicker value={value} onChange={setValue} name={name} />
      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending || value.length < 2}
          onClick={() =>
            run(async () => {
              const result = await setClubColors(value);
              if (result.ok) setOpen(false);
              return result;
            })
          }
          className="rounded-md bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-40 dark:bg-zinc-100 dark:text-zinc-900"
        >
          {pending ? "Saving…" : "Save colors"}
        </button>
        <button
          type="button"
          onClick={() => {
            setValue(colors);
            setOpen(false);
          }}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
