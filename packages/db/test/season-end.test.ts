import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asService, asUser, sql } from "./db";

type Tx = Parameters<Parameters<typeof asService>[1]>[0];

const SLOTS = [
  { slot: 0, kind: "manager", name: "Mine FC", start_rating: 1500 },
  { slot: 1, kind: "ai", name: "Ashvale City", start_rating: 1400 },
];
const FIXTURES = [{ week: 1, stage: "league", home_slot: 0, away_slot: 1 }];
const SNAPSHOT = {
  players: [{ id: "p1", displayName: "Al Y" }],
  squad: { formation: "4-4-2", lineup: [], bench: [], subPlan: [] },
  stats: { position: 2, points: 30, playoffs: "final" },
  game_version: "0.4.0",
};
const prospect = (name: string) => ({
  first_name: name,
  last_name: "Young",
  display_name: `${name} Young`,
  nationality: "ENG",
  age: 17,
  primary_position: "ST",
  secondary_position: null,
  attributes: { pace: 50 },
  overall: 45,
  potential: 70,
  potential_low: 62,
  potential_high: 72,
  worth: 1500,
  chemistry_color: 2,
  template_variant: "default",
});

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

describe.runIf(sql)("season end and youth intake (D35, D53)", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;
  const tag = `e${Date.now() % 1_000_000}`;
  let owner: string;
  let team: string;
  let young: string;
  let old: string;

  beforeAll(async () => {
    const [u] = await db<{ id: string }[]>`
      insert into auth.users (email) values (${`${tag}@example.com`}) returning id`;
    owner = u?.id as string;
    const [t] = await db<{ id: string }[]>`
      insert into teams (owner_id, sport, name) values (${owner}, 'soccer', ${`${tag} Borough`})
      returning id`;
    team = t?.id as string;
    const ps = await db<{ id: string }[]>`
      insert into players (team_id, sport, first_name, last_name, display_name, nationality,
        age, primary_position, attributes, overall, potential, potential_low, potential_high,
        worth, chemistry_color)
      values (${team}, 'soccer', 'Al', 'Y', 'Al Y', 'ENG', 19, 'CM', '{}', 55, 75, 70, 80, 2000, 1),
             (${team}, 'soccer', 'Bo', 'O', 'Bo O', 'ENG', 36, 'CB', '{}', 60, 60, 58, 62, 500, 2)
      returning id`;
    [young, old] = ps.map((p) => p.id) as [string, string];
  });

  afterAll(async () => {
    await db`delete from auth.users where id = ${owner}`;
    await db.end();
  });

  /** A season that has finished its playoffs. */
  const finishedSeason = async (tx: Tx) => {
    const [s] = await tx<{ id: string }[]>`
      select public.start_season(${team}, 'seed', 'defaults', ${tx.json(SLOTS)}, ${tx.json(FIXTURES)}) as id`;
    await tx`update seasons set status = 'finished', finished_at = now() where id = ${s?.id as string}`;
    return s?.id as string;
  };

  it("ages players, removes retirees and closes the season once", async () => {
    const result = await asService(db, async (tx) => {
      const season = await finishedSeason(tx);
      const close = () =>
        tx`select public.close_season(${season},
          ${tx.json([{ id: young, age: 20, attributes: { passing: 61 }, overall: 61, worth: 2600 }])},
          ${tx.json([old])}, ${tx.json({ retired: [{ name: "Bo O", age: 37 }] })}, ${tx.json(SNAPSHOT)})`;
      await close();
      const twice = await attempt(tx, close());
      const players =
        await tx`select id, age, overall, worth from players where team_id = ${team}`;
      const [row] =
        await tx`select closed_at is not null as closed, review from seasons where id = ${season}`;
      return { twice, players, row };
    });
    expect(result.twice).toMatch(/cannot be closed/);
    expect(result.players).toEqual([
      { id: young, age: 20, overall: 61, worth: 2600 },
    ]);
    expect(result.row).toEqual({
      closed: true,
      review: { retired: [{ name: "Bo O", age: 37 }] },
    });
  });

  it("grants one reward pack for the playoff finish, which opens and sorts like a bought pack (D181)", async () => {
    const result = await asService(db, async (tx) => {
      const season = await finishedSeason(tx);
      const close = () =>
        tx`select public.close_season_with_reward(${season}, '[]', '[]', '{}', ${tx.json(SNAPSHOT)}, 4)`;
      await close();
      const twice = await attempt(tx, close());
      const packs = await tx<
        {
          id: string;
          kind: string;
          tier: string;
          elo_shift: number;
          opened: boolean;
        }[]
      >`select id, kind, tier, elo_shift, opened_at is not null as opened
        from packs where team_id = ${team} and kind = 'reward'`;
      const pack = packs[0]?.id as string;
      await tx`select public.open_reward_pack(${team}, ${pack})`;
      const buyWhileOpen = await attempt(
        tx,
        tx`select public.buy_pack_with_choices(${team}, 'any', 'basic', 100, 0, '{}')`,
      );
      await tx`select public.resolve_bought_pack(${team}, ${pack}, '[]', '[]', 700)`;
      const again = await attempt(
        tx,
        tx`select public.open_reward_pack(${team}, ${pack})`,
      );
      const [done] =
        await tx`select resolved_at is not null as done from packs where id = ${pack}`;
      // A club out in the quarter-finals gets nothing.
      await tx`select public.resolve_youth_intake(${season}, '[]', '[]')`;
      const next = await finishedSeason(tx);
      await tx`select public.close_season_with_reward(${next}, '[]', '[]', '{}',
        ${tx.json({ ...SNAPSHOT, stats: { ...SNAPSHOT.stats, playoffs: "quarter" } })}, 0)`;
      const [count] = await tx<{ n: number }[]>`
        select count(*)::int as n from packs where team_id = ${team} and kind = 'reward'`;
      return {
        twice,
        packs: packs.map(({ id: _, ...p }) => p),
        again,
        buyWhileOpen,
        done,
        count,
      };
    });
    expect(result.twice).toMatch(/cannot be closed/);
    expect(result.packs).toEqual([
      { kind: "reward", tier: "silver", elo_shift: 4, opened: false },
    ]);
    expect(result.again).toMatch(/not waiting/);
    expect(result.buyWhileOpen).toMatch(/finish your open pack/);
    expect(result.done).toEqual({ done: true });
    expect(result.count).toEqual({ n: 1 });
  });

  it("lets only the server grant or open reward packs", async () => {
    for (const run of [
      (fn: Parameters<typeof asAnon>[1]) => asAnon(db, fn),
      (fn: Parameters<typeof asAnon>[1]) => asUser(db, owner, fn),
    ])
      for (const call of [
        (tx: Tx) =>
          tx`select public.close_season_with_reward(gen_random_uuid(), '[]', '[]', '{}', '{}', 0)`,
        (tx: Tx) =>
          tx`select public.open_reward_pack(${team}, gen_random_uuid())`,
      ])
        await expect(run(call)).rejects.toThrow(/permission denied/);
  });

  it("refuses to close a season that's still being played", async () => {
    await expect(
      asService(db, async (tx) => {
        const [s] = await tx<{ id: string }[]>`
          select public.start_season(${team}, 'seed', 'defaults', ${tx.json(SLOTS)}, ${tx.json(FIXTURES)}) as id`;
        await tx`select public.close_season(${s?.id as string}, '[]', '[]', '{}', ${tx.json(SNAPSHOT)})`;
      }),
    ).rejects.toThrow(/cannot be closed/);
  });

  it("adds taken prospects once, then lets the next season start", async () => {
    const result = await asService(db, async (tx) => {
      const season = await finishedSeason(tx);
      const early = await attempt(
        tx,
        tx`select public.resolve_youth_intake(${season}, '[]', '[]')`,
      );
      const startBeforeWrapUp = await attempt(
        tx,
        tx`select public.start_season(${team}, 's2', 'defaults', ${tx.json(SLOTS)}, ${tx.json(FIXTURES)})`,
      );
      await tx`select public.close_season(${season}, '[]', '[]', '{}', ${tx.json(SNAPSHOT)})`;
      await tx`select public.resolve_youth_intake(${season},
        ${tx.json([prospect("Cy"), prospect("Di")])}, ${tx.json([3, 7])})`;
      const twice = await attempt(
        tx,
        tx`select public.resolve_youth_intake(${season}, ${tx.json([prospect("Ed")])}, '[]')`,
      );
      const rookies =
        await tx`select first_name, age, from_starter_pack from players
        where team_id = ${team} and age = 17 order by first_name`;
      const [row] =
        await tx`select intake_taken from seasons where id = ${season}`;
      const [next] = await tx<{ id: string }[]>`
        select public.start_season(${team}, 's2', 'defaults', ${tx.json(SLOTS)}, ${tx.json(FIXTURES)}) as id`;
      const [n] =
        await tx`select number from seasons where id = ${next?.id as string}`;
      return { early, startBeforeWrapUp, twice, rookies, row, n };
    });
    expect(result.early).toMatch(/not open/);
    expect(result.startBeforeWrapUp).toMatch(/not wrapped up/);
    expect(result.twice).toMatch(/not open/);
    expect(result.rookies).toEqual([
      { first_name: "Cy", age: 17, from_starter_pack: false },
      { first_name: "Di", age: 17, from_starter_pack: false },
    ]);
    expect(result.row).toEqual({ intake_taken: [3, 7] });
    expect(result.n).toEqual({ number: 2 });
  });

  it("lets only the server call them; managers can read the review", async () => {
    for (const run of [
      (fn: Parameters<typeof asAnon>[1]) => asAnon(db, fn),
      (fn: Parameters<typeof asAnon>[1]) => asUser(db, owner, fn),
    ]) {
      await expect(
        run(
          (tx) =>
            tx`select public.close_season(gen_random_uuid(), '[]', '[]', '{}', '{}')`,
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        run(
          (tx) =>
            tx`select public.resolve_youth_intake(gen_random_uuid(), '[]', '[]')`,
        ),
      ).rejects.toThrow(/permission denied/);
    }
    expect(
      await asUser(
        db,
        owner,
        (tx) => tx`select review, intake_taken, closed_at from seasons`,
      ),
    ).toEqual([]);
  });
});
