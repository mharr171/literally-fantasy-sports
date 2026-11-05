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

describe.runIf(sql)("account reset (D141, ADR 0004)", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;
  const tag = `ra${Date.now() % 1_000_000}`;
  let owner: string;
  let other: string;
  let team: string;
  let otherTeam: string;

  beforeAll(async () => {
    const [u, o] = await db<{ id: string }[]>`
      insert into auth.users (email) values
        (${`${tag}a@example.com`}), (${`${tag}b@example.com`})
      returning id`;
    owner = u?.id as string;
    other = o?.id as string;
    const [t] = await db<{ id: string }[]>`
      insert into teams (owner_id, sport, name) values (${owner}, 'soccer', ${`${tag} City`})
      returning id`;
    team = t?.id as string;
    const [ot] = await db<{ id: string }[]>`
      insert into teams (owner_id, sport, name) values (${other}, 'soccer', ${`${tag} Rovers`})
      returning id`;
    otherTeam = ot?.id as string;
  });

  afterAll(async () => {
    await db`delete from auth.users where id in (${owner}, ${other})`;
    await db.end();
  });

  it("deletes the club and what belongs to it, keeps the account and other leagues' copies", async () => {
    const result = await asService(db, async (tx) => {
      await tx`insert into players (team_id, sport, first_name, last_name, display_name,
          nationality, age, primary_position, attributes, overall, potential,
          potential_low, potential_high, worth, chemistry_color)
        values (${team}, 'soccer', 'A', 'B', 'A B', 'ENG', 22, 'CM', '{}', 60, 70, 65, 75, 2000, 1)`;
      const [s] = await tx<{ id: string }[]>`
        insert into seasons (team_id, sport, number, seed, start_elo, config_version)
        values (${team}, 'soccer', 1, 'seed', 1500, 'defaults') returning id`;
      await tx`insert into ghosts (team_id, season_id, sport, team_name, season_number, elo, players, squad, game_version)
        values (${team}, ${s?.id as string}, 'soccer', 'City', 1, 1550, '[]', '{}', 'test')`;
      // Another manager's league holds a frozen copy of this club.
      const [os] = await tx<{ id: string }[]>`
        insert into seasons (team_id, sport, number, seed, start_elo, config_version)
        values (${otherTeam}, 'soccer', 1, 'seed2', 1500, 'defaults') returning id`;
      await tx`insert into season_teams (season_id, slot, kind, name, start_rating, elo, source_team_id, clone)
        values (${os?.id as string}, 1, 'ghost', 'City', 1550, 1550, ${team}, '{"players": [], "squad": {}}')`;

      const wrong = await attempt(
        tx,
        () => tx`select public.reset_account(${owner}, 'Not my club')`,
      );
      const [r] = await tx<{ counts: Record<string, number> }[]>`
        select public.reset_account(${owner}, ${`${tag} City`}) as counts`;
      const left = await tx`select
          (select count(*)::int from teams where id = ${team}) as teams,
          (select count(*)::int from players where team_id = ${team}) as players,
          (select count(*)::int from seasons where team_id = ${team}) as seasons,
          (select count(*)::int from ghosts where team_id = ${team}) as ghosts,
          (select count(*)::int from profiles where id = ${owner}) as profile,
          (select count(*)::int from teams where id = ${otherTeam}) as other_team`;
      const [copy] = await tx<
        { source_team_id: string | null; name: string }[]
      >`
        select source_team_id, name from season_teams where season_id = ${os?.id as string}`;
      const [log] = await tx`select team_name, action from admin_actions
        where team_id = ${team} and action = 'account_reset'`;
      return { wrong, counts: r?.counts, left: left[0], copy, log };
    });
    expect(result.wrong).toMatch(/club name does not match/);
    expect(result.counts).toMatchObject({ players: 1, seasons: 1, ghost: 1 });
    expect(result.left).toEqual({
      teams: 0,
      players: 0,
      seasons: 0,
      ghosts: 0,
      profile: 1,
      other_team: 1,
    });
    expect(result.copy).toEqual({ source_team_id: null, name: "City" });
    expect(result.log).toEqual({
      team_name: `${tag} City`,
      action: "account_reset",
    });
  });

  it("refuses an account with no club", async () => {
    const error = await asService(db, (tx) =>
      attempt(tx, async () => {
        await tx`delete from teams where id = ${team}`;
        await tx`select public.reset_account(${owner}, 'x')`;
      }),
    );
    expect(error).toMatch(/no club to reset/);
  });

  it("can't be called by a manager directly, so nobody resets anyone else", async () => {
    const error = await asUser(db, other, (tx) =>
      attempt(
        tx,
        () => tx`select public.reset_account(${owner}, ${`${tag} City`})`,
      ),
    );
    expect(error).toMatch(/permission denied/);
  });
});
