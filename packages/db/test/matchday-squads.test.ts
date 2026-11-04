import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, sql } from "./db";

describe.runIf(sql)("matchday squads (D88)", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;
  const tag = `m${Date.now() % 1_000_000}`;
  let owner: string;
  let other: string;
  let team: string;

  beforeAll(async () => {
    const users = await db<{ id: string }[]>`
      insert into auth.users (email) values (${`${tag}-a@example.com`}), (${`${tag}-b@example.com`})
      returning id`;
    [owner, other] = users.map((u) => u.id) as [string, string];
    const [t] = await db<{ id: string }[]>`
      insert into teams (owner_id, sport, name) values (${owner}, 'soccer', ${`${tag} Athletic`})
      returning id`;
    team = t?.id as string;
    // The server saves squads (here: the database owner, standing in for the service role).
    await db`insert into matchday_squads (team_id, formation, lineup, bench)
      values (${team}, '4-4-2', ${db.json(["a"])}, ${db.json(["b"])})`;
  });

  afterAll(async () => {
    await db`delete from auth.users where id in (${owner}, ${other})`;
    await db.end();
  });

  it("lets a manager read only their own squad", async () => {
    expect(
      await asUser(
        db,
        owner,
        (tx) => tx`select formation, sub_plan from matchday_squads`,
      ),
    ).toEqual([{ formation: "4-4-2", sub_plan: [] }]);
    expect(
      await asUser(
        db,
        other,
        (tx) => tx`select formation from matchday_squads`,
      ),
    ).toHaveLength(0);
    await expect(
      asAnon(db, (tx) => tx`select formation from matchday_squads`),
    ).rejects.toThrow(/permission denied/);
  });

  it("refuses direct writes from managers", async () => {
    for (const query of [
      (tx: Parameters<Parameters<typeof asUser>[2]>[0]) =>
        tx`update matchday_squads set formation = '3-5-2'`,
      (tx: Parameters<Parameters<typeof asUser>[2]>[0]) =>
        tx`delete from matchday_squads`,
      (tx: Parameters<Parameters<typeof asUser>[2]>[0]) =>
        tx`insert into matchday_squads (team_id, formation, lineup, bench)
          values (${team}, 'x', '[]', '[]')`,
    ]) {
      await expect(asUser(db, owner, query)).rejects.toThrow(
        /permission denied/,
      );
    }
  });

  it("goes with its team", async () => {
    const [t] = await db<{ id: string }[]>`
      insert into teams (owner_id, sport, name) values (${other}, 'soccer', ${`${tag} Temp`}) returning id`;
    await db`insert into matchday_squads (team_id, formation, lineup, bench)
      values (${t?.id as string}, '4-4-2', '[]', '[]')`;
    await db`delete from teams where id = ${t?.id as string}`;
    expect(
      await db`select 1 from matchday_squads where team_id = ${t?.id as string}`,
    ).toHaveLength(0);
  });
});
