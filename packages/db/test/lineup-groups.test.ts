import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, sql } from "./db";

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

  it("lets managers read their own squad's lineup_data", async () => {
    await db`insert into matchday_squads (team_id, lineup_data)
      values (${team}, ${db.json({ formation: "4-4-2", starters: ["x"], bench: [], subPlan: [] })})`;
    const rows = await asUser(
      db,
      owner,
      (tx) =>
        tx`select lineup_data from matchday_squads where team_id = ${team}`,
    );
    expect(rows[0]?.lineup_data).toMatchObject({ starters: ["x"] });
  });
});
