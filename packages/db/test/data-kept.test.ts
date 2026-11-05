import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asService, asUser, sql } from "./db";

type Tx = Parameters<Parameters<typeof asService>[1]>[0];

const SLOTS = [
  { slot: 0, kind: "manager", name: "Mine FC", start_rating: 1500 },
  { slot: 1, kind: "ai", name: "Ashvale City", start_rating: 1400 },
  { slot: 2, kind: "ai", name: "Brookfield", start_rating: 1450 },
];
const FIXTURES = [
  { week: 1, stage: "league", home_slot: 0, away_slot: 1 },
  { week: 1, stage: "league", home_slot: 2, away_slot: 1 },
];
const STATS = {
  position: 2,
  played: 14,
  won: 8,
  drawn: 3,
  lost: 3,
  scored: 25,
  conceded: 14,
  points: 27,
  playoffs: "final",
};
const SUMMARY = {
  possession: { home: 0.5, away: 0.5 },
  shots: { home: 4, away: 3 },
  events: [],
};

describe.runIf(sql)("data kept (D120)", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;
  const tag = `k${Date.now() % 1_000_000}`;
  let owner: string;
  let team: string;
  let young: string;
  let old: string;

  beforeAll(async () => {
    const [u] = await db<{ id: string }[]>`
      insert into auth.users (email) values (${`${tag}@example.com`}) returning id`;
    owner = u?.id as string;
    const [t] = await db<{ id: string }[]>`
      insert into teams (owner_id, sport, name, elo, colors)
      values (${owner}, 'soccer', ${`${tag} Rovers`}, 1540, '{red,white}') returning id`;
    team = t?.id as string;
    const ps = await db<{ id: string }[]>`
      insert into players (team_id, sport, first_name, last_name, display_name, nationality,
        age, primary_position, attributes, overall, potential, potential_low, potential_high,
        worth, chemistry_color)
      values (${team}, 'soccer', 'Al', 'Y', 'Al Y', 'ENG', 19, 'ST', '{}', 55, 75, 70, 80, 2000, 1),
             (${team}, 'soccer', 'Bo', 'O', 'Bo O', 'ESP', 36, 'CB', '{}', 60, 60, 58, 62, 500, 2)
      returning id`;
    [young, old] = ps.map((p) => p.id) as [string, string];
  });

  afterAll(async () => {
    await db`delete from auth.users where id = ${owner}`;
    await db.end();
  });

  const startSeason = async (tx: Tx, seed: string) => {
    const [s] = await tx<{ id: string }[]>`
      select public.start_season(${team}, ${seed}, 'defaults', ${tx.json(SLOTS)}, ${tx.json(FIXTURES)}) as id`;
    return s?.id as string;
  };

  const playWeek = (tx: Tx, season: string, status = "regular") =>
    tx`select id from fixtures where season_id = ${season} order by home_slot`.then(
      async (rows) => {
        const [mine, other] = rows as unknown as { id: string }[];
        await tx`select public.record_week(${season}, 1,
          ${tx.json([
            {
              id: mine?.id as string,
              home_score: 2,
              away_score: 1,
              winner: null,
              summary: SUMMARY,
              manager_team: { team: {}, names: {} },
            },
            {
              id: other?.id as string,
              home_score: 0,
              away_score: 0,
              winner: null,
              summary: SUMMARY,
              manager_team: null,
            },
          ])},
          ${tx.json({ "0": 1540 })}, 1500, '[]', ${status}, 1, null, null,
          ${tx.json([
            {
              id: young,
              fitness: 90,
              injured_weeks: 0,
              suspended_weeks: 0,
              yellow_cards: 0,
              appeared: true,
              goals: 2,
            },
            {
              id: old,
              fitness: 95,
              injured_weeks: 0,
              suspended_weeks: 0,
              yellow_cards: 0,
              appeared: false,
              goals: 0,
            },
          ])}, null)`;
      },
    );

  it("counts appearances and goals, and keeps a season record and careers", async () => {
    const result = await asService(db, async (tx) => {
      const season = await startSeason(tx, "s1");
      await playWeek(tx, season, "finished");
      const counts =
        await tx`select display_name, appearances, goals from players
        where team_id = ${team} order by display_name`;
      await tx`select public.close_season(${season},
        ${tx.json([{ id: young, age: 20, attributes: {}, overall: 58, worth: 2600 }])},
        ${tx.json([old])}, '{}',
        ${tx.json({ players: [], squad: {}, stats: STATS, game_version: "1.2.0" })})`;
      const [record] = await tx`
        select season_number, team_name, colors, elo_before, elo_after, position,
          played, won, drawn, lost, scored, conceded, points, playoffs
        from season_records where season_id = ${season}`;
      const careers = await tx`
        select display_name, nationality, primary_position, retired_age, seasons,
          appearances, goals, best_overall, clubs, retired_season
        from player_careers where team_id = ${team}`;
      const [kept] = await tx`
        select seasons, best_overall, overall from players where id = ${young}`;
      return { counts, record, careers, kept };
    });
    expect(result.counts).toEqual([
      { display_name: "Al Y", appearances: 1, goals: 2 },
      { display_name: "Bo O", appearances: 0, goals: 0 },
    ]);
    expect(result.record).toEqual({
      season_number: 1,
      team_name: `${tag} Rovers`,
      colors: ["red", "white"],
      elo_before: 1540,
      elo_after: 1540,
      position: 2,
      played: 14,
      won: 8,
      drawn: 3,
      lost: 3,
      scored: 25,
      conceded: 14,
      points: 27,
      playoffs: "final",
    });
    expect(result.careers).toEqual([
      {
        display_name: "Bo O",
        nationality: "ESP",
        primary_position: "CB",
        retired_age: 36,
        seasons: 1,
        appearances: 0,
        goals: 0,
        best_overall: 60,
        clubs: [`${tag} Rovers`],
        retired_season: 1,
      },
    ]);
    // Best overall is taken before the season's change, then follows it up.
    expect(result.kept).toEqual({ seasons: 1, best_overall: 55, overall: 58 });
  });

  it("trims old seasons, other clubs' match details and sorted packs", async () => {
    const result = await asService(db, async (tx) => {
      const seasons: string[] = [];
      for (const n of [1, 2, 3]) {
        const season = await startSeason(tx, `p${n}`);
        await playWeek(tx, season, "finished");
        await tx`update seasons set closed_at = now(), intake_resolved_at = now() where id = ${season}`;
        seasons.push(season);
      }
      await tx`insert into packs (team_id, sport, kind, focus, tier, seed, opened_at, resolved_at)
        values (${team}, 'soccer', 'bought', 'any', 'basic', 'a', now() - interval '3 days', now() - interval '2 days'),
               (${team}, 'soccer', 'bought', 'any', 'basic', 'b', now(), now()),
               (${team}, 'soccer', 'bought', 'any', 'basic', 'c', null, null),
               (${team}, 'soccer', 'starter', 'any', 'starter', 'd', now() - interval '3 days', now() - interval '2 days')`;
      // League copies of older seasons go too (D115, D120).
      await tx`update season_teams set clone = '{"players":[]}'
        where slot = 1 and season_id in ${tx(seasons)}`;
      const [pruned] = await tx`select public.prune_old_data() as r`;
      const clones = await tx`select s.number from season_teams st
        join seasons s on s.id = st.season_id
        where st.clone is not null and s.id in ${tx(seasons)} order by s.number`;
      const fixtures = await tx`
        select s.number, f.home_slot, f.summary is not null as has_summary,
          f.summary ? 'possession' as full_summary, f.manager_team is not null as has_replay
        from fixtures f join seasons s on s.id = f.season_id
        where s.id in ${tx(seasons)} order by s.number, f.home_slot`;
      const packs =
        await tx`select seed from packs where team_id = ${team} order by seed`;
      const [again] = await tx`select public.prune_old_data() as r`;
      return { pruned: pruned?.r, fixtures, packs, again: again?.r, clones };
    });
    expect(result.pruned).toEqual({
      fixtures_deleted: 1,
      replays_cleared: 1,
      summaries_trimmed: 2,
      packs_deleted: 1,
      clones_cleared: 1,
      ai_fixtures_deleted: 0,
      ai_clones_cleared: 0,
    });
    expect(result.clones).toEqual([{ number: 2 }, { number: 3 }]);
    expect(result.fixtures).toEqual([
      // Season 1 is older than the previous one: own match only, no replay.
      {
        number: 1,
        home_slot: 0,
        has_summary: true,
        full_summary: true,
        has_replay: false,
      },
      {
        number: 2,
        home_slot: 0,
        has_summary: true,
        full_summary: true,
        has_replay: true,
      },
      {
        number: 2,
        home_slot: 2,
        has_summary: false,
        full_summary: null,
        has_replay: false,
      },
      {
        number: 3,
        home_slot: 0,
        has_summary: true,
        full_summary: true,
        has_replay: true,
      },
      {
        number: 3,
        home_slot: 2,
        has_summary: false,
        full_summary: null,
        has_replay: false,
      },
    ]);
    expect(result.packs).toEqual([{ seed: "b" }, { seed: "c" }, { seed: "d" }]);
    expect(result.again).toEqual({
      fixtures_deleted: 0,
      replays_cleared: 0,
      summaries_trimmed: 0,
      packs_deleted: 0,
      clones_cleared: 0,
      ai_fixtures_deleted: 0,
      ai_clones_cleared: 0,
    });
  });

  it("keeps the new records and the prune to the server", async () => {
    for (const run of [
      (fn: Parameters<typeof asAnon>[1]) => asAnon(db, fn),
      (fn: Parameters<typeof asAnon>[1]) => asUser(db, owner, fn),
    ]) {
      await expect(
        run((tx) => tx`select team_name from season_records`),
      ).rejects.toThrow(/permission denied/);
      await expect(
        run((tx) => tx`select display_name from player_careers`),
      ).rejects.toThrow(/permission denied/);
      await expect(
        run((tx) => tx`select public.prune_old_data()`),
      ).rejects.toThrow(/permission denied/);
    }
    // Managers can read their own players' totals.
    const own = await asUser(
      db,
      owner,
      (tx) =>
        tx`select appearances, goals, seasons, best_overall from players where id = ${young}`,
    );
    expect(own).toHaveLength(1);
  });
});
