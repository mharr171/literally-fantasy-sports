import "server-only";
import { sportUi } from "@/sports/registry";
import { loadMyClubs } from "./team";

/**
 * The manager's club in another sport, to copy its name and colors when
 * starting one in `sport` (D192), or undefined when there is none.
 */
export async function otherClub(
  ownerId: string,
  sport: string,
): Promise<{ sportName: string; name: string; colors: string[] } | undefined> {
  const other = (await loadMyClubs(ownerId)).find((c) => c.sport !== sport);
  if (!other) return undefined;
  return {
    sportName: sportUi(other.sport)?.name.toLowerCase() ?? other.sport,
    name: other.name,
    colors: other.colors,
  };
}
