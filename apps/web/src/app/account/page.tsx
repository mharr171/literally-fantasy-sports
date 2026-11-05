import type { Metadata } from "next";
import { ThemePicker } from "./theme-picker";

export const metadata: Metadata = { title: "Account settings" };

/** Account settings: the theme for now (D133); more settings come later. */
export default function AccountPage() {
  return (
    <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">
          Account settings
        </h1>
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Theme</h2>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          System follows your computer&apos;s light or dark setting. Your choice
          is kept in this browser.
        </p>
        <ThemePicker />
      </div>
    </section>
  );
}
