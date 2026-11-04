import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asService, asUser, sql } from "./db";

describe.runIf(sql)("team snapshots: ghosts and leaderboard (D19, D59)", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;
  const tag = `g${Date.now() % 1_000_000}`;
  let owner: string;
  let rival: string;
  let team: string;
  let rivalTeam: string;
  let snapshot: string;

  beforeAll(async () => {
    const users = await db<{ id: string }[]>`
      insert into auth.users (email) values (${`${tag}-a@example.com`}), (${`${tag}-b@example.com`})
      returning id`;
    [owner, rival] = users.map((u) => u.id) as [string, string];
    const teams = await db<{ id: string }[]>`
      insert into teams (owner_id, sport, name)
      values (${owner}, 'soccer', ${`${tag} Owls`}), (${rival}, 'soccer', ${`${tag} Hawks`})
      returning id`;
    [team, rivalTeam] = teams.map((t) => t.id) as [string, string];
    const [s] = await db<{ id: string }[]>`
      insert into seasons (team_id, sport, number, status, seed, start_elo, config_version)
      values (${rivalTeam}, 'soccer', 1, 'finished', 'x', 1500, 'defaults') returning id`;
    const [snap] = await db<{ id: string }[]>`
      insert into team_snapshots (team_id, season_id, sport, team_name, season_number, elo,
        players, squad, stats, game_version)
      values (${rivalTeam}, ${s?.id as string}, 'soccer', ${`${tag} Hawks`}, 1, 1620,
        '[]', '{}', '{"position":1}', '0.4.0') returning id`;
    snapshot = snap?.id as string;
  });

  afterAll(async () => {
    await db`delete from auth.users where id in (${owner}, ${rival})`;
    await db.end();
  });

  it("keeps rosters away from managers and visitors", async () => {
    for (const run of [
      (fn: Parameters<typeof asAnon>[1]) => asAnon(db, fn),
      (fn: Parameters<typeof asAnon>[1]) => asUser(db, owner, fn),
      (fn: Parameters<typeof asAnon>[1]) => asUser(db, rival, fn),
    ]) {
      await expect(
        run((tx) => tx`select team_name from team_snapshots`),
      ).rejects.toThrow(/permission denied/);
      await expect(run((tx) => tx`delete from team_snapshots`)).rejects.toThrow(
        /permission denied/,
      );
    }
  });

  it("lets a league include a ghost, which turns into an AI club if its snapshot goes", async () => {
    const result = await asService(db, async (tx) => {
      const [s] = await tx<{ id: string }[]>`
        select public.start_season(${team}, 'seed', 'defaults',
          ${tx.json([
            {
              slot: 0,
              kind: "manager",
              name: "Owls",
              start_rating: 1500,
              snapshot_id: null,
            },
            {
              slot: 1,
              kind: "ghost",
              name: "Hawks",
              start_rating: 1620,
              snapshot_id: snapshot,
            },
          ])},
          ${tx.json([{ week: 1, stage: "league", home_slot: 0, away_slot: 1 }])}) as id`;
      const before = await tx`select kind, snapshot_id from season_teams
        where season_id = ${s?.id as string} and slot = 1`;
      await tx`delete from team_snapshots where id = ${snapshot}`;
      const after = await tx`select kind, snapshot_id from season_teams
        where season_id = ${s?.id as string} and slot = 1`;
      return { before, after };
    });
    expect(result.before).toEqual([{ kind: "ghost", snapshot_id: snapshot }]);
    expect(result.after).toEqual([{ kind: "ghost", snapshot_id: null }]);
  });

  it("allows one snapshot per season and removes them with the team", async () => {
    await expect(
      db`insert into team_snapshots (team_id, season_id, sport, team_name, season_number, elo,
          players, squad, stats, game_version)
        select team_id, season_id, sport, team_name, 1, 1, '[]', '{}', '{}', 'x'
        from team_snapshots where id = ${snapshot}`,
    ).rejects.toThrow(/team_snapshots_season/);
  });
});
