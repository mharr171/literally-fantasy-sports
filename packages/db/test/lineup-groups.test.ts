import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asService, asUser, sql } from "./db";

describe.runIf(sql)("lineups as groups (ADR 0007 §3)", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;
  const tag = `l${Date.now() % 1_000_000}`;
  let owner: string;
  let team: string;

  beforeAll(async () => {
    const [u] = await db<{ id: string }[]>`
      insert into auth.users (email) values (${`${tag}@example.com`}) returning id`;
    owner = u?.id as string;
    const [t] = await db<{ id: string }[]>`
      insert into teams (owner_id, sport, name) values (${owner}, 'soccer', ${`${tag} United`})
      returning id`;
    team = t?.id as string;
  });

  afterAll(async () => {
    await db`delete from auth.users where id = ${owner}`;
    await db.end();
  });

  it("copies the squad columns into lineup_data on insert and every change", async () => {
    const result = await asService(db, async (tx) => {
      await tx`insert into matchday_squads (team_id, formation, lineup, bench, sub_plan)
        values (${team}, '4-4-2', ${tx.json(["a", "b"])}, ${tx.json(["c"])}, '[]')`;
      const [inserted] =
        await tx`select lineup_data from matchday_squads where team_id = ${team}`;
      await tx`update matchday_squads set lineup_data = lineup_data || '{"extra": 1}'
        where team_id = ${team}`;
      await tx`update matchday_squads set formation = '4-3-3', bench = '[]'
        where team_id = ${team}`;
      const [updated] =
        await tx`select lineup_data from matchday_squads where team_id = ${team}`;
      return { inserted, updated };
    });
    expect(result.inserted?.lineup_data).toEqual({
      formation: "4-4-2",
      starters: ["a", "b"],
      bench: ["c"],
      subPlan: [],
    });
    expect(result.updated?.lineup_data).toEqual({
      formation: "4-3-3",
      starters: ["a", "b"],
      bench: [],
      subPlan: [],
      extra: 1,
    });
  });

  it("lets managers read their own squad's lineup_data", async () => {
    await db`insert into matchday_squads (team_id, formation, lineup, bench, sub_plan)
      values (${team}, '4-4-2', '["x"]', '[]', '[]')`;
    const rows = await asUser(
      db,
      owner,
      (tx) =>
        tx`select lineup_data from matchday_squads where team_id = ${team}`,
    );
    expect(rows[0]?.lineup_data).toMatchObject({ starters: ["x"] });
  });
});
