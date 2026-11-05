"use client";

import { useEffect, useState } from "react";
import { isDark, isTheme, THEME_KEY, type Theme } from "@/lib/theme";

const CHOICES: { value: Theme; label: string }[] = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

/** Light / Dark / System (D133), kept in this browser and applied at once. */
export function ThemePicker() {
  const [theme, setTheme] = useState<Theme>("system");
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (isTheme(saved)) setTheme(saved);
    } catch {
      // Storage blocked: stay on System.
    }
  }, []);

  const choose = (next: Theme) => {
    setTheme(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      // Storage blocked: the choice lasts until the page is closed.
    }
    const systemDark = window.matchMedia(
      "(prefers-color-scheme: dark)",
    ).matches;
    document.documentElement.classList.toggle("dark", isDark(next, systemDark));
  };

  return (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="sr-only">Theme</legend>
      {CHOICES.map((c) => (
        <label
          key={c.value}
          className={`cursor-pointer rounded-md border px-3 py-1.5 text-sm font-medium ${
            theme === c.value
              ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900"
              : "border-zinc-300 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          }`}
        >
          <input
            type="radio"
            name="theme"
            value={c.value}
            checked={theme === c.value}
            onChange={() => choose(c.value)}
            className="sr-only"
          />
          {c.label}
        </label>
      ))}
    </fieldset>
  );
}
