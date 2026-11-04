import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asService, asUser, sql } from "./db";

type Tx = Parameters<Parameters<typeof asService>[1]>[0];

const SLOTS = [
  { slot: 0, kind: "manager", name: "Mine FC", start_rating: 1500 },
  { slot: 1, kind: "ai", name: "Ashvale City", start_rating: 1400 },
];
const FIXTURES = [
  { week: 1, stage: "league", home_slot: 0, away_slot: 1 },
  { week: 2, stage: "league", home_slot: 1, away_slot: 0 },
];

describe.runIf(sql)("seasons, league teams and fixtures (D16)", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;
  const tag = `z${Date.now() % 1_000_000}`;
  let owner: string;
  let other: string;
  let team: string;

  beforeAll(async () => {
    const users = await db<{ id: string }[]>`
      insert into auth.users (email) values (${`${tag}-a@example.com`}), (${`${tag}-b@example.com`})
      returning id`;
    [owner, other] = users.map((u) => u.id) as [string, string];
    const [t] = await db<{ id: string }[]>`
      insert into teams (owner_id, sport, name) values (${owner}, 'soccer', ${`${tag} Harriers`})
      returning id`;
    team = t?.id as string;
  });

  afterAll(async () => {
    await db`delete from auth.users where id in (${owner}, ${other})`;
    await db.end();
  });

  const start = async (tx: Tx) => {
    const [s] = await tx<{ id: string }[]>`
      select public.start_season(${team}, 'secret-seed', 'defaults',
        ${tx.json(SLOTS)}, ${tx.json(FIXTURES)}) as id`;
    return s?.id as string;
  };
  const attempt = (tx: Tx, query: Promise<unknown>) =>
    tx`savepoint a`.then(() =>
      query.then(
        () => "ok",
        async (e: Error) => {
          await tx`rollback to savepoint a`;
          return e.message;
        },
      ),
    );

  it("starts a season with its league and schedule, one at a time", async () => {
    const result = await asService(db, async (tx) => {
      const season = await start(tx);
      const [row] =
        await tx`select number, status, week, start_elo from seasons where id = ${season}`;
      const slots =
        await tx`select slot, name, elo from season_teams where season_id = ${season} order by slot`;
      const fx =
        await tx`select week, home_slot, home_score from fixtures where season_id = ${season} order by week`;
      const again = await attempt(tx, start(tx));
      return { row, slots, fx, again };
    });
    expect(result.row).toEqual({
      number: 1,
      status: "regular",
      week: 1,
      start_elo: 1500,
    });
    expect(result.slots).toEqual([
      { slot: 0, name: "Mine FC", elo: 1500 },
      { slot: 1, name: "Ashvale City", elo: 1400 },
    ]);
    expect(result.fx).toEqual([
      { week: 1, home_slot: 0, home_score: null },
      { week: 2, home_slot: 1, home_score: null },
    ]);
    expect(result.again).toMatch(/already in progress/);
  });

  it("records a week once: results, Elo, funds, playoffs and status", async () => {
    const result = await asService(db, async (tx) => {
      const season = await start(tx);
      const [f1] = await tx<
        { id: string }[]
      >`select id from fixtures where season_id = ${season} and week = 1`;
      const results = [
        {
          id: f1?.id,
          home_score: 2,
          away_score: 1,
          winner: null,
          summary: { shots: { home: 5, away: 3 } },
        },
      ];
      const record = (week: number) =>
        tx`select public.record_week(${season}, ${week}, ${tx.json(results)},
          ${tx.json({ "0": 1512, "1": 1388 })}, 1500,
          ${tx.json([{ week: 3, stage: "semi", home_slot: 0, away_slot: 1 }])}, 'playoffs', 2)`;
      await record(1);
      const twice = await attempt(tx, record(1));
      const wrongWeek = await attempt(
        tx,
        tx`select public.record_week(${season}, 2, ${tx.json(results)}, '{}', 0, '[]', 'regular', 3)`,
      );
      const [teamRow] =
        await tx`select elo, funds from teams where id = ${team}`;
      const [seasonRow] =
        await tx`select status, week, finished_at from seasons where id = ${season}`;
      const elos =
        await tx`select slot, elo from season_teams where season_id = ${season} order by slot`;
      const played =
        await tx`select home_score, away_score, summary from fixtures where id = ${f1?.id as string}`;
      const semis =
        await tx`select stage from fixtures where season_id = ${season} and week = 3`;
      return { twice, wrongWeek, teamRow, seasonRow, elos, played, semis };
    });
    expect(result.twice).toMatch(/already played/);
    expect(result.wrongWeek).toMatch(/do not match week 2/);
    expect(result.teamRow).toEqual({ elo: 1512, funds: 10_000 + 1_500 });
    expect(result.seasonRow).toEqual({
      status: "playoffs",
      week: 2,
      finished_at: null,
    });
    expect(result.elos).toEqual([
      { slot: 0, elo: 1512 },
      { slot: 1, elo: 1388 },
    ]);
    expect(result.played).toEqual([
      {
        home_score: 2,
        away_score: 1,
        summary: { shots: { home: 5, away: 3 } },
      },
    ]);
    expect(result.semis).toEqual([{ stage: "semi" }]);
  });

  it("lets a manager read their season but never its seed", async () => {
    // asService rolls back, so start one for real for this test.
    const [s] = await db<{ id: string }[]>`
      select public.start_season(${team}, 'secret-seed', 'defaults',
        ${db.json(SLOTS)}, ${db.json(FIXTURES)}) as id`;
    try {
      expect(
        await asUser(db, owner, (tx) => tx`select number, status from seasons`),
      ).toEqual([{ number: 1, status: "regular" }]);
      expect(
        await asUser(
          db,
          owner,
          (tx) => tx`select name from season_teams order by slot`,
        ),
      ).toHaveLength(2);
      expect(
        await asUser(db, owner, (tx) => tx`select week from fixtures`),
      ).toHaveLength(2);
      await expect(
        asUser(db, owner, (tx) => tx`select seed from seasons`),
      ).rejects.toThrow(/permission denied/);
      for (const table of ["seasons", "season_teams", "fixtures"]) {
        expect(
          await asUser(db, other, (tx) => tx.unsafe(`select 1 from ${table}`)),
        ).toHaveLength(0);
        await expect(
          asAnon(db, (tx) => tx.unsafe(`select 1 from ${table}`)),
        ).rejects.toThrow(/permission denied/);
      }
      await expect(
        asUser(db, owner, (tx) => tx`update fixtures set home_score = 9`),
      ).rejects.toThrow(/permission denied/);
    } finally {
      await db`delete from seasons where id = ${s?.id as string}`;
    }
  });

  it("lets only the server start seasons and record weeks", async () => {
    for (const run of [
      (fn: Parameters<typeof asAnon>[1]) => asAnon(db, fn),
      (fn: Parameters<typeof asAnon>[1]) => asUser(db, owner, fn),
    ]) {
      await expect(
        run(
          (tx) => tx`select public.start_season(${team}, 's', 'd', '[]', '[]')`,
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        run(
          (tx) =>
            tx`select public.record_week(gen_random_uuid(), 1, '[]', '{}', 99999, '[]', 'finished', 1)`,
        ),
      ).rejects.toThrow(/permission denied/);
    }
  });
});
