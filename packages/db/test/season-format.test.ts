import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asService, sql } from "./db";

type Tx = Parameters<Parameters<typeof asService>[1]>[0];

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

const SLOTS = [
  { slot: 0, kind: "manager", name: "Mine FC", start_rating: 1500 },
  { slot: 1, kind: "ai", name: "Ashvale City", start_rating: 1400 },
];
const FIXTURES = [{ week: 1, stage: "league", home_slot: 0, away_slot: 1 }];

describe.runIf(sql)("events, stages and series (ADR 0007 §4)", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;
  const tag = `f${Date.now() % 1_000_000}`;
  let owner: string;
  let team: string;

  beforeAll(async () => {
    const [u] = await db<{ id: string }[]>`
      insert into auth.users (email) values (${`${tag}@example.com`}) returning id`;
    owner = u?.id as string;
    const [t] = await db<{ id: string }[]>`
      insert into teams (owner_id, sport, name) values (${owner}, 'soccer', ${`${tag} Athletic`})
      returning id`;
    team = t?.id as string;
  });

  afterAll(async () => {
    await db`delete from auth.users where id = ${owner}`;
    await db.end();
  });

  it("gives existing-style fixtures the main event and game 1, and takes any stage key", async () => {
    const result = await asService(db, async (tx) => {
      const [s] = await tx<{ id: string }[]>`
        select public.start_season(${team}, 'seed', 'defaults', ${tx.json(SLOTS)}, ${tx.json(FIXTURES)}) as id`;
      const season = s?.id as string;
      const [f] =
        await tx`select event, stage, game_no from fixtures where season_id = ${season}`;
      const series = await attempt(
        tx,
        tx`insert into fixtures (season_id, week, stage, game_no, home_slot, away_slot)
          values (${season}, 2, 'wildcard', 3, 0, 1)`,
      );
      const badStage = await attempt(
        tx,
        tx`insert into fixtures (season_id, week, stage, home_slot, away_slot)
          values (${season}, 2, 'Not A Key!', 0, 1)`,
      );
      const badGame = await attempt(
        tx,
        tx`insert into fixtures (season_id, week, stage, game_no, home_slot, away_slot)
          values (${season}, 2, 'final', 10, 0, 1)`,
      );
      const [settings] =
        await tx`select league_size from sport_settings where sport = 'soccer'`;
      return { f, series, badStage, badGame, settings };
    });
    expect(result.f).toEqual({ event: "main", stage: "league", game_no: 1 });
    expect(result.series).toBe("ok");
    expect(result.badStage).toMatch(/fixtures_stage/);
    expect(result.badGame).toMatch(/fixtures_game_no/);
    expect(result.settings).toEqual({ league_size: 12 });
  });
});
