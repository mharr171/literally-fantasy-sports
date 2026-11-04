import { clubColorsFor } from "@lfs/core";

/**
 * A small striped badge in a club's colors (D107), shown next to its name.
 * Clubs without colors get a fixed pair from their name.
 */
export function ClubBadge({
  name,
  colors,
  size = "h-3.5 w-3.5",
}: {
  name: string;
  colors?: readonly string[] | null;
  size?: string;
}) {
  const palette = clubColorsFor(name, colors);
  const stops = palette
    .map((c, i) => {
      const from = (i / palette.length) * 100;
      const to = ((i + 1) / palette.length) * 100;
      return `${c.hex} ${from}% ${to}%`;
    })
    .join(", ");
  return (
    <span
      role="img"
      aria-label={`Club colors: ${palette.map((c) => c.name).join(", ")}`}
      title={palette.map((c) => c.name).join(" · ")}
      className={`inline-block shrink-0 rounded-sm align-middle ring-1 ring-zinc-300 dark:ring-zinc-600 ${size}`}
      style={{ background: `linear-gradient(90deg, ${stops})` }}
    />
  );
}
