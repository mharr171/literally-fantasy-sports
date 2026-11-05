import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asService, sql } from "./db";

describe.runIf(sql)("12-club season rounds (D117)", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;
  const tag = `b${Date.now() % 1_000_000}`;
  let owner: string;
  let team: string;

  beforeAll(async () => {
    const [u] = await db<{ id: string }[]>`
      insert into auth.users (email) values (${`${tag}@example.com`}) returning id`;
    owner = u?.id as string;
    const [t] = await db<{ id: string }[]>`
      insert into teams (owner_id, sport, name) values (${owner}, 'soccer', ${`${tag} Albion`})
      returning id`;
    team = t?.id as string;
  });

  afterAll(async () => {
    await db`delete from auth.users where id = ${owner}`;
    await db.end();
  });

  it("stores play-in and quarter-final matches, and nothing else new", async () => {
    const result = await asService(db, async (tx) => {
      const [s] = await tx<{ id: string }[]>`
        select public.start_season(${team}, 'seed', 'defaults',
          ${tx.json([
            { slot: 0, kind: "manager", name: "Albion", start_rating: 1500 },
            { slot: 1, kind: "ai", name: "Rovers", start_rating: 1500 },
          ])},
          ${tx.json([
            { week: 23, stage: "play_in", home_slot: 0, away_slot: 1 },
            { week: 24, stage: "quarter", home_slot: 1, away_slot: 0 },
          ])}) as id`;
      const stages = await tx`select stage from fixtures
        where season_id = ${s?.id as string} order by week`;
      await tx`savepoint a`;
      const bad =
        await tx`insert into fixtures (season_id, week, stage, home_slot, away_slot)
        values (${s?.id as string}, 25, 'round_of_16', 0, 1)`.then(
          () => "ok",
          (e: Error) => e.message,
        );
      await tx`rollback to savepoint a`;
      return { stages, bad };
    });
    expect(result.stages).toEqual([{ stage: "play_in" }, { stage: "quarter" }]);
    expect(result.bad).toMatch(/fixtures_stage/);
  });
});
