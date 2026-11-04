import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, sql } from "./db";

describe.runIf(sql)("profiles", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    const rows = await db<{ id: string }[]>`
      insert into auth.users (email, raw_user_meta_data) values
        ('alice@example.com', '{"full_name": "Alice Example"}'),
        ('bob@example.com', '{}')
      returning id`;
    [alice, bob] = rows.map((r) => r.id) as [string, string];
  });

  afterAll(async () => {
    await db`delete from auth.users where id in (${alice}, ${bob})`;
    await db.end();
  });

  it("is created on sign-up with a display name", async () => {
    const rows = await db`
      select id, display_name, is_admin from profiles
      where id in (${alice}, ${bob}) order by display_name`;
    expect(rows).toEqual([
      { id: alice, display_name: "Alice Example", is_admin: false },
      { id: bob, display_name: "bob", is_admin: false },
    ]);
  });

  it("lets a player read only their own profile", async () => {
    const rows = await asUser(db, alice, (tx) => tx`select id from profiles`);
    expect(rows.map((r) => r.id)).toEqual([alice]);
  });

  it("lets a player rename themselves", async () => {
    const rows = await asUser(
      db,
      alice,
      (tx) =>
        tx`update profiles set display_name = 'Ace' where id = ${alice} returning display_name`,
    );
    expect(rows).toEqual([{ display_name: "Ace" }]);
  });

  it("does not let a player rename someone else", async () => {
    const rows = await asUser(
      db,
      alice,
      (tx) =>
        tx`update profiles set display_name = 'Hacked' where id = ${bob} returning id`,
    );
    expect(rows).toHaveLength(0);
  });

  it("does not let a player make themselves admin", async () => {
    await expect(
      asUser(
        db,
        alice,
        (tx) => tx`update profiles set is_admin = true where id = ${alice}`,
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("does not let a player create or delete profiles", async () => {
    await expect(
      asUser(
        db,
        alice,
        (tx) =>
          tx`insert into profiles (id, display_name) values (gen_random_uuid(), 'x')`,
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(db, alice, (tx) => tx`delete from profiles where id = ${alice}`),
    ).rejects.toThrow(/permission denied/);
  });

  it("hides profiles from signed-out visitors", async () => {
    await expect(
      asAnon(db, (tx) => tx`select id from profiles`),
    ).rejects.toThrow(/permission denied/);
  });

  it("rejects empty or overlong display names", async () => {
    await expect(
      asUser(
        db,
        alice,
        (tx) => tx`update profiles set display_name = '' where id = ${alice}`,
      ),
    ).rejects.toThrow(/profiles_display_name_length/);
    await expect(
      asUser(
        db,
        alice,
        (tx) =>
          tx`update profiles set display_name = ${"x".repeat(41)} where id = ${alice}`,
      ),
    ).rejects.toThrow(/profiles_display_name_length/);
  });

  it("is deleted with the account", async () => {
    const [{ id }] = (await db`
      insert into auth.users (email) values ('temp@example.com') returning id`) as unknown as [
      { id: string },
    ];
    await db`delete from auth.users where id = ${id}`;
    const rows = await db`select 1 from profiles where id = ${id}`;
    expect(rows).toHaveLength(0);
  });
});
