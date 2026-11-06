import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asService, sql } from "./db";

// The check at the top of migration 0080 (ADR 0007 §13), run as written.
// It passing on real data is shown by the persistence check, which applies
// 0080 to seeded clubs.
const CHECK = (
  readFileSync(
    new URL(
      "../migrations/0080_soccer_writers_to_new_columns.sql",
      import.meta.url,
    ),
    "utf8",
  )
    .split("--> statement-breakpoint")
    .find((s) => s.includes("old and new soccer columns differ")) ?? ""
)
  .replace(/^(--.*\n)+/, "")
  .trim();

describe.runIf(sql)("old and new soccer columns check (M17)", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;
  const tag = `c${Date.now() % 1_000_000}`;
  let owner: string;
  let team: string;

  beforeAll(async () => {
    const [u] = await db<{ id: string }[]>`
      insert into auth.users (email) values (${`${tag}@example.com`}) returning id`;
    owner = u?.id as string;
    const [t] = await db<{ id: string }[]>`
      insert into teams (owner_id, sport, name) values (${owner}, 'soccer', ${`${tag} Town`})
      returning id`;
    team = t?.id as string;
  });

  afterAll(async () => {
    await db`delete from auth.users where id = ${owner}`;
    await db.end();
  });

  const addPlayer = (
    tx: Parameters<Parameters<typeof asService>[1]>[0],
    oldGoals: number,
    stats: Record<string, number>,
  ) => tx`
    insert into players (team_id, sport, first_name, last_name, display_name,
      nationality, age, primary_position, attributes, overall, potential,
      potential_low, potential_high, worth, chemistry_color, stat_goals, stats)
    values (${team}, 'soccer', 'Al', 'X', 'Al X', 'ENG', 25, 'ST', '{}', 60,
      60, 58, 62, 1000, 1, ${oldGoals}, ${tx.json(stats)})`;

  it("stops the migration when a player's stats differ", async () => {
    await expect(
      asService(db, async (tx) => {
        await addPlayer(tx, 4, { goals: 3 });
        await tx.unsafe(CHECK);
      }),
    ).rejects.toThrow(/old and new soccer columns differ/);
  });
});
