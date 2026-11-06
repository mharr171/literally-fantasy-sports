import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asUser, sql } from "./db";

describe.runIf(sql)("baseball's columns (ADR 0009 §2–§4)", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;
  const tag = `bb${Date.now() % 1_000_000}`;
  let owner: string;
  let soccerTeam: string;
  let baseballTeam: string;

  beforeAll(async () => {
    const [u] = await db<{ id: string }[]>`
      insert into auth.users (email) values (${`${tag}@example.com`}) returning id`;
    owner = u?.id as string;
    const [s] = await db<{ id: string }[]>`
      insert into teams (owner_id, sport, name) values (${owner}, 'soccer', ${`${tag} Town`})
      returning id`;
    soccerTeam = s?.id as string;
    const [b] = await db<{ id: string }[]>`
      insert into teams (owner_id, sport, name) values (${owner}, 'baseball', ${`${tag} Sox`})
      returning id`;
    baseballTeam = b?.id as string;
  });

  afterAll(async () => {
    await db`delete from auth.users where id = ${owner}`;
    await db.end();
  });

  const addPlayer = (restDays: number, traits: unknown) => db<{ id: string }[]>`
    insert into players (team_id, sport, first_name, last_name, display_name,
      nationality, age, primary_position, attributes, overall, potential,
      potential_low, potential_high, worth, chemistry_color, rest_days, traits)
    values (${baseballTeam}, 'baseball', 'Al', 'X', 'Al X', 'USA', 25, 'P', '{}',
      60, 60, 58, 62, 1000, 1, ${restDays}, ${db.json(traits as never)})
    returning id`;

  const fails = async (query: Promise<unknown>) =>
    query.then(
      () => "ok",
      (e: Error) => e.message,
    );

  it("starts every player rested with no traits", async () => {
    const [p] = await db<{ rest_days: number; traits: unknown }[]>`
      insert into players (team_id, sport, first_name, last_name, display_name,
        nationality, age, primary_position, attributes, overall, potential,
        potential_low, potential_high, worth, chemistry_color)
      values (${soccerTeam}, 'soccer', 'Bo', 'Y', 'Bo Y', 'ENG', 25, 'CB', '{}',
        60, 60, 58, 62, 1000, 1)
      returning rest_days, traits`;
    expect(p).toEqual({ rest_days: 0, traits: {} });
  });

  it("lets managers read their own players' rest days and traits, never change them", async () => {
    const traits = { role: "SP", bats: "L", throws: "L" };
    const [p] = await addPlayer(4, traits);
    const id = p?.id as string;
    const own = await asUser(
      db,
      owner,
      (tx) => tx`select rest_days, traits from players where id = ${id}`,
    );
    expect(own[0]).toEqual({ rest_days: 4, traits });
    const update = await fails(
      asUser(
        db,
        owner,
        (tx) => tx`update players set rest_days = 0 where id = ${id}`,
      ),
    );
    expect(update).toMatch(/permission denied/);
  });

  it("keeps rest days between 0 and 30 and traits an object", async () => {
    expect(await fails(addPlayer(-1, {}))).toMatch(/players_rest_days/);
    expect(await fails(addPlayer(31, {}))).toMatch(/players_rest_days/);
    expect(await fails(addPlayer(0, [1, 2]))).toMatch(/players_traits/);
  });

  it("allows each sport's own pack focuses only (D221)", async () => {
    const pack = (team: string, sport: string, focus: string) =>
      fails(db`
        insert into packs (team_id, sport, kind, focus, tier, seed)
        values (${team}, ${sport}, 'starter', ${focus}, 'standard', ${`${tag}-${focus}`})`);
    for (const focus of ["starters", "relievers", "infield", "outfield", "any"])
      expect(await pack(baseballTeam, "baseball", focus)).toBe("ok");
    expect(await pack(soccerTeam, "soccer", "attack")).toBe("ok");
    expect(await pack(baseballTeam, "baseball", "attack")).toMatch(
      /packs_focus/,
    );
    expect(await pack(soccerTeam, "soccer", "relievers")).toMatch(
      /packs_focus/,
    );
  });

  it("records a wildcard exit, and marks unneeded series games as never played", async () => {
    const def = (name: string) => db<{ def: string }[]>`
      select pg_get_constraintdef(oid) as def from pg_constraint where conname = ${name}`;
    expect((await def("season_records_playoffs"))[0]?.def).toContain(
      "'wildcard'",
    );
    expect((await def("fixtures_skipped_unplayed"))[0]?.def).toMatch(
      /NOT skipped\) OR \(home_score IS NULL\)/,
    );
    const [col] = await db<{ column_default: string; is_nullable: string }[]>`
      select column_default, is_nullable from information_schema.columns
      where table_name = 'fixtures' and column_name = 'skipped'`;
    expect(col).toEqual({ column_default: "false", is_nullable: "NO" });
  });
});
