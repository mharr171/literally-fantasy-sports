import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asService, asUser, sql } from "./db";

type Tx = Parameters<Parameters<typeof asService>[1]>[0];

/** Runs `query` and returns "ok" or the error message, rolling back on error. */
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

const PROFILE = { personality: "steady", pace: "normal", formation: "4-4-2" };

describe.runIf(sql)("admin soft reset (D142, ADR 0004)", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;
  const tag = `sr${Date.now() % 1_000_000}`;
  let admin: string;
  let owner: string;
  let team: string;
  let ai: string;

  beforeAll(async () => {
    const [a, o] = await db<{ id: string }[]>`
      insert into auth.users (email) values
        (${`${tag}a@example.com`}), (${`${tag}o@example.com`})
      returning id`;
    admin = a?.id as string;
    owner = o?.id as string;
    await db`update profiles set is_admin = true where id = ${admin}`;
    const [t] = await db<{ id: string }[]>`
      insert into teams (owner_id, sport, name) values (${owner}, 'soccer', ${`${tag} City`})
      returning id`;
    team = t?.id as string;
    const [x] = await db<{ id: string }[]>`
      select public.create_ai_team('soccer', ${`${tag} Athletic`}, '{teal,white}', 'Cy Doe',
        ${db.json(PROFILE)}, '[]') as id`;
    ai = x?.id as string;
  });

  afterAll(async () => {
    await db`delete from teams where id in (${team}, ${ai})`;
    await db`delete from auth.users where id in (${admin}, ${owner})`;
    await db.end();
  });

  /** Gives a club a played history and a worn-out, well-used player. */
  const history = async (tx: Tx, id: string, n: number) => {
    await tx`update teams set elo = 1620, funds = 42, morale = 1, energy = 0 where id = ${id}`;
    await tx`insert into players (team_id, sport, first_name, last_name, display_name,
        nationality, age, primary_position, attributes, overall, potential,
        potential_low, potential_high, worth, chemistry_color, fitness,
        injured_days, suspended_games, yellow_cards, form, appearances, goals,
        seasons, best_overall, stats, season_minutes)
      values (${id}, 'soccer', 'A', 'B', 'A B', 'ENG', 25, 'CM',
        ${tx.json({ passing: 71 })}, 64, 70, 65, 75, 2000, 2, 55, 3, 1, 2, 0.8,
        30, 9, 2, 68,
        ${tx.json({ games: 30, goals: 9, wins: 12, draws: 8, losses: 10, assists: 4, tackles: 20, saves: 0 })},
        900)`;
    const [s] = await tx<{ id: string }[]>`
      insert into seasons (team_id, sport, number, seed, start_elo, config_version)
      values (${id}, 'soccer', ${n}, ${`seed${n}`}, 1500, 'defaults') returning id`;
    await tx`insert into season_records (team_id, season_id, sport, season_number,
        team_name, elo_before, elo_after, position, played, won, drawn, lost,
        scored, conceded, points, playoffs)
      values (${id}, ${s?.id as string}, 'soccer', ${n}, 'X', 1500, 1620, 1, 30, 20,
        5, 5, 60, 20, 65, 'none')`;
    await tx`insert into ghosts (team_id, season_id, sport, team_name, season_number, elo, players, squad, game_version)
      values (${id}, ${s?.id as string}, 'soccer', 'X', ${n}, 1620, '[]', '{}', 'test')`;
    await tx`insert into player_careers (team_id, sport, first_name, last_name,
        display_name, nationality, primary_position, retired_age, seasons, best_overall, clubs, retired_season,
        appearances, goals)
      values (${id}, 'soccer', 'Old', 'Hand', 'Old Hand', 'ENG', 'ST', 35, 10, 80, '{X}', 1, 300, 90)`;
  };

  const state = (tx: Tx, id: string) =>
    tx`select
        (select row_to_json(t) from (select elo, funds, morale, energy from teams where id = ${id}) t) as club,
        (select row_to_json(p) from (select attributes, overall, potential, fitness,
          injured_days, suspended_games, yellow_cards, form, appearances, goals,
          seasons, best_overall, stats, season_minutes
          from players where team_id = ${id} and first_name = 'A') p) as player,
        (select count(*)::int from seasons where team_id = ${id}) as seasons,
        (select count(*)::int from season_records where team_id = ${id}) as records,
        (select count(*)::int from ghosts where team_id = ${id}) as ghosts,
        (select count(*)::int from player_careers where team_id = ${id}) as careers`.then(
      (r) => r[0],
    );

  it("resets real clubs to the start, keeps and heals their players, and leaves AI clubs alone", async () => {
    const result = await asService(db, async (tx) => {
      await history(tx, team, 1);
      await history(tx, ai, 1);
      const aiBefore = await state(tx, ai);
      const [p] = await tx<{ counts: Record<string, number> }[]>`
        select public.admin_soft_reset_preview('real') as counts`;
      const [r] = await tx<{ counts: Record<string, number> }[]>`
        select public.admin_soft_reset(${admin}, 'real', 'RESET REAL') as counts`;
      const [log] =
        await tx`select team_name, action, details->>'scope' as scope
        from admin_actions where admin_id = ${admin} and action = 'soft_reset'`;
      return {
        preview: p?.counts,
        counts: r?.counts,
        real: await state(tx, team),
        aiBefore,
        aiAfter: await state(tx, ai),
        log,
      };
    });
    expect(result.counts).toEqual(result.preview);
    expect(result.counts?.season_records).toBeGreaterThanOrEqual(1);
    expect(result.real).toEqual({
      club: { elo: 1500, funds: 10000, morale: 0, energy: 6 },
      player: {
        attributes: { passing: 71 },
        overall: 64,
        potential: 70,
        fitness: 100,
        injured_days: 0,
        suspended_games: 0,
        yellow_cards: 0,
        form: 0,
        appearances: 0,
        goals: 0,
        seasons: 0,
        best_overall: 64,
        stats: {},
        season_minutes: 0,
      },
      seasons: 0,
      records: 0,
      ghosts: 0,
      careers: 0,
    });
    expect(result.aiAfter).toEqual(result.aiBefore);
    expect(result.aiAfter?.seasons).toBe(1);
    expect(result.log).toEqual({
      team_name: "Soft reset: REAL",
      action: "soft_reset",
      scope: "real",
    });
  });

  it("an AI reset touches only AI clubs", async () => {
    const result = await asService(db, async (tx) => {
      await history(tx, team, 1);
      await history(tx, ai, 1);
      await tx`select public.admin_soft_reset(${admin}, 'ai', 'RESET AI')`;
      return { real: await state(tx, team), ai: await state(tx, ai) };
    });
    expect(result.real?.seasons).toBe(1);
    expect(result.real?.club.elo).toBe(1620);
    expect(result.ai?.seasons).toBe(0);
    expect(result.ai?.club.elo).toBe(1500);
    expect(result.ai?.player.fitness).toBe(100);
  });

  it("refuses the wrong phrase, an unknown scope and a non-admin", async () => {
    const errors = await asService(db, async (tx) => ({
      wrong: await attempt(
        tx,
        () => tx`select public.admin_soft_reset(${admin}, 'all', 'RESET AI')`,
      ),
      scope: await attempt(
        tx,
        () =>
          tx`select public.admin_soft_reset(${admin}, 'some', 'RESET SOME')`,
      ),
      notAdmin: await attempt(
        tx,
        () => tx`select public.admin_soft_reset(${owner}, 'all', 'RESET ALL')`,
      ),
    }));
    expect(errors).toEqual({
      wrong: "type RESET ALL to confirm",
      scope: "unknown scope some",
      notAdmin: "only admins can soft reset",
    });
  });

  it("can't be called by a signed-in user, even an admin", async () => {
    const errors = await asUser(db, admin, async (tx) => ({
      run: await attempt(
        tx,
        () => tx`select public.admin_soft_reset(${admin}, 'all', 'RESET ALL')`,
      ),
      preview: await attempt(
        tx,
        () => tx`select public.admin_soft_reset_preview('all')`,
      ),
    }));
    expect(errors.run).toMatch(/permission denied/);
    expect(errors.preview).toMatch(/permission denied/);
  });
});
