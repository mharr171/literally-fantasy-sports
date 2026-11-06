import { readFileSync } from "node:fs";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asService, asUser, sql } from "./db";

// The backfill statement from the migration, so the test runs exactly it.
const BACKFILL = (
  readFileSync(
    new URL(
      "../migrations/0078_account_progress_backfill.sql",
      import.meta.url,
    ),
    "utf8",
  )
    .split("--> statement-breakpoint")
    .find((s) => s.includes("INSERT INTO")) ?? ""
).trim();

describe.runIf(sql)("account progress (D206.9)", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;
  const tag = `ap${Date.now() % 1_000_000}`;
  let owner: string;
  let other: string;
  let team: string;
  let aiTeam: string;

  beforeAll(async () => {
    const users = await db<{ id: string }[]>`
      insert into auth.users (email)
      values (${`${tag}a@example.com`}), (${`${tag}b@example.com`}) returning id`;
    [owner, other] = users.map((u) => u.id) as [string, string];
    const [t] = await db<{ id: string }[]>`
      insert into teams (owner_id, sport, name, elo, colors)
      values (${owner}, 'soccer', ${`${tag} Rovers`}, 1540, '{red,white}') returning id`;
    team = t?.id as string;
    const [ai] = await db<{ id: string }[]>`
      insert into teams (owner_id, sport, name, elo, colors, kind, manager_name, ai)
      values (null, 'soccer', ${`${tag} Bots`}, 1500, '{blue,white}', 'ai', 'X', '{}')
      returning id`;
    aiTeam = ai?.id as string;
  });

  afterAll(async () => {
    await db`delete from teams where id = ${aiTeam}`;
    await db`delete from auth.users where id in (${owner}, ${other})`;
    await db.end();
  });

  const record = (
    tx: Parameters<Parameters<typeof asService>[1]>[0],
    teamId: string,
    n: number,
    playoffs: string,
    eloAfter: number,
  ) => tx`
    insert into season_records (team_id, sport, season_number, team_name,
      elo_before, elo_after, position, played, won, drawn, lost, scored,
      conceded, points, playoffs)
    values (${teamId}, 'soccer', ${n}, 'X', 1500, ${eloAfter}, 1, 14, 8, 3, 3,
      20, 10, 27, ${playoffs})`;

  it("backfills a row per season, title, final and season-end Elo", async () => {
    const rows = await asService(db, async (tx) => {
      await record(tx, team, 1, "none", 1520);
      await record(tx, team, 2, "final", 1560);
      await record(tx, team, 3, "champion", 1610);
      await record(tx, aiTeam, 1, "champion", 1700);
      // Clear what the season-close trigger wrote, so only the backfill fills it.
      await tx`delete from account_progress where owner_id = ${owner}`;
      await tx.unsafe(BACKFILL);
      return tx<{ kind: string; n: number; total: number; best: number }[]>`
        select kind, count(*)::int as n, sum(value)::int as total, max(value)::int as best
        from account_progress where owner_id = ${owner}
        group by kind order by kind`;
    });
    expect(rows).toEqual([
      { kind: "best_elo", n: 3, total: 1520 + 1560 + 1610, best: 1610 },
      { kind: "final", n: 2, total: 2, best: 1 },
      { kind: "season_played", n: 3, total: 3, best: 1 },
      { kind: "title", n: 1, total: 1, best: 1 },
    ]);
  });

  it("records a manager's milestones as each season closes", async () => {
    const rows = await asService(db, async (tx) => {
      await record(tx, team, 1, "semi", 1530);
      await record(tx, team, 2, "champion", 1590);
      await record(tx, aiTeam, 1, "champion", 1700);
      const ai = await tx`select 1 from account_progress where value = 1700`;
      expect(ai).toHaveLength(0);
      return tx<{ kind: string; season_number: number; value: number }[]>`
        select kind, season_number, value from account_progress
        where owner_id = ${owner} order by season_number, kind`;
    });
    expect(rows).toEqual([
      { kind: "best_elo", season_number: 1, value: 1530 },
      { kind: "season_played", season_number: 1, value: 1 },
      { kind: "best_elo", season_number: 2, value: 1590 },
      { kind: "final", season_number: 2, value: 1 },
      { kind: "season_played", season_number: 2, value: 1 },
      { kind: "title", season_number: 2, value: 1 },
    ]);
  });

  it("sums each manager's progress per sport for admins only", async () => {
    const rows = await asService(db, async (tx) => {
      await record(tx, team, 1, "final", 1530);
      await record(tx, team, 2, "champion", 1590);
      await record(tx, team, 3, "none", 1560);
      return tx`select sport, seasons, titles, finals, best_elo
        from public.account_progress_summary() where owner_id = ${owner}`;
    });
    expect([...rows]).toEqual([
      { sport: "soccer", seasons: 3, titles: 1, finals: 2, best_elo: 1590 },
    ]);
    await expect(
      asUser(
        db,
        owner,
        (tx) => tx`select * from public.account_progress_summary()`,
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("lets a manager read only their own progress", async () => {
    await db`
      insert into account_progress (owner_id, sport, kind, value, season_number)
      values (${owner}, 'soccer', 'season_played', 1, 1),
             (${other}, 'soccer', 'season_played', 1, 1)`;
    const mine = await asUser(
      db,
      owner,
      (tx) => tx<{ owner_id: string }[]>`select owner_id from account_progress`,
    );
    expect(mine.map((r) => r.owner_id)).toEqual([owner]);
  });

  it("refuses writes from managers and anything from visitors", async () => {
    await expect(
      asUser(
        db,
        owner,
        (tx) => tx`
          insert into account_progress (owner_id, sport, kind, value, season_number)
          values (${owner}, 'soccer', 'title', 1, 9)`,
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asAnon(db, (tx) => tx`select 1 from account_progress`),
    ).rejects.toThrow(/permission denied/);
  });

  it("keeps progress when the club is deleted", async () => {
    const left = await asService(db, async (tx) => {
      await tx`delete from teams where id = ${team}`;
      return tx<{ n: number }[]>`
        select count(*)::int as n from account_progress where owner_id = ${owner}`;
    });
    expect(left[0]?.n).toBe(1);
  });
});
