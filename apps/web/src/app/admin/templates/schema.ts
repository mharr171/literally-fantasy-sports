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

const positionKey = z.enum(POSITIONS);
const variantName = z.string().regex(/^[a-z0-9][a-z0-9-]{0,23}$/);

/** Named variants per position (D82), at most 8 per position. */
export const variantsSchema = z
  .partialRecord(positionKey, z.record(variantName, grid))
  .refine(
    (v) =>
      Object.values(v).every((named) => Object.keys(named ?? {}).length <= 8),
    "At most 8 variants per position",
  );

/** The templates new players can be given, per position (D84). */
export const enabledSchema = z.partialRecord(
  positionKey,
  z.array(z.string().max(24)).max(9),
);

export const saveInputSchema = z.object({
  /** The version the editor was showing; null for the built-in defaults. */
  baseVersion: z.number().int().positive().nullable(),
  note: z.string().trim().max(200),
  templates: templatesSchema,
  variants: variantsSchema.default({}),
  enabled: enabledSchema.default({}),
});

export type SaveInput = z.infer<typeof saveInputSchema>;
