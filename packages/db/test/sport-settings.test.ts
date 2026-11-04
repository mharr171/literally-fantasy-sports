import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, sql } from "./db";

describe.runIf(sql)("sport settings: energy switches (D93)", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;
  const tag = `ss${Date.now() % 1_000_000}`;
  let admin: string;
  let player: string;

  beforeAll(async () => {
    const users = await db<{ id: string }[]>`
      insert into auth.users (email) values (${`${tag}-admin@example.com`}), (${`${tag}-p@example.com`})
      returning id`;
    [admin, player] = users.map((u) => u.id) as [string, string];
    await db`update profiles set is_admin = true where id = ${admin}`;
  });

  afterAll(async () => {
    await db`delete from auth.users where id in (${admin}, ${player})`;
    await db.end();
  });

  it("starts soccer with energy on, 15 minutes per point, up to 3", async () => {
    expect(
      await asUser(
        db,
        player,
        (tx) =>
          tx`select energy_enabled, energy_refill_minutes, energy_max from sport_settings where sport = 'soccer'`,
      ),
    ).toEqual([
      { energy_enabled: true, energy_refill_minutes: 15, energy_max: 3 },
    ]);
  });

  it("lets admins switch energy off, but not players or visitors", async () => {
    const changed = await asUser(
      db,
      admin,
      (tx) =>
        tx`update sport_settings set energy_enabled = false where sport = 'soccer' returning energy_enabled`,
    );
    expect(changed).toEqual([{ energy_enabled: false }]);
    expect(
      await asUser(
        db,
        player,
        (tx) =>
          tx`update sport_settings set energy_enabled = false where sport = 'soccer' returning sport`,
      ),
    ).toEqual([]);
    await expect(
      asAnon(db, (tx) => tx`select sport from sport_settings`),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(
        db,
        admin,
        (tx) => tx`insert into sport_settings (sport) values ('hockey')`,
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(db, admin, (tx) => tx`delete from sport_settings`),
    ).rejects.toThrow(/permission denied/);
  });

  it("keeps the numbers sensible", async () => {
    await expect(
      asUser(
        db,
        admin,
        (tx) =>
          tx`update sport_settings set energy_refill_minutes = 0 where sport = 'soccer'`,
      ),
    ).rejects.toThrow(/sport_settings_energy/);
  });
});
