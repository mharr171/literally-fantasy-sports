import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asService, asUser, sql } from "./db";

type Tx = Parameters<Parameters<typeof asService>[1]>[0];

/** Runs `query` and returns "ok" or the error message, rolling back on error. */
const attempt = (tx: Tx, query: () => Promise<unknown>) =>
  tx`savepoint a`.then(() =>
    query().then(
      () => "ok",
      async (e: Error) => {
        await tx`rollback to savepoint a`;
        return e.message;
      },
    ),
  );

const SLOTS = [
  ["GK", 50, 6],
  ["LB", 12, 26],
  ["CB", 37, 22],
  ["CB", 63, 22],
  ["RB", 88, 26],
  ["LM", 12, 58],
  ["CM", 30, 52],
  ["CM", 50, 48],
  ["CM", 70, 52],
  ["RM", 88, 58],
  ["ST", 50, 85],
].map(([position, x, y]) => ({ position, x, y }));

describe.runIf(sql)("formations (D140)", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;
  const tag = `fm${Date.now() % 1_000_000}`;
  let user: string;

  beforeAll(async () => {
    const [u] = await db<{ id: string }[]>`
      insert into auth.users (email) values (${`${tag}@example.com`}) returning id`;
    user = u?.id as string;
  });

  afterAll(async () => {
    await db`delete from auth.users where id = ${user}`;
    await db.end();
  });

  it("has the six built-in presets, all on, and lets players read them", async () => {
    const rows = await asUser(
      db,
      user,
      (tx) => tx`select id, enabled from formations
        where sport = 'soccer' and built_in order by id`,
    );
    expect(rows).toEqual(
      ["3-5-2", "4-1-4-1", "4-2-3-1", "4-3-3", "4-4-2", "5-3-2"].map((id) => ({
        id,
        enabled: true,
      })),
    );
  });

  it("lets the server add one and turn it off, but never change or delete it", async () => {
    const result = await asService(db, async (tx) => {
      await tx`insert into formations (sport, id, slots)
        values ('soccer', '4-5-1x', ${tx.json(SLOTS)})`;
      await tx`update formations set enabled = false where id = '4-5-1x'`;
      const [row] =
        await tx`select enabled from formations where id = '4-5-1x'`;
      return {
        enabled: row?.enabled,
        slots: await attempt(
          tx,
          () => tx`update formations set slots = ${tx.json(SLOTS.slice().reverse())}
            where id = '4-5-1x'`,
        ),
        builtIn: await attempt(
          tx,
          () =>
            tx`update formations set built_in = true, slots = null where id = '4-5-1x'`,
        ),
        deleted: await attempt(
          tx,
          () => tx`delete from formations where id = '4-4-2'`,
        ),
        tenSlots: await attempt(
          tx,
          () => tx`insert into formations (sport, id, slots)
            values ('soccer', '4-5', ${tx.json(SLOTS.slice(1))})`,
        ),
        badId: await attempt(
          tx,
          () => tx`insert into formations (sport, id, slots)
            values ('soccer', 'my shape', ${tx.json(SLOTS)})`,
        ),
      };
    });
    expect(result.enabled).toBe(false);
    expect(result.slots).toMatch(/can't be changed/);
    expect(result.builtIn).toMatch(/can't be changed/);
    expect(result.deleted).toMatch(/never deleted/);
    expect(result.tenSlots).toMatch(/formations_slots/);
    expect(result.badId).toMatch(/formations_id/);
  });

  it("doesn't let players or visitors write, or visitors read", async () => {
    const asPlayer = await asUser(db, user, async (tx) => ({
      insert: await attempt(
        tx,
        () => tx`insert into formations (sport, id, slots)
          values ('soccer', '4-5-1y', ${tx.json(SLOTS)})`,
      ),
      update: await attempt(
        tx,
        () => tx`update formations set enabled = false where id = '4-4-2'`,
      ),
    }));
    expect(asPlayer.insert).toMatch(/permission denied/);
    expect(asPlayer.update).toMatch(/permission denied/);
    const visitor = await asAnon(db, (tx) =>
      attempt(tx, () => tx`select id from formations`),
    );
    expect(visitor).toMatch(/permission denied/);
  });
});
