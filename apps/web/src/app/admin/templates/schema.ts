import { POSITIONS, SOCCER_GRID } from "@lfs/sport-soccer";
import { z } from "zod";

const grid = z
  .array(z.array(z.number().nonnegative().finite()).length(SOCCER_GRID.cols))
  .length(SOCCER_GRID.rows)
  .refine(
    (rows) => rows.some((row) => row.some((v) => v > 0)),
    "Paint at least one cell",
  );

export const templatesSchema = z.object(
  Object.fromEntries(POSITIONS.map((p) => [p, grid])) as Record<
    (typeof POSITIONS)[number],
    typeof grid
  >,
);

export const saveInputSchema = z.object({
  /** The version the editor was showing; null for the built-in defaults. */
  baseVersion: z.number().int().positive().nullable(),
  note: z.string().trim().max(200),
  templates: templatesSchema,
});

export type SaveInput = z.infer<typeof saveInputSchema>;
