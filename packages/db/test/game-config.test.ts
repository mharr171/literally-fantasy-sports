import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAdmin, asAnon, asUser, sql } from "./db";

describe.runIf(sql)("game config", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;
  let admin: string;
  let player: string;
  // Unique version numbers per run, since published versions can't be deleted.
  const base = 1000 + (Date.now() % 1_000_000) * 3;
  const published = base;
  const draft = base + 1;

  beforeAll(async () => {
    const rows = await db<{ id: string }[]>`
      insert into auth.users (email) values ('admin@example.com'), ('player@example.com')
      returning id`;
    [admin, player] = rows.map((r) => r.id) as [string, string];
    await db`update profiles set is_admin = true where id = ${admin}`;
    await db`insert into game_config_versions (scope, version, note) values
      ('soccer', ${published}, 'live'), ('soccer', ${draft}, 'work in progress')`;
    await db`insert into game_config (scope, version, key, value) values
      ('soccer', ${published}, 'tuning', '{"chanceRate": 0.34}'),
      ('soccer', ${draft}, 'tuning', '{"chanceRate": 0.4}')`;
    await db`update game_config_versions set published_at = now()
      where scope = 'soccer' and version = ${published}`;
  });

  afterAll(async () => {
    await db`delete from game_config_versions where scope = 'soccer' and version = ${draft}`;
    await db`delete from auth.users where id in (${admin}, ${player})`;
    await db.end();
  });

  describe("is_admin()", () => {
    it("is true only for admins", async () => {
      const a = await asAdmin(
        db,
        admin,
        (tx) => tx`select public.is_admin() as v`,
      );
      const p = await asUser(
        db,
        player,
        (tx) => tx`select public.is_admin() as v`,
      );
      expect(a[0]?.v).toBe(true);
      expect(p[0]?.v).toBe(false);
    });

    it("is false for an admin signed in without two-factor (M5)", async () => {
      const [row] = await asUser(
        db,
        admin,
        (tx) => tx`select public.is_admin() as v`,
      );
      expect(row?.v).toBe(false);
      // So they can't see drafts or change settings either.
      await expect(
        asUser(
          db,
          admin,
          (tx) =>
            tx`insert into game_config_versions (scope, version, note) values ('soccer', 999, 'x')`,
        ),
      ).rejects.toThrow(/row-level security/);
    });

    it("can't be called by signed-out visitors", async () => {
      await expect(
        asAnon(db, (tx) => tx`select public.is_admin()`),
      ).rejects.toThrow(/permission denied/);
    });
  });

  describe("players", () => {
    it("see published versions and their settings, but not drafts", async () => {
      const versions = await asUser(
        db,
        player,
        (tx) =>
          tx`select version from game_config_versions where version in (${published}, ${draft})`,
      );
      expect(versions.map((v) => v.version)).toEqual([published]);
      const rows = await asUser(
        db,
        player,
        (tx) =>
          tx`select version, value from game_config where version in (${published}, ${draft})`,
      );
      expect(rows).toEqual([
        { version: published, value: { chanceRate: 0.34 } },
      ]);
    });

    it("can't create, change or delete anything", async () => {
      await expect(
        asUser(
          db,
          player,
          (tx) =>
            tx`insert into game_config_versions (scope, version) values ('soccer', ${base + 2})`,
        ),
      ).rejects.toThrow(/row-level security/);
      await expect(
        asUser(
          db,
          player,
          (tx) => tx`insert into game_config (scope, version, key, value)
            values ('soccer', ${draft}, 'sneaky', '1')`,
        ),
      ).rejects.toThrow(/row-level security/);
      const updated = await asUser(
        db,
        player,
        (tx) =>
          tx`update game_config set value = '{}' where version = ${draft} returning key`,
      );
      expect(updated).toHaveLength(0);
      const deleted = await asUser(
        db,
        player,
        (tx) =>
          tx`delete from game_config_versions where version = ${draft} returning version`,
      );
      expect(deleted).toHaveLength(0);
    });
  });

  it("hides everything from signed-out visitors", async () => {
    await expect(
      asAnon(db, (tx) => tx`select * from game_config_versions`),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asAnon(db, (tx) => tx`select * from game_config`),
    ).rejects.toThrow(/permission denied/);
  });

  describe("admins", () => {
    it("see drafts and can edit them", async () => {
      const rows = await asAdmin(db, admin, async (tx) => {
        await tx`update game_config set value = '{"chanceRate": 0.5}'
          where scope = 'soccer' and version = ${draft} and key = 'tuning'`;
        await tx`insert into game_config (scope, version, key, value)
          values ('soccer', ${draft}, 'templates.st', '[[0]]')`;
        return tx`select key, value from game_config where version = ${draft} order by key`;
      });
      expect(rows).toEqual([
        { key: "templates.st", value: [[0]] },
        { key: "tuning", value: { chanceRate: 0.5 } },
      ]);
    });

    it("create new drafts, recorded as theirs", async () => {
      const [row] = await asAdmin(
        db,
        admin,
        (tx) => tx`insert into game_config_versions (scope, version)
          values ('soccer', ${base + 2}) returning created_by, published_at`,
      );
      expect(row).toEqual({ created_by: admin, published_at: null });
    });

    it("can publish a draft", async () => {
      const [row] = await asAdmin(
        db,
        admin,
        (tx) => tx`update game_config_versions set published_at = now()
          where scope = 'soccer' and version = ${draft} returning published_at`,
      );
      expect(row?.published_at).toBeInstanceOf(Date);
    });

    it("can't create a version that is already published", async () => {
      await expect(
        asAdmin(
          db,
          admin,
          (
            tx,
          ) => tx`insert into game_config_versions (scope, version, published_at)
            values ('soccer', ${base + 2}, now())`,
        ),
      ).rejects.toThrow(/as drafts/);
    });
  });

  describe("published versions are frozen", () => {
    const attempts: [
      string,
      (tx: Parameters<Parameters<typeof asUser>[2]>[0]) => Promise<unknown>,
    ][] = [
      [
        "change a setting",
        (tx) =>
          tx`update game_config set value = '{}' where version = ${published}`,
      ],
      [
        "add a setting",
        (tx) =>
          tx`insert into game_config (scope, version, key, value) values ('soccer', ${published}, 'extra', '1')`,
      ],
      [
        "remove a setting",
        (tx) => tx`delete from game_config where version = ${published}`,
      ],
      [
        "unpublish or edit the version",
        (tx) =>
          tx`update game_config_versions set note = 'x' where version = ${published}`,
      ],
      [
        "delete the version",
        (tx) =>
          tx`delete from game_config_versions where version = ${published}`,
      ],
    ];
    for (const [what, run] of attempts) {
      it(`won't let even an admin ${what}`, async () => {
        await expect(asAdmin(db, admin, run)).rejects.toThrow(
          /published and frozen/,
        );
      });
    }

    it("won't let a setting be moved out of a published version", async () => {
      await expect(
        asAdmin(
          db,
          admin,
          (tx) => tx`update game_config set version = ${draft}
            where scope = 'soccer' and version = ${published}`,
        ),
      ).rejects.toThrow(/published and frozen/);
    });

    it("won't let a draft be renumbered", async () => {
      await expect(
        asAdmin(
          db,
          admin,
          (tx) => tx`update game_config_versions set version = ${base + 5}
            where scope = 'soccer' and version = ${draft}`,
        ),
      ).rejects.toThrow(/renumbered/);
    });
  });

  it("checks scopes and key names", async () => {
    await expect(
      db`insert into game_config_versions (scope, version) values ('cricket', 1)`,
    ).rejects.toThrow(/game_config_versions_scope/);
    await expect(
      db`insert into game_config (scope, version, key, value) values ('soccer', ${draft}, 'Bad Key', '1')`,
    ).rejects.toThrow(/game_config_key_format/);
  });
});
