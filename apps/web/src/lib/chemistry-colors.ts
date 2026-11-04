/** Chemistry colours (D42) as players see them: a swatch, a name and a letter for colour-blind players. */
export const CHEMISTRY_COLORS = [
  { name: "Red", letter: "R", swatch: "bg-red-500", hex: "#ef4444" },
  { name: "Blue", letter: "B", swatch: "bg-sky-500", hex: "#0ea5e9" },
  { name: "Green", letter: "G", swatch: "bg-emerald-500", hex: "#10b981" },
  { name: "Yellow", letter: "Y", swatch: "bg-amber-400", hex: "#fbbf24" },
  { name: "Purple", letter: "P", swatch: "bg-violet-500", hex: "#8b5cf6" },
] as const;

export function chemistryColor(index: number) {
  return (
    CHEMISTRY_COLORS[index] ?? {
      name: "Unknown",
      letter: "?",
      swatch: "bg-zinc-400",
      hex: "#a1a1aa",
    }
  );
}
