import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asService, asUser, sql } from "./db";

describe.runIf(sql)("condition in days and games (ADR 0007 §5)", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;
  const tag = `d${Date.now() % 1_000_000}`;
  let owner: string;
  let team: string;

  beforeAll(async () => {
    const [u] = await db<{ id: string }[]>`
      insert into auth.users (email) values (${`${tag}@example.com`}) returning id`;
    owner = u?.id as string;
    const [t] = await db<{ id: string }[]>`
      insert into teams (owner_id, sport, name) values (${owner}, 'soccer', ${`${tag} Town`})
      returning id`;
    team = t?.id as string;
  });

  afterAll(async () => {
    await db`delete from auth.users where id = ${owner}`;
    await db.end();
  });

  const add = (injured: number, banned: number) => db<{ id: string }[]>`
    insert into players (team_id, sport, first_name, last_name, display_name,
      nationality, age, primary_position, attributes, overall, potential,
      potential_low, potential_high, worth, chemistry_color, injured_weeks,
      suspended_weeks)
    values (${team}, 'soccer', 'Al', 'X', 'Al X', 'ENG', 25, 'CB', '{}', 60,
      60, 58, 62, 1000, 1, ${injured}, ${banned})
    returning id`;

  it("keeps days and games equal to soccer's weeks on insert and every change", async () => {
    const [p] = await add(3, 1);
    const id = p?.id as string;
    const result = await asService(db, async (tx) => {
      const [inserted] =
        await tx`select injured_days, suspended_games from players where id = ${id}`;
      await tx`update players set injured_weeks = 2, suspended_weeks = 0 where id = ${id}`;
      const [updated] =
        await tx`select injured_days, suspended_games from players where id = ${id}`;
      return { inserted, updated };
    });
    expect(result.inserted).toEqual({ injured_days: 3, suspended_games: 1 });
    expect(result.updated).toEqual({ injured_days: 2, suspended_games: 0 });
    const own = await asUser(
      db,
      owner,
      (tx) =>
        tx`select injured_days, suspended_games from players where id = ${id}`,
    );
    expect(own[0]).toEqual({ injured_days: 3, suspended_games: 1 });
  });
});
