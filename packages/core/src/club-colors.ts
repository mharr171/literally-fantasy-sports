/**
 * Club colors (D107): each club shows 2 or 3 colors from a fixed palette.
 * Display only, and completely separate from chemistry colors. Clubs that
 * haven't picked any (AI clubs, ghosts, clubs from before) get a fixed pair
 * worked out from their name, so every club has a look.
 */
import { createRng } from "./rng";

export interface ClubColor {
  key: string;
  name: string;
  hex: string;
}

/** The palette, in the order the picker shows it. */
export const CLUB_COLORS: readonly ClubColor[] = [
  { key: "red", name: "Red", hex: "#dc2626" },
  { key: "maroon", name: "Maroon", hex: "#7f1d1d" },
  { key: "orange", name: "Orange", hex: "#ea580c" },
  { key: "gold", name: "Gold", hex: "#eab308" },
  { key: "green", name: "Green", hex: "#16a34a" },
  { key: "teal", name: "Teal", hex: "#0d9488" },
  { key: "sky", name: "Sky blue", hex: "#38bdf8" },
  { key: "blue", name: "Blue", hex: "#2563eb" },
  { key: "navy", name: "Navy", hex: "#1e3a8a" },
  { key: "purple", name: "Purple", hex: "#7c3aed" },
  { key: "pink", name: "Pink", hex: "#ec4899" },
  { key: "white", name: "White", hex: "#f8fafc" },
  { key: "grey", name: "Grey", hex: "#6b7280" },
  { key: "black", name: "Black", hex: "#111827" },
];

export const CLUB_COLORS_MIN = 2;
export const CLUB_COLORS_MAX = 3;

const BY_KEY = new Map(CLUB_COLORS.map((c) => [c.key, c]));

export function clubColor(key: string): ClubColor | undefined {
  return BY_KEY.get(key);
}

/** Why a set of club colors isn't allowed, or null when it's fine. */
export function clubColorsError(keys: readonly string[]): string | null {
  if (keys.length < CLUB_COLORS_MIN || keys.length > CLUB_COLORS_MAX)
    return `Pick ${CLUB_COLORS_MIN} or ${CLUB_COLORS_MAX} club colors.`;
  if (new Set(keys).size !== keys.length)
    return "Each club color can only be used once.";
  if (keys.some((k) => !BY_KEY.has(k))) return "That isn't one of the colors.";
  return null;
}

/**
 * A club's colors: its own when it has picked valid ones, otherwise a
 * fixed pair from its name (the same name always gets the same pair).
 */
export function clubColorsFor(
  name: string,
  picked: readonly string[] | null | undefined,
): ClubColor[] {
  if (picked && clubColorsError(picked) === null)
    return picked.map((k) => BY_KEY.get(k) as ClubColor);
  const rng = createRng(`club-colors:${name.toLowerCase()}`);
  const [first, second] = rng.shuffle([...CLUB_COLORS]);
  return [first as ClubColor, second as ClubColor];
}
