import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asService, asUser, sql } from "./db";

type Tx = Parameters<Parameters<typeof asService>[1]>[0];

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

type Row = { team_id: string; name: string; value: number; has_ghost: boolean };

describe.runIf(sql)("global hall of fame clubs (ADR 0005)", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;
  const tag = `hf${Date.now() % 1_000_000}`;
  let owner: string;
  let a: string;
  let b: string;

  beforeAll(async () => {
    const [u] = await db<{ id: string }[]>`
      insert into auth.users (email) values (${`${tag}@example.com`}) returning id`;
    owner = u?.id as string;
    const [ta] = await db<{ id: string }[]>`
      insert into teams (owner_id, sport, name) values (${owner}, 'soccer', ${`${tag} City`})
      returning id`;
    a = ta?.id as string;
    const [u2] = await db<{ id: string }[]>`
      insert into auth.users (email) values (${`${tag}b@example.com`}) returning id`;
    const [tb] = await db<{ id: string }[]>`
      insert into teams (owner_id, sport, name) values (${u2?.id as string}, 'soccer', ${`${tag} Rovers`})
      returning id`;
    b = tb?.id as string;
  });

  afterAll(async () => {
    await db`delete from auth.users where email like ${`${tag}%`}`;
    await db.end();
  });

  it("ranks clubs by titles, best Elo and seasons, each club once", async () => {
    const result = await asService(db, async (tx) => {
      // Start clean: only this test's records count.
      await tx`delete from season_records`;
      const record = (team: string, n: number, elo: number, playoffs: string) =>
        tx`insert into season_records (team_id, sport, season_number, team_name,
            elo_before, elo_after, position, played, won, drawn, lost, scored,
            conceded, points, playoffs)
          values (${team}, 'soccer', ${n}, ${`Name ${n}`}, 1500, ${elo}, 1, 22, 10, 5,
            7, 30, 20, 35, ${playoffs})`;
      await record(a, 1, 1550, "champion");
      await record(a, 2, 1600, "champion");
      await record(a, 3, 1580, "none");
      await record(b, 1, 1700, "final");
      const [r] = await tx<{ hall: Record<string, Row[]> }[]>`
        select public.hall_of_fame_clubs('soccer', 10) as hall`;
      return r?.hall;
    });
    const pick = (rows: Row[] | undefined) =>
      (rows ?? []).map((r) => [r.team_id === a ? "a" : "b", r.value, r.name]);
    expect(pick(result?.titles)).toEqual([["a", 2, "Name 3"]]);
    expect(pick(result?.elo)).toEqual([
      ["b", 1700, "Name 1"],
      ["a", 1600, "Name 3"],
    ]);
    expect(pick(result?.seasons)).toEqual([
      ["a", 3, "Name 3"],
      ["b", 1, "Name 1"],
    ]);
  });

  it("can't be called by a signed-in player", async () => {
    const error = await asUser(db, owner, (tx) =>
      attempt(tx, () => tx`select public.hall_of_fame_clubs('soccer', 10)`),
    );
    expect(error).toMatch(/permission denied/);
  });
});
