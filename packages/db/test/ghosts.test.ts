import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asService, asUser, sql } from "./db";

type Tx = Parameters<Parameters<typeof asService>[1]>[0];

const roster = (name: string) => ({
  players: [{ id: "p1", displayName: name }],
  squad: { formation: "4-4-2", lineup: [], bench: [], subPlan: [] },
});

describe.runIf(sql)(
  "ghosts: one per real club, from its best season (D115, D116)",
  () => {
    // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
    const db = sql!;
    const tag = `g${Date.now() % 1_000_000}`;
    let owner: string;
    let rival: string;
    let team: string;
    let rivalTeam: string;

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
    });

    afterAll(async () => {
      await db`delete from auth.users where id in (${owner}, ${rival})`;
      await db.end();
    });

    /** Plays out (on paper) and closes a season for the rival at this Elo. */
    const rivalSeason = async (tx: Tx, elo: number, name: string) => {
      const [s] = await tx<{ id: string }[]>`
      select public.start_season(${rivalTeam}, ${`s-${elo}-${name}`}, 'defaults',
        ${tx.json([{ slot: 0, kind: "manager", name: "Hawks", start_rating: 1500 }])},
        '[]') as id`;
      const season = s?.id as string;
      await tx`update seasons set status = 'finished', finished_at = now() where id = ${season}`;
      await tx`update teams set elo = ${elo} where id = ${rivalTeam}`;
      await tx`select public.close_season(${season}, '[]', '[]', '{}',
      ${tx.json({ ...roster(name), stats: { position: 1 }, game_version: "1.2.0" })})`;
      await tx`update seasons set intake_resolved_at = now() where id = ${season}`;
      return season;
    };

    it("keeps the ghost from the club's best season by Elo", async () => {
      const result = await asService(db, async (tx) => {
        const first = await rivalSeason(tx, 1600, "First");
        const [a] =
          await tx`select season_id, elo, players from ghosts where team_id = ${rivalTeam}`;
        await rivalSeason(tx, 1550, "Worse");
        const [b] =
          await tx`select season_id, elo from ghosts where team_id = ${rivalTeam}`;
        const best = await rivalSeason(tx, 1650, "Best");
        const [c] =
          await tx`select season_id, elo, players from ghosts where team_id = ${rivalTeam}`;
        const [records] =
          await tx`select count(*)::int as n from season_records where team_id = ${rivalTeam}`;
        return { first, a, b, best, c, records };
      });
      expect(result.a).toMatchObject({
        season_id: result.first,
        elo: 1600,
        players: [{ id: "p1", displayName: "First" }],
      });
      // A worse season leaves the ghost alone; every season still gets a record.
      expect(result.b).toMatchObject({ season_id: result.first, elo: 1600 });
      expect(result.c).toMatchObject({
        season_id: result.best,
        elo: 1650,
        players: [{ id: "p1", displayName: "Best" }],
      });
      expect(result.records).toEqual({ n: 3 });
    });

    it("copies a ghost into a league when it starts, frozen for the season", async () => {
      const result = await asService(db, async (tx) => {
        await rivalSeason(tx, 1600, "Before");
        const [s] = await tx<{ id: string }[]>`
        select public.start_season(${team}, 'seed', 'defaults',
          ${tx.json([
            { slot: 0, kind: "manager", name: "Owls", start_rating: 1500 },
            {
              slot: 1,
              kind: "ghost",
              name: "Hawks",
              start_rating: 1600,
              source_team_id: rivalTeam,
            },
            { slot: 2, kind: "ai", name: "Bees", start_rating: 1400 },
          ])},
          '[]') as id`;
        const season = s?.id as string;
        // The rival then has a better season: the league keeps its copy.
        await rivalSeason(tx, 1700, "After");
        const places = await tx`select slot, kind, source_team_id, clone
        from season_teams where season_id = ${season} order by slot`;
        await tx`savepoint a`;
        const own =
          await tx`select public.start_season(${rivalTeam}, 'own', 'defaults',
          ${tx.json([
            { slot: 0, kind: "manager", name: "Hawks", start_rating: 1700 },
            {
              slot: 1,
              kind: "ghost",
              name: "Hawks",
              start_rating: 1700,
              source_team_id: rivalTeam,
            },
          ])}, '[]')`.then(
            () => "ok",
            (e: Error) => e.message,
          );
        await tx`rollback to savepoint a`;
        return { places, own };
      });
      expect(result.places).toEqual([
        { slot: 0, kind: "manager", source_team_id: null, clone: null },
        {
          slot: 1,
          kind: "ghost",
          source_team_id: rivalTeam,
          clone: roster("Before"),
        },
        { slot: 2, kind: "ai", source_team_id: null, clone: null },
      ]);
      expect(result.own).toMatch(/own ghost/);
    });

    it("keeps rosters away from managers and visitors", async () => {
      for (const run of [
        (fn: Parameters<typeof asAnon>[1]) => asAnon(db, fn),
        (fn: Parameters<typeof asAnon>[1]) => asUser(db, owner, fn),
        (fn: Parameters<typeof asAnon>[1]) => asUser(db, rival, fn),
      ]) {
        await expect(
          run((tx) => tx`select team_name from ghosts`),
        ).rejects.toThrow(/permission denied/);
        await expect(run((tx) => tx`delete from ghosts`)).rejects.toThrow(
          /permission denied/,
        );
      }
      // Managers never read the league copies either (clone is server-only).
      await expect(
        asUser(db, owner, (tx) => tx`select clone from season_teams`),
      ).rejects.toThrow(/permission denied/);
    });
  },
);
