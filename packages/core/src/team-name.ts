/**
 * Team names, for every sport. Names are unique per sport ignoring case (the
 * database enforces that); this checks the shape before it gets there.
 */
export const TEAM_NAME_MIN = 3;
export const TEAM_NAME_MAX = 30;

// Letters (any language), digits, spaces and a little punctuation.
const ALLOWED = /^[\p{L}\p{M}\p{N} .'&-]+$/u;

/** Trims the name and collapses runs of spaces. */
export function normalizeTeamName(name: string): string {
  return name.normalize("NFC").trim().replace(/\s+/g, " ");
}

/** Why a (normalized) team name is not allowed, or null when it's fine. */
export function teamNameError(name: string): string | null {
  const length = [...name].length;
  if (length < TEAM_NAME_MIN)
    return `Use at least ${TEAM_NAME_MIN} characters.`;
  if (length > TEAM_NAME_MAX) return `Use at most ${TEAM_NAME_MAX} characters.`;
  if (!ALLOWED.test(name))
    return "Use letters, numbers, spaces and . ' & - only.";
  if (!/[\p{L}\p{N}]/u.test(name)) return "Include a letter or number.";
  return null;
}
