/**
 * Formations (D140, D172): the built-in presets and those admins create,
 * each on or off for every club. Admin-made formations live in the
 * database and can't change once made, so the engine's lookup learns them
 * here before any squad that may use one is read.
 */
import {
  FORMATIONS,
  type Formation,
  type FormationSlot,
  formation,
  formationProblems,
  POSITIONS,
  type Position,
  registerFormations,
} from "@lfs/sport-soccer";
import { createServiceClient } from "./db";

const SOCCER = "soccer";

export interface FormationRow {
  id: string;
  builtIn: boolean;
  enabled: boolean;
  formation: Formation;
}

/** Every formation, built-in presets first, and registers the admin-made ones. */
export async function loadFormations(): Promise<FormationRow[]> {
  const { data, error } = await createServiceClient()
    .from("formations")
    .select("id, slots, built_in, enabled")
    .eq("sport", SOCCER)
    .order("created_at")
    .order("id");
  if (error) throw new Error(error.message);
  const rows = data ?? [];
  const made = rows.filter((r) => !r.built_in && Array.isArray(r.slots));
  registerFormations(
    made.map((r) => ({
      id: r.id as string,
      slots: r.slots as FormationSlot[],
    })),
  );
  const enabled = new Map(
    rows.map((r) => [r.id as string, r.enabled as boolean]),
  );
  return [
    ...FORMATIONS.map((f) => ({
      id: f.id,
      builtIn: true,
      // A preset with no row yet (before the migration) is on.
      enabled: enabled.get(f.id) ?? true,
      formation: f,
    })),
    ...made.flatMap((r) => {
      const f = formation(r.id as string);
      return f
        ? [
            {
              id: f.id,
              builtIn: false,
              enabled: r.enabled as boolean,
              formation: f,
            },
          ]
        : [];
    }),
  ];
}

/**
 * Makes sure the engine knows these formations, reading the database only
 * when one isn't known yet (a formation made since this server started).
 */
export async function ensureFormations(
  ids: readonly (string | null | undefined)[],
): Promise<void> {
  if (ids.every((id) => !id || formation(id))) return;
  await loadFormations();
}

/** The formations managers and the AI can pick now (D140). */
export async function enabledFormations(): Promise<Formation[]> {
  return (await loadFormations())
    .filter((f) => f.enabled)
    .map((f) => f.formation);
}

async function log(adminId: string, action: string, details: object) {
  const { error } = await createServiceClient().from("admin_actions").insert({
    admin_id: adminId,
    team_id: null,
    team_name: "Formations",
    action,
    details,
  });
  if (error) throw new Error(`Couldn't log the action: ${error.message}`);
}

/** Adds an admin-made formation, on (D140). Slots are checked by the engine. */
export async function createFormation(
  adminId: string,
  id: string,
  slots: readonly { position: string; x: number; y: number }[],
): Promise<void> {
  if (slots.some((s) => !POSITIONS.includes(s.position as Position)))
    throw new Error("Pick a position for every slot.");
  const typed = slots as { position: Position; x: number; y: number }[];
  const existing = (await loadFormations()).map((f) => f.id);
  const problems = formationProblems(id, typed, existing);
  if (problems.length > 0) throw new Error(problems.join(" "));
  // Stored keeper first, as the engine builds it.
  const ordered = [
    ...typed.filter((s) => s.position === "GK"),
    ...typed.filter((s) => s.position !== "GK"),
  ].map(({ position, x, y }) => ({ position, x, y }));
  const { error } = await createServiceClient()
    .from("formations")
    .insert({ sport: SOCCER, id, slots: ordered, built_in: false });
  if (error)
    throw new Error(
      error.code === "23505" ? `${id} already exists.` : error.message,
    );
  registerFormations([{ id, slots: ordered }]);
  await log(adminId, "formation_created", { id, slots: ordered });
}

/** Turns a formation on or off for every club; one always stays on (D140). */
export async function setFormationEnabled(
  adminId: string,
  id: string,
  enabled: boolean,
): Promise<void> {
  const all = await loadFormations();
  const row = all.find((f) => f.id === id);
  if (!row) throw new Error(`There's no formation ${id}.`);
  if (!enabled && all.filter((f) => f.enabled && f.id !== id).length === 0)
    throw new Error("At least one formation has to stay on.");
  const db = createServiceClient();
  const { error } = row.builtIn
    ? await db
        .from("formations")
        .upsert({ sport: SOCCER, id, built_in: true, enabled })
    : await db
        .from("formations")
        .update({ enabled })
        .eq("sport", SOCCER)
        .eq("id", id);
  if (error) throw new Error(error.message);
  await log(adminId, enabled ? "formation_on" : "formation_off", { id });
}
