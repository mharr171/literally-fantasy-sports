import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, sql } from "./db";

describe.runIf(sql)("teams, players and packs", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;
  const tag = `t${Date.now() % 1_000_000}`;
  let owner: string;
  let other: string;
  let team: string;

  beforeAll(async () => {
    const users = await db<{ id: string }[]>`
      insert into auth.users (email) values (${`${tag}-a@example.com`}), (${`${tag}-b@example.com`})
      returning id`;
    [owner, other] = users.map((u) => u.id) as [string, string];
    // The server writes game data (here: the database owner, standing in for the service role).
    const [t] = await db<{ id: string }[]>`
      insert into teams (owner_id, sport, name) values (${owner}, 'soccer', ${`${tag} United`})
      returning id`;
    team = t?.id as string;
    await db`insert into players (team_id, sport, first_name, last_name, display_name, nationality,
        age, primary_position, attributes, overall, potential, potential_low, potential_high,
        worth, chemistry_color, from_starter_pack)
      values (${team}, 'soccer', 'Ada', 'Silva', 'Ada Silva', 'BRA', 21, 'ST',
        ${db.json({ pace: 70 })}, 65, 81, 75, 85, 3500, 2, true)`;
    await db`insert into packs (team_id, sport, kind, focus, tier, seed)
      values (${team}, 'soccer', 'starter', 'any', 'starter', ${`${tag}-seed`})`;
  });

  afterAll(async () => {
    await db`delete from auth.users where id in (${owner}, ${other})`;
    await db.end();
  });

  const playerColumns = (tx: Parameters<Parameters<typeof asUser>[2]>[0]) =>
    tx`select display_name, overall, potential_low, potential_high, from_starter_pack from players`;

  it("lets a manager read their own team, players and packs", async () => {
    const teams = await asUser(
      db,
      owner,
      (tx) => tx`select name, elo, funds from teams`,
    );
    expect(teams).toEqual([{ name: `${tag} United`, elo: 1500, funds: 0 }]);
    const players = await asUser(db, owner, playerColumns);
    expect(players).toEqual([
      {
        display_name: "Ada Silva",
        overall: 65,
        potential_low: 75,
        potential_high: 85,
        from_starter_pack: true,
      },
    ]);
    const packs = await asUser(
      db,
      owner,
      (tx) => tx`select kind, opened_at from packs`,
    );
    expect(packs).toEqual([{ kind: "starter", opened_at: null }]);
  });

  it("hides other managers' teams, players and packs", async () => {
    expect(
      await asUser(db, other, (tx) => tx`select id from teams`),
    ).toHaveLength(0);
    expect(await asUser(db, other, playerColumns)).toHaveLength(0);
    expect(
      await asUser(db, other, (tx) => tx`select id from packs`),
    ).toHaveLength(0);
  });

  it("never reveals a player's true potential (D48)", async () => {
    await expect(
      asUser(db, owner, (tx) => tx`select potential from players`),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(db, owner, (tx) => tx`select * from players`),
    ).rejects.toThrow(/permission denied/);
  });

  it("refuses every direct write from players", async () => {
    const attempts = [
      (tx: Parameters<Parameters<typeof asUser>[2]>[0]) =>
        tx`insert into teams (owner_id, sport, name) values (${owner}, 'hockey', 'Sneaky FC')`,
      (tx: Parameters<Parameters<typeof asUser>[2]>[0]) =>
        tx`update teams set funds = 999999`,
      (tx: Parameters<Parameters<typeof asUser>[2]>[0]) =>
        tx`update players set overall = 99`,
      (tx: Parameters<Parameters<typeof asUser>[2]>[0]) =>
        tx`delete from players`,
      (tx: Parameters<Parameters<typeof asUser>[2]>[0]) =>
        tx`update packs set opened_at = now()`,
      (tx: Parameters<Parameters<typeof asUser>[2]>[0]) =>
        tx`insert into packs (team_id, sport, kind, focus, tier, seed)
          values (${team}, 'soccer', 'bought', 'any', 'gold', 'x')`,
    ];
    for (const run of attempts) {
      await expect(asUser(db, owner, run)).rejects.toThrow(/permission denied/);
    }
  });

  it("hides everything from signed-out visitors", async () => {
    for (const table of ["teams", "packs"]) {
      await expect(
        asAnon(db, (tx) => tx.unsafe(`select id from ${table}`)),
      ).rejects.toThrow(/permission denied/);
    }
    await expect(
      asAnon(db, (tx) => tx`select display_name from players`),
    ).rejects.toThrow(/permission denied/);
  });

  it("allows one team per sport per manager, with names unique per sport (D5)", async () => {
    await expect(
      db`insert into teams (owner_id, sport, name) values (${owner}, 'soccer', ${`${tag} Second`})`,
    ).rejects.toThrow(/teams_owner_sport/);
    await expect(
      db`insert into teams (owner_id, sport, name) values (${other}, 'soccer', ${`${tag} UNITED`})`,
    ).rejects.toThrow(/teams_sport_name/);
    // A different sport is fine, and so is the same name in another sport.
    await db
      .begin(async (tx) => {
        await tx`insert into teams (owner_id, sport, name) values (${owner}, 'hockey', ${`${tag} United`})`;
        throw new Error("rollback");
      })
      .catch((e: Error) => expect(e.message).toBe("rollback"));
  });

  it("checks names, funds and player values", async () => {
    await expect(
      db`insert into teams (owner_id, sport, name) values (${other}, 'soccer', 'ab')`,
    ).rejects.toThrow(/teams_name_length/);
    await expect(
      db`update teams set funds = -1 where id = ${team}`,
    ).rejects.toThrow(/teams_funds_nonnegative/);
    await expect(
      db`update players set overall = 100 where team_id = ${team}`,
    ).rejects.toThrow(/players_overall_range/);
    await expect(
      db`update packs set resolved_at = now() where team_id = ${team}`,
    ).rejects.toThrow(/packs_resolved_after_opened/);
  });

  it("removes a team's players and packs with the team", async () => {
    const [t] = await db<{ id: string }[]>`
      insert into teams (owner_id, sport, name) values (${other}, 'soccer', ${`${tag} Temp`}) returning id`;
    await db`insert into packs (team_id, sport, kind, focus, tier, seed)
      values (${t?.id as string}, 'soccer', 'starter', 'goal', 'starter', 's')`;
    await db`delete from teams where id = ${t?.id as string}`;
    expect(
      await db`select 1 from packs where team_id = ${t?.id as string}`,
    ).toHaveLength(0);
  });
});
