import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql } from "./db";

/** The one-time backfill: the statements after the functions in the D147 migration. */
const backfill = (() => {
  const dir = join(import.meta.dirname, "..", "migrations");
  const file = readdirSync(dir).find((f) =>
    f.endsWith("_stat_games_goals_functions.sql"),
  );
  if (!file) throw new Error("D147 migration not found");
  const parts = readFileSync(join(dir, file), "utf8").split(
    "--> statement-breakpoint",
  );
  return parts
    .slice(-3)
    .map((p) => p.trim())
    .filter(Boolean);
})();

class Rollback extends Error {}

describe.runIf(sql)("player stats on one start (D147)", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;
  const tag = `sg${Date.now() % 1_000_000}`;
  let owner: string;
  let team: string;

  beforeAll(async () => {
    const [u] = await db<{ id: string }[]>`
      insert into auth.users (email) values (${`${tag}@example.com`}) returning id`;
    owner = u?.id as string;
    const [t] = await db<{ id: string }[]>`
      insert into teams (owner_id, sport, name) values (${owner}, 'soccer', ${`${tag} City`})
      returning id`;
    team = t?.id as string;
  });

  afterAll(async () => {
    await db`delete from auth.users where id = ${owner}`;
    await db.end();
  });

  it("counts games with a result, and goals from own matches since stats started", async () => {
    let rows: {
      display_name: string;
      stat_games: number;
      stat_goals: number;
    }[] = [];
    try {
      await db.begin(async (tx) => {
        const add = (name: string, goals: number, wins: number) =>
          tx`insert into players (team_id, sport, first_name, last_name, display_name,
              nationality, age, primary_position, attributes, overall, potential,
              potential_low, potential_high, worth, chemistry_color, appearances,
              goals, wins)
            values (${team}, 'soccer', ${name}, 'X', ${name}, 'ENG', 22, 'ST', '{}',
              60, 70, 65, 75, 2000, 1, 20, ${goals}, ${wins})`;
        await add("Romano", 3, 1); // 2 old goals, 1 since stats started
        await add("Cisse", 1, 1); // 1 old goal, none since
        await add("Old Boy", 5, 0); // no games since stats started
        const [s] = await tx<{ id: string }[]>`
          insert into seasons (team_id, sport, number, seed, start_elo, config_version)
          values (${team}, 'soccer', 1, 'seed', 1500, 'defaults') returning id`;
        const fixture = (
          home: number,
          away: number,
          playedAt: string,
          events: object[],
        ) =>
          tx`insert into fixtures (season_id, week, stage, home_slot, away_slot,
              home_score, away_score, summary, played_at)
            values (${s?.id as string}, 1, 'league', ${home}, ${away}, 0, 0,
              ${tx.json({ possession: {}, shots: {}, events } as never)}, ${playedAt})`;
        const goal = (side: string, player: string) => ({
          minute: 10,
          type: "goal",
          side,
          player,
        });
        // Our club away: Romano's goal counts; the home side's Cisse is
        // someone else's player with the same name.
        await fixture(3, 0, "2026-11-05T05:00:00Z", [
          goal("away", "Romano"),
          goal("home", "Cisse"),
        ]);
        // Before stats started: not counted.
        await fixture(0, 4, "2026-11-04T10:00:00Z", [
          goal("home", "Romano"),
          goal("home", "Old Boy"),
        ]);
        // Another club's match in the league: not counted.
        await fixture(5, 6, "2026-11-05T05:00:00Z", [goal("home", "Romano")]);
        for (const statement of backfill) await tx.unsafe(statement);
        rows = await tx`select display_name, stat_games, stat_goals from players
          where team_id = ${team} order by display_name`;
        throw new Rollback();
      });
    } catch (e) {
      if (!(e instanceof Rollback)) throw e;
    }
    expect(rows).toEqual([
      { display_name: "Cisse", stat_games: 1, stat_goals: 0 },
      { display_name: "Old Boy", stat_games: 0, stat_goals: 0 },
      { display_name: "Romano", stat_games: 1, stat_goals: 1 },
    ]);
  });
});
