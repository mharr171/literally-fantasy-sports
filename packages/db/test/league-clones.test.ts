import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asService, asUser, sql } from "./db";

const PROFILE = { personality: "steady", pace: "normal", formation: "4-4-2" };

describe.runIf(sql)("leagues of copied clubs (D115)", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;
  const tag = `lc${Date.now() % 1_000_000}`;
  let owner: string;
  let team: string;
  let ai: string;
  let player: string;

  beforeAll(async () => {
    const [u] = await db<{ id: string }[]>`
      insert into auth.users (email) values (${`${tag}@example.com`}) returning id`;
    owner = u?.id as string;
    const [t] = await db<{ id: string }[]>`
      insert into teams (owner_id, sport, name) values (${owner}, 'soccer', ${`${tag} City`})
      returning id`;
    team = t?.id as string;
    const [a] = await db<{ id: string }[]>`
      select public.create_ai_team('soccer', ${`${tag} Athletic`}, '{teal,white}', 'Cy Doe',
        ${db.json(PROFILE)}, '[]') as id`;
    ai = a?.id as string;
    const [p] = await db<{ id: string }[]>`
      insert into players (team_id, sport, first_name, last_name, display_name, nationality,
        age, primary_position, attributes, overall, potential, potential_low, potential_high,
        worth, chemistry_color)
      values (${ai}, 'soccer', 'Al', 'Y', 'Al Y', 'ENG', 24, 'ST', '{"finishing":70}', 66, 80, 70, 82, 2000, 1)
      returning id`;
    player = p?.id as string;
    await db`insert into matchday_squads (team_id, lineup_data)
      values (${ai}, ${db.json({ formation: "4-4-2", starters: [player], bench: [], subPlan: [] })})`;
  });

  afterAll(async () => {
    await db`delete from teams where id in (${team}, ${ai})`;
    await db`delete from auth.users where id = ${owner}`;
    await db.end();
  });

  it("copies an AI club as it is now, with its colors, and never its hidden potential", async () => {
    const result = await asService(db, async (tx) => {
      const [s] = await tx<{ id: string }[]>`
        select public.start_season(${team}, 'seed', 'defaults',
          ${tx.json([
            { slot: 0, kind: "manager", name: "City", start_rating: 1500 },
            {
              slot: 1,
              kind: "ghost",
              name: "Athletic",
              start_rating: 1500,
              source_team_id: ai,
            },
          ])},
          '[]') as id`;
      // The AI club changes afterwards: the league keeps its copy.
      await tx`update players set overall = 99 where id = ${player}`;
      const [place] = await tx`select clone, colors from season_teams
        where season_id = ${s?.id as string} and slot = 1`;
      return place;
    });
    expect(result?.colors).toEqual(["teal", "white"]);
    expect(result?.clone).toEqual({
      players: [
        {
          id: player,
          displayName: "Al Y",
          attributes: { finishing: 70 },
          primaryPosition: "ST",
          secondaryPosition: null,
          chemistryColor: 1,
          overall: 66,
          templateVariant: "default",
          secondaryTemplateVariant: "default",
        },
      ],
      squad: { formation: "4-4-2", lineup: [player], bench: [], subPlan: [] },
    });
    expect(JSON.stringify(result?.clone)).not.toMatch(/potential/);
  });

  it("lets managers see their league's colors but not the copies", async () => {
    expect(
      await asUser(db, owner, (tx) => tx`select colors from season_teams`),
    ).toEqual([]);
    await expect(
      asUser(db, owner, (tx) => tx`select clone from season_teams`),
    ).rejects.toThrow(/permission denied/);
  });

  it("drops an AI club's fixtures and copies once its season is closed", async () => {
    const result = await asService(db, async (tx) => {
      const [s] = await tx<{ id: string }[]>`
        select public.start_season(${ai}, 'ai-seed', 'defaults',
          ${tx.json([
            { slot: 0, kind: "manager", name: "Athletic", start_rating: 1500 },
            { slot: 1, kind: "ai", name: "X", start_rating: 1500 },
          ])},
          ${tx.json([{ week: 1, stage: "league", home_slot: 0, away_slot: 1 }])}) as id`;
      const season = s?.id as string;
      await tx`update season_teams set clone = '{"players":[]}' where season_id = ${season} and slot = 1`;
      await tx`update seasons set status = 'finished', finished_at = now(), closed_at = now()
        where id = ${season}`;
      const [pruned] = await tx`select public.prune_old_data() as r`;
      const fixtures =
        await tx`select 1 from fixtures where season_id = ${season}`;
      const copies =
        await tx`select 1 from season_teams where season_id = ${season} and clone is not null`;
      return { pruned: pruned?.r, fixtures, copies };
    });
    expect(result.pruned).toMatchObject({
      ai_fixtures_deleted: 1,
      ai_clones_cleared: 1,
    });
    expect(result.fixtures).toEqual([]);
    expect(result.copies).toEqual([]);
  });
});
