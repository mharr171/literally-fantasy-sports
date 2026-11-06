import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, sql } from "./db";

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
      potential_low, potential_high, worth, chemistry_color, injured_days,
      suspended_games)
    values (${team}, 'soccer', 'Al', 'X', 'Al X', 'ENG', 25, 'CB', '{}', 60,
      60, 58, 62, 1000, 1, ${injured}, ${banned})
    returning id`;

  it("lets managers read their own players' days out and games banned", async () => {
    const [p] = await add(3, 1);
    const own = await asUser(
      db,
      owner,
      (tx) =>
        tx`select injured_days, suspended_games from players where id = ${p?.id as string}`,
    );
    expect(own[0]).toEqual({ injured_days: 3, suspended_games: 1 });
  });
});
