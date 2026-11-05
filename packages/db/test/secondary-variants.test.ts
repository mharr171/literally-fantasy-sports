import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asService, asUser, sql } from "./db";

const PROFILE = { personality: "steady", pace: "normal", formation: "4-4-2" };

const player = (name: string, extra: Record<string, unknown> = {}) => ({
  first_name: name,
  last_name: "Test",
  display_name: `${name} Test`,
  nationality: "ENG",
  age: 22,
  primary_position: "CM",
  secondary_position: "AM",
  attributes: { passing: 60 },
  overall: 60,
  potential: 70,
  potential_low: 65,
  potential_high: 75,
  worth: 2000,
  chemistry_color: 1,
  template_variant: "default",
  ...extra,
});

/** The one-time backfill: the last statement of the D136 migration. */
const backfill = (() => {
  const dir = join(import.meta.dirname, "..", "migrations");
  const file = readdirSync(dir).find((f) =>
    f.endsWith("_secondary_variant_functions.sql"),
  );
  if (!file) throw new Error("D136 migration not found");
  const parts = readFileSync(join(dir, file), "utf8").split(
    "--> statement-breakpoint",
  );
  return (parts.at(-1) as string).trim();
})();

class Rollback extends Error {}

describe.runIf(sql)("secondary-position heatmaps (D136)", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;
  const tag = `sv${Date.now() % 1_000_000}`;
  let owner: string;
  let team: string;
  let ai: string;

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
  });

  afterAll(async () => {
    await db`delete from teams where id in (${team}, ${ai})`;
    await db`delete from auth.users where id = ${owner}`;
    await db.end();
  });

  it("saves the secondary variant of a kept pack player, and the default when it isn't sent", async () => {
    const saved = await asService(db, async (tx) => {
      const [p] = await tx<{ id: string }[]>`
        select public.buy_pack(${team}, 'any', 'basic', 100) as id`;
      await tx`select public.resolve_bought_pack(${team}, ${p?.id as string},
        ${tx.json([
          player("New", { secondary_template_variant: "playmaker" }),
          // A player sent by the version before D136 (during a deploy).
          player("Old"),
        ])}, '[0, 1]', 0)`;
      return tx<{ first_name: string; secondary_template_variant: string }[]>`
        select first_name, secondary_template_variant from players
        where team_id = ${team} order by first_name`;
    });
    expect(saved).toEqual([
      { first_name: "New", secondary_template_variant: "playmaker" },
      { first_name: "Old", secondary_template_variant: "default" },
    ]);
  });

  it("lets a manager select the secondary variant column", async () => {
    const rows = await asUser(db, owner, async (tx) => {
      return tx`select secondary_template_variant from players where team_id = ${team}`;
    });
    expect(rows).toEqual([]);
  });

  it("copies an AI club into a league with both variants", async () => {
    const clone = await asService(db, async (tx) => {
      await tx`insert into players (team_id, sport, first_name, last_name, display_name,
          nationality, age, primary_position, secondary_position, attributes, overall,
          potential, potential_low, potential_high, worth, chemistry_color,
          template_variant, secondary_template_variant)
        values (${ai}, 'soccer', 'Al', 'Y', 'Al Y', 'ENG', 24, 'ST', 'LW', '{}', 66, 80,
          70, 82, 2000, 1, 'poacher', 'inside')`;
      await tx`insert into matchday_squads (team_id, formation, lineup, bench, sub_plan)
        values (${ai}, '4-4-2', '[]', '[]', '[]')`;
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
      const [row] = await tx<
        { clone: { players: Record<string, unknown>[] } }[]
      >`
        select clone from season_teams where season_id = ${s?.id as string} and slot = 1`;
      return row?.clone.players[0];
    });
    expect(clone).toMatchObject({
      templateVariant: "poacher",
      secondaryTemplateVariant: "inside",
    });
  });

  it("backfills existing players once, at random, from the live enabled templates", async () => {
    let result: { pos: string | null; variant: string }[] = [];
    try {
      await db.begin(async (tx) => {
        const [v] = await tx<{ version: number }[]>`
          select coalesce(max(version), 0) + 1 as version from game_config_versions
          where scope = 'soccer'`;
        const version = v?.version as number;
        await tx`insert into game_config_versions (scope, version, note)
          values ('soccer', ${version}, 'D136 test')`;
        await tx`insert into game_config (scope, version, key, value)
          values ('soccer', ${version}, 'variants.enabled',
            ${tx.json({ AM: ["playmaker", "runner"], CB: [] })})`;
        await tx`update game_config_versions set published_at = now()
          where scope = 'soccer' and version = ${version}`;
        const rows: [string, string | null][] = [
          ...Array.from({ length: 30 }, (_, i): [string, string] => [
            `am${i}`,
            "AM",
          ]),
          ["cb", "CB"],
          ["dm", "DM"],
          ["none", null],
        ];
        for (const [name, pos] of rows)
          await tx`insert into players (team_id, sport, first_name, last_name, display_name,
              nationality, age, primary_position, secondary_position, attributes, overall,
              potential, potential_low, potential_high, worth, chemistry_color)
            values (${team}, 'soccer', ${name}, 'B', 'B', 'ENG', 22, 'CM',
              ${pos}, '{}', 60, 70, 65, 75, 2000, 1)`;
        await tx.unsafe(backfill);
        result = await tx<{ pos: string | null; variant: string }[]>`
          select secondary_position as pos, secondary_template_variant as variant
          from players where team_id = ${team} and last_name = 'B'`;
        throw new Rollback();
      });
    } catch (e) {
      if (!(e instanceof Rollback)) throw e;
    }
    const am = new Set(
      result.filter((r) => r.pos === "AM").map((r) => r.variant),
    );
    // Random picks from the enabled list: 30 players see both.
    expect(am).toEqual(new Set(["playmaker", "runner"]));
    // Nothing enabled (an empty list, or no list), or no secondary position.
    for (const r of result.filter((r) => r.pos !== "AM"))
      expect(r.variant).toBe("default");
  });
});
