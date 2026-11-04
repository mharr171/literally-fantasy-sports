import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAdmin, asAnon, asUser, sql } from "./db";

describe.runIf(sql)("admin action log", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;
  const tag = `aa${Date.now() % 1_000_000}`;
  let admin: string;
  let player: string;

  beforeAll(async () => {
    const users = await db<{ id: string }[]>`
      insert into auth.users (email) values (${`${tag}-admin@example.com`}), (${`${tag}-p@example.com`})
      returning id`;
    [admin, player] = users.map((u) => u.id) as [string, string];
    await db`update profiles set is_admin = true where id = ${admin}`;
    // The server writes the log (here: the database owner, standing in for the service role).
    await db`insert into admin_actions (admin_id, team_name, action, details)
      values (${admin}, ${`${tag} FC`}, 'refill_energy', '{"energy":3}')`;
  });

  afterAll(async () => {
    await db`delete from admin_actions where team_name = ${`${tag} FC`}`;
    await db`delete from auth.users where id in (${admin}, ${player})`;
    await db.end();
  });

  it("lets admins read the log", async () => {
    const rows = await asAdmin(
      db,
      admin,
      (tx) =>
        tx`select action, details from admin_actions where team_name = ${`${tag} FC`}`,
    );
    expect(rows).toEqual([{ action: "refill_energy", details: { energy: 3 } }]);
  });

  it("hides it from players and visitors, and nobody writes it directly", async () => {
    expect(
      await asUser(db, player, (tx) => tx`select id from admin_actions`),
    ).toEqual([]);
    await expect(
      asAnon(db, (tx) => tx`select id from admin_actions`),
    ).rejects.toThrow(/permission denied/);
    for (const user of [admin, player]) {
      await expect(
        asUser(
          db,
          user,
          (tx) =>
            tx`insert into admin_actions (team_name, action) values ('x', 'y')`,
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        asUser(db, user, (tx) => tx`delete from admin_actions`),
      ).rejects.toThrow(/permission denied/);
    }
  });
});
