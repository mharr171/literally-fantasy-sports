import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asService, asUser, sql } from "./db";

const PROFILE = { personality: "steady", pace: "normal", formation: "4-4-2" };
const PACKS = [
  { focus: "goal", tier: "starter" },
  { focus: "any", tier: "starter" },
];

describe.runIf(sql)("AI clubs (D113)", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;
  const tag = `ai${Date.now() % 1_000_000}`;
  let owner: string;

  beforeAll(async () => {
    const [u] = await db<{ id: string }[]>`
      insert into auth.users (email) values (${`${tag}@example.com`}) returning id`;
    owner = u?.id as string;
  });

  afterAll(async () => {
    await db`delete from teams where name like ${`${tag}%`}`;
    await db`delete from auth.users where id = ${owner}`;
    await db.end();
  });

  it("creates an AI club with no owner, an invented manager and starter packs", async () => {
    const result = await asService(db, async (tx) => {
      const [t] = await tx<{ id: string }[]>`
        select public.create_ai_team('soccer', ${`${tag} Rangers`}, '{navy,gold}',
          'Ana Silva', ${tx.json(PROFILE)}, ${tx.json(PACKS)}) as id`;
      const [team] = await tx`select owner_id, kind, manager_name, ai, colors
        from teams where id = ${t?.id as string}`;
      const [packs] = await tx`select count(*)::int as n from packs
        where team_id = ${t?.id as string} and kind = 'starter'`;
      return { team, packs };
    });
    expect(result.team).toEqual({
      owner_id: null,
      kind: "ai",
      manager_name: "Ana Silva",
      ai: PROFILE,
      colors: ["navy", "gold"],
    });
    expect(result.packs).toEqual({ n: 2 });
  });

  it("keeps AI and human clubs apart: an owner for humans, a profile for AI", async () => {
    const result = await asService(db, async (tx) => {
      const attempt = async (query: () => Promise<unknown>) => {
        await tx`savepoint a`;
        return query().then(
          () => "ok",
          async (e: Error) => {
            await tx`rollback to savepoint a`;
            return e.message;
          },
        );
      };
      const orphan = await attempt(
        () =>
          tx`insert into teams (sport, name, kind) values ('soccer', ${`${tag} Orphans`}, 'human')`,
      );
      const mixed = await attempt(
        () =>
          tx`insert into teams (owner_id, sport, name, kind, manager_name, ai)
            values (${owner}, 'soccer', ${`${tag} Mixed`}, 'ai', 'X', '{}')`,
      );
      return { orphan, mixed };
    });
    expect(result.orphan).toMatch(/teams_kind/);
    expect(result.mixed).toMatch(/teams_kind/);
  });

  it("gives AI clubs a season record but no ghost", async () => {
    const result = await asService(db, async (tx) => {
      const [t] = await tx<{ id: string }[]>`
        select public.create_ai_team('soccer', ${`${tag} Wanderers`}, '{red,white}',
          'Ben Ode', ${tx.json(PROFILE)}, '[]') as id`;
      const team = t?.id as string;
      const [s] = await tx<{ id: string }[]>`
        select public.start_season(${team}, 'seed', 'defaults',
          ${tx.json([{ slot: 0, kind: "manager", name: "Wanderers", start_rating: 1500 }])},
          '[]') as id`;
      await tx`update seasons set status = 'finished', finished_at = now() where id = ${s?.id as string}`;
      await tx`select public.close_season(${s?.id as string}, '[]', '[]', '{}',
        ${tx.json({ players: [], squad: {}, stats: { position: 3 }, game_version: "x" })})`;
      const ghosts = await tx`select 1 from ghosts where team_id = ${team}`;
      const records =
        await tx`select position from season_records where team_id = ${team}`;
      return { ghosts, records };
    });
    expect(result.ghosts).toEqual([]);
    expect(result.records).toEqual([{ position: 3 }]);
  });

  it("keeps AI settings and AI club creation to the server", async () => {
    for (const run of [
      (fn: Parameters<typeof asAnon>[1]) => asAnon(db, fn),
      (fn: Parameters<typeof asAnon>[1]) => asUser(db, owner, fn),
    ]) {
      await expect(run((tx) => tx`select * from ai_settings`)).rejects.toThrow(
        /permission denied/,
      );
      await expect(
        run(
          (tx) =>
            tx`select public.create_ai_team('soccer', 'x', '{}', 'x', '{}', '[]')`,
        ),
      ).rejects.toThrow(/permission denied/);
    }
    // Managers never see AI clubs' rows (only their own team).
    const seen = await asUser(
      db,
      owner,
      (tx) => tx`select kind from teams where kind = 'ai'`,
    );
    expect(seen).toEqual([]);
    const [settings] =
      await db`select enabled, pool_size, runs_per_day from ai_settings where sport = 'soccer'`;
    expect(settings).toEqual({
      enabled: false,
      pool_size: 250,
      runs_per_day: 12,
    });
  });
});
