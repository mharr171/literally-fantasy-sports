import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asService, asUser, sql } from "./db";

type Tx = Parameters<Parameters<typeof asService>[1]>[0];

describe.runIf(sql)("stats by key (ADR 0007 §2)", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;
  const tag = `k${Date.now() % 1_000_000}`;
  let owner: string;
  let team: string;

  beforeAll(async () => {
    const [u] = await db<{ id: string }[]>`
      insert into auth.users (email) values (${`${tag}@example.com`}) returning id`;
    owner = u?.id as string;
    const [t] = await db<{ id: string }[]>`
      insert into teams (owner_id, sport, name) values (${owner}, 'soccer', ${`${tag} Rovers`})
      returning id`;
    team = t?.id as string;
  });

  afterAll(async () => {
    await db`delete from auth.users where id = ${owner}`;
    await db.end();
  });

  const addPlayer = (tx: Tx, name: string, goals: number) => tx<
    { id: string }[]
  >`
    insert into players (team_id, sport, first_name, last_name, display_name,
      nationality, age, primary_position, attributes, overall, potential,
      potential_low, potential_high, worth, chemistry_color, stat_games,
      stat_goals, wins, assists)
    values (${team}, 'soccer', ${name}, 'X', ${`${name} X`}, 'ENG', 25, 'ST',
      '{}', 60, 60, 58, 62, 1000, 1, 10, ${goals}, 6, 2)
    returning id`;

  it("copies the stat columns into stats on insert and on every change", async () => {
    const result = await asService(db, async (tx) => {
      const [p] = await addPlayer(tx, "Ada", 4);
      const id = p?.id as string;
      const [inserted] = await tx`select stats from players where id = ${id}`;
      // record_week adds to the columns; a key another sport keeps stays.
      await tx`update players set stats = stats || '{"spare": 1}' where id = ${id}`;
      await tx`update players set stat_goals = stat_goals + 2, stat_games = stat_games + 1
        where id = ${id}`;
      const [updated] = await tx`select stats from players where id = ${id}`;
      return { inserted, updated };
    });
    expect(result.inserted?.stats).toEqual({
      games: 10,
      wins: 6,
      draws: 0,
      losses: 0,
      goals: 4,
      assists: 2,
      tackles: 0,
      saves: 0,
    });
    expect(result.updated?.stats).toMatchObject({
      games: 11,
      goals: 6,
      spare: 1,
    });
  });

  it("ranks current and retired players together for the hall of fame", async () => {
    const result = await asService(db, async (tx) => {
      await addPlayer(tx, "Bea", 9);
      await addPlayer(tx, "Cal", 3);
      await tx`
        insert into player_careers (team_id, sport, first_name, last_name,
          display_name, nationality, primary_position, retired_age, seasons,
          appearances, goals, stat_games, stat_goals, best_overall, clubs,
          retired_season)
        values (${team}, 'soccer', 'Dov', 'X', 'Dov X', 'ENG', 'ST', 35, 10,
          200, 50, 200, 7, 80, ${[`${tag} Rovers`]}, 3)`;
      const [r] = await tx<
        {
          list: {
            name: string;
            value: number;
            retired: boolean;
            club: string;
          }[];
        }[]
      >`
        select public.hall_of_fame_players('soccer', 'goals', 25) as list`;
      return (r?.list ?? []).filter((p) => p.club === `${tag} Rovers`);
    });
    expect(result.map((p) => [p.name, p.value, p.retired])).toEqual([
      ["Bea X", 9, false],
      ["Dov X", 7, true],
      ["Cal X", 3, false],
    ]);
  });

  it("lets managers read their players' stats, and only the server rank them", async () => {
    await asService(db, (tx) => addPlayer(tx, "Eve", 1));
    // asService rolls back, so add one that stays for the manager to read.
    const [p] = await addPlayer(db as unknown as Tx, "Fay", 2);
    const rows = await asUser(
      db,
      owner,
      (tx) => tx`select stats from players where id = ${p?.id as string}`,
    );
    expect(rows[0]?.stats).toMatchObject({ goals: 2 });
    for (const run of [
      (fn: Parameters<typeof asAnon>[1]) => asAnon(db, fn),
      (fn: Parameters<typeof asAnon>[1]) => asUser(db, owner, fn),
    ])
      await expect(
        run(
          (tx: Tx) =>
            tx`select public.hall_of_fame_players('soccer', 'goals', 25)`,
        ),
      ).rejects.toThrow(/permission denied/);
  });
});
