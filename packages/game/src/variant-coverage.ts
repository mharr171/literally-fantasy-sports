/**
 * How many players still use the default heatmap (D132), for the admin
 * overview. Real and AI clubs count alike.
 */
import { createServiceClient } from "./db";
import { SOCCER } from "./team";

export interface VariantCoverage {
  players: number;
  /** Players on the default template at their primary position. */
  defaultPrimary: number;
  /** Players with a secondary position. */
  withSecondary: number;
  /** Of those, how many are on the default template there. */
  defaultSecondary: number;
}

export async function loadVariantCoverage(): Promise<VariantCoverage> {
  const db = createServiceClient();
  const count = async (
    filter: (q: ReturnType<typeof base>) => ReturnType<typeof base>,
  ) => {
    const { count, error } = await filter(base());
    if (error) throw new Error(error.message);
    return count ?? 0;
  };
  const base = () =>
    db
      .from("players")
      .select("id", { count: "exact", head: true })
      .eq("sport", SOCCER);
  const [players, defaultPrimary, withSecondary, defaultSecondary] =
    await Promise.all([
      count((q) => q),
      count((q) => q.eq("template_variant", "default")),
      count((q) => q.not("secondary_position", "is", null)),
      count((q) =>
        q
          .not("secondary_position", "is", null)
          .eq("secondary_template_variant", "default"),
      ),
    ]);
  return { players, defaultPrimary, withSecondary, defaultSecondary };
}
