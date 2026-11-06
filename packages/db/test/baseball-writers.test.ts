import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asService, sql } from "./db";

type Tx = Parameters<Parameters<typeof asService>[1]>[0];

const SLOTS = [
  { slot: 0, kind: "manager", name: "Mine Sox", start_rating: 1500 },
  { slot: 1, kind: "ai", name: "Port Hawks", start_rating: 1480 },
  { slot: 2, kind: "ai", name: "Bay Owls", start_rating: 1520 },
];
// Week 0 is the club's bye (ADR 0009 §2); week 1 a 3-game series.
const FIXTURES = [1, 2, 3].flatMap((g) => [
  { week: 0, stage: "league", game_no: g, home_slot: 1, away_slot: 2 },
  { week: 1, stage: "league", game_no: g, home_slot: 0, away_slot: 1 },
]);

describe.runIf(sql)("baseball's season writers (ADR 0009 §4, §5)", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;
  const tag = `bw${Date.now() % 1_000_000}`;
  let owner: string;
  let team: string;

  beforeAll(async () => {
    const [u] = await db<{ id: string }[]>`
      insert into auth.users (email) values (${`${tag}@example.com`}) returning id`;
    owner = u?.id as string;
    const [t] = await db<{ id: string }[]>`
      insert into teams (owner_id, sport, name) values (${owner}, 'baseball', ${`${tag} Sox`})
      returning id`;
    team = t?.id as string;
  });

  afterAll(async () => {
    await db`delete from auth.users where id = ${owner}`;
    await db.end();
  });

  const addPitcher = (tx: Tx, teamId = team) => tx<{ id: string }[]>`
    insert into players (team_id, sport, first_name, last_name, display_name,
      nationality, age, primary_position, attributes, overall, potential,
      potential_low, potential_high, worth, chemistry_color, fitness, yellow_cards,
      traits, stats)
    values (${teamId}, 'baseball', 'Al', 'X', 'Al X', 'USA', 25, 'P', '{}', 60,
      60, 58, 62, 1000, 1, 100, 0, ${tx.json({ role: "SP", throws: "L" })},
      ${tx.json({ games: 4, strikeouts: 20 })})
    returning id`;
  const start = async (tx: Tx) => {
    const [s] = await tx<{ id: string }[]>`
      select public.start_season(${team}, 'seed', 'baseball:1',
        ${tx.json(SLOTS)}, ${tx.json(FIXTURES)}) as id`;
    return s?.id as string;
  };
  const games = (tx: Tx, season: string, week: number) =>
    tx<
      { id: string; game_no: number }[]
    >`select id, game_no from fixtures where season_id = ${season} and week = ${week} order by game_no`;
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
  const record = (
    tx: Tx,
    season: string,
    week: number,
    results: unknown[],
    players: unknown[] = [],
    next: unknown[] = [],
  ) =>
    tx`select public.record_week(${season}, ${week}, ${tx.json(results as never)},
      ${tx.json({ "0": 1508 })}, 300, ${tx.json(next as never)}, 'regular', ${week + 1},
      null, null, ${tx.json(players as never)}, null)`;

  it("starts at week 0 with each series' games numbered", async () => {
    const result = await asService(db, async (tx) => {
      const season = await start(tx);
      const [row] = await tx`select week from seasons where id = ${season}`;
      const fx = await tx`
        select week, event, game_no from fixtures where season_id = ${season}
        order by week, game_no`;
      return { row, fx };
    });
    expect(result.row).toEqual({ week: 0 });
    expect(result.fx).toEqual(
      [0, 1].flatMap((week) =>
        [1, 2, 3].map((g) => ({ week, event: "main", game_no: g })),
      ),
    );
  });

  it("records the bye week, then a series: stats by key, rest days, no fitness or cards", async () => {
    const result = await asService(db, async (tx) => {
      const [p] = await addPitcher(tx);
      const id = p?.id as string;
      const season = await start(tx);
      const score = (g: { id: string }) => ({
        id: g.id,
        home_score: 4,
        away_score: 2,
        winner: null,
        summary: null,
        manager_team: null,
      });
      await record(tx, season, 0, (await games(tx, season, 0)).map(score));
      await record(
        tx,
        season,
        1,
        (await games(tx, season, 1)).map(score),
        [
          {
            id,
            rest_days: 5,
            stats: { games: 1, strikeouts: 7, outsPitched: 21 },
          },
        ],
        [{ week: 2, stage: "quarter", game_no: 2, home_slot: 0, away_slot: 1 }],
      );
      const [player] = await tx`
        select fitness, yellow_cards, rest_days, stats, goals from players where id = ${id}`;
      const [s] = await tx`select week from seasons where id = ${season}`;
      const next = await tx`
        select event, stage, game_no from fixtures where season_id = ${season} and week = 2`;
      return { player, s, next };
    });
    expect(result.player).toEqual({
      fitness: 100,
      yellow_cards: 0,
      rest_days: 5,
      stats: { games: 5, strikeouts: 27, outsPitched: 21 },
      goals: 0,
    });
    expect(result.s).toEqual({ week: 2 });
    expect(result.next).toEqual([
      { event: "main", stage: "quarter", game_no: 2 },
    ]);
  });

  it("accepts a week with games its series didn't need, marked skipped", async () => {
    const result = await asService(db, async (tx) => {
      const season = await start(tx);
      const [g1, g2, g3] = await games(tx, season, 0);
      const played = (g?: { id: string }) => ({
        id: g?.id,
        home_score: 3,
        away_score: 1,
        winner: "home",
        summary: null,
        manager_team: null,
      });
      const skipped = (g?: { id: string }) => ({
        id: g?.id,
        home_score: null,
        away_score: null,
        winner: null,
        summary: null,
        manager_team: null,
        skipped: true,
      });
      const unscored = await attempt(
        tx,
        record(tx, season, 0, [
          played(g1),
          played(g2),
          { ...skipped(g3), skipped: false },
        ]),
      );
      const scoredSkip = await attempt(
        tx,
        record(tx, season, 0, [
          played(g1),
          played(g2),
          { ...played(g3), skipped: true },
        ]),
      );
      const missing = await attempt(
        tx,
        record(tx, season, 0, [played(g1), played(g2)]),
      );
      await record(tx, season, 0, [played(g1), played(g2), skipped(g3)]);
      const rows = await tx`
        select game_no, home_score, skipped, played_at is not null as played
        from fixtures where season_id = ${season} and week = 0 order by game_no`;
      return { unscored, scoredSkip, missing, rows };
    });
    expect(result.unscored).toMatch(/needs a score/);
    expect(result.scoredSkip).toMatch(/needs a score/);
    expect(result.missing).toMatch(/results do not match/);
    expect(result.rows).toEqual([
      { game_no: 1, home_score: 3, skipped: false, played: true },
      { game_no: 2, home_score: 3, skipped: false, played: true },
      { game_no: 3, home_score: null, skipped: true, played: false },
    ]);
  });

  it("refuses stats that aren't whole numbers of 0 or more under a stat key", async () => {
    const result = await asService(db, async (tx) => {
      const [p] = await addPitcher(tx);
      const season = await start(tx);
      const scores = (await games(tx, season, 0)).map((g) => ({
        id: g.id,
        home_score: 1,
        away_score: 0,
        winner: null,
        summary: null,
        manager_team: null,
      }));
      const with_ = (stats: unknown) =>
        attempt(tx, record(tx, season, 0, scores, [{ id: p?.id, stats }]));
      return [
        await with_({ hits: -1 }),
        await with_({ hits: 1.5 }),
        await with_({ hits: "2" }),
        await with_({ "Bad Key": 1 }),
        await with_([1]),
      ];
    });
    expect(result.slice(0, 4).every((m) => /whole number/.test(m))).toBe(true);
    expect(result[4]).toMatch(/must be an object/);
  });

  it("carries traits through starter packs, youth and league copies", async () => {
    const result = await asService(db, async (tx) => {
      await tx`
        insert into packs (team_id, sport, kind, focus, tier, seed, opened_at)
        values (${team}, 'baseball', 'starter', 'relievers', 'standard', ${`${tag}-p`}, now())`;
      const traits = { role: "RP", bats: "S", throws: "R" };
      await tx`select public.resolve_starter_packs(${team}, ${tx.json([
        {
          first_name: "Bo",
          last_name: "Y",
          display_name: "Bo Y",
          nationality: "USA",
          age: 23,
          primary_position: "P",
          secondary_position: null,
          attributes: {},
          overall: 55,
          potential: 70,
          potential_low: 65,
          potential_high: 75,
          worth: 900,
          chemistry_color: 2,
          template_variant: "default",
          traits,
        },
      ])}, '{}')`;
      const [kept] = await tx`
        select traits, from_starter_pack from players where team_id = ${team} and first_name = 'Bo'`;
      // An AI club's copy carries its players' traits.
      const [ai] = await tx<{ id: string }[]>`
        select public.create_ai_team('baseball', ${`${tag} AI`}, '{navy,white}', 'Di Roe',
          '{}', '[]') as id`;
      const [aiPlayer] = await addPitcher(tx, ai?.id);
      await tx`insert into matchday_squads (team_id, lineup_data) values (${ai?.id as string}, '{}')`;
      const [s] = await tx<{ id: string }[]>`
        select public.start_season(${team}, 'seed', 'baseball:1',
          ${tx.json([
            SLOTS[0],
            { ...SLOTS[1], kind: "ghost", source_team_id: ai?.id },
          ] as never)}, ${tx.json([{ week: 1, stage: "league", home_slot: 0, away_slot: 1 }])}) as id`;
      const [copy] = await tx<
        { clone: { players: { id: string; traits?: unknown }[] } }[]
      >`
        select clone from season_teams where season_id = ${s?.id as string} and slot = 1`;
      return {
        kept,
        copied: copy?.clone.players.find((x) => x.id === aiPlayer?.id)?.traits,
      };
    });
    expect(result.kept).toEqual({
      traits: { role: "RP", bats: "S", throws: "R" },
      from_starter_pack: true,
    });
    expect(result.copied).toEqual({ role: "SP", throws: "L" });
  });
});
