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
      potential_low, potential_high, worth, chemistry_color, stats)
    values (${team}, 'soccer', ${name}, 'X', ${`${name} X`}, 'ENG', 25, 'ST',
      '{}', 60, 60, 58, 62, 1000, 1,
      ${tx.json({ games: 10, goals, wins: 6, assists: 2 })})
    returning id`;

  it("ranks current and retired players together for the hall of fame", async () => {
    const result = await asService(db, async (tx) => {
      await addPlayer(tx, "Bea", 9);
      await addPlayer(tx, "Cal", 3);
      await tx`
        insert into player_careers (team_id, sport, first_name, last_name,
          display_name, nationality, primary_position, retired_age, seasons,
          appearances, goals, stats, best_overall, clubs, retired_season)
        values (${team}, 'soccer', 'Dov', 'X', 'Dov X', 'ENG', 'ST', 35, 10,
          200, 50, ${tx.json({ games: 200, goals: 7 })}, 80, ${[`${tag} Rovers`]}, 3)`;
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

  it("saves soccer's week the same sent by key as sent as fields (ADR 0009 §5)", async () => {
    const week = {
      games: 1,
      wins: 1,
      draws: 0,
      losses: 0,
      goals: 2,
      assists: 1,
      tackles: 3,
      saves: 0,
    };
    const result = await asService(db, async (tx) => {
      const [a] = await addPlayer(tx, "Gil", 4);
      const [b] = await addPlayer(tx, "Hal", 4);
      const [s] = await tx<{ id: string }[]>`
        select public.start_season(${team}, 'seed', 'defaults',
          ${tx.json([
            { slot: 0, kind: "manager", name: "Mine", start_rating: 1500 },
            { slot: 1, kind: "ai", name: "Them", start_rating: 1500 },
          ])},
          ${tx.json([{ week: 1, stage: "league", home_slot: 0, away_slot: 1 }])}) as id`;
      const [f] = await tx<{ id: string }[]>`
        select id from fixtures where season_id = ${s?.id as string}`;
      const condition = {
        fitness: 90,
        injured_days: 0,
        suspended_games: 0,
        yellow_cards: 0,
        form: 0.1,
        appeared: true,
        minutes: 90,
      };
      await tx`select public.record_week(${s?.id as string}, 1,
        ${tx.json([{ id: f?.id, home_score: 2, away_score: 0, winner: null, summary: null, manager_team: null }])},
        '{}', 0, '[]', 'regular', 2, null, null,
        ${tx.json([
          { id: a?.id, ...condition, ...week },
          { id: b?.id, ...condition, stats: week },
        ])}, null)`;
      return tx`
        select first_name, fitness, appearances, goals, season_minutes, stats
        from players where id in (${a?.id as string}, ${b?.id as string}) order by first_name`;
    });
    const [fields, byKey] = result;
    expect(byKey).toEqual({ ...fields, first_name: "Hal" });
    expect(fields?.stats).toMatchObject({
      games: 11,
      goals: 6,
      wins: 7,
      assists: 3,
      tackles: 3,
    });
  });
});
