import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asService, asUser, sql } from "./db";

type Tx = Parameters<Parameters<typeof asService>[1]>[0];

const player = (name: string) => ({
  first_name: name,
  last_name: "Test",
  display_name: `${name} Test`,
  nationality: "ENG",
  age: 22,
  primary_position: "CM",
  secondary_position: null,
  attributes: { passing: 60 },
  overall: 60,
  potential: 70,
  potential_low: 65,
  potential_high: 75,
  worth: 2000,
  chemistry_color: 1,
  template_variant: "default",
});

/** Runs `fn` as the service role; returns its result or the error message. */
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

describe.runIf(sql)(
  "buying, keeping and selling players (D47, D49, D54)",
  () => {
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
      insert into teams (owner_id, sport, name) values (${owner}, 'soccer', ${`${tag} City`})
      returning id`;
      team = t?.id as string;
    });

    afterAll(async () => {
      await db`delete from auth.users where id = ${owner}`;
      await db.end();
    });

    const funds = async (tx: Tx) =>
      (
        await tx<
          { funds: number }[]
        >`select funds from teams where id = ${team}`
      )[0]?.funds;

    it("gives new teams 10,000 starting funds", async () => {
      expect(await asService(db, funds)).toBe(10_000);
    });

    it("buys an opened pack, then refuses a second until it's resolved", async () => {
      const result = await asService(db, async (tx) => {
        const [p] = await tx<{ id: string }[]>`
        select public.buy_pack(${team}, 'goal', 'basic', 6000) as id`;
        const pack =
          await tx`select kind, focus, tier, opened_at is not null as opened
        from packs where id = ${p?.id as string}`;
        const again = await attempt(
          tx,
          tx`select public.buy_pack(${team}, 'any', 'basic', 10)`,
        );
        return { pack, again, funds: await funds(tx) };
      });
      expect(result.pack).toEqual([
        { kind: "bought", focus: "goal", tier: "basic", opened: true },
      ]);
      expect(result.again).toMatch(/finish your open pack/);
      expect(result.funds).toBe(4_000);
    });

    it("refuses a pack the team can't afford", async () => {
      await expect(
        asService(
          db,
          (tx) => tx`select public.buy_pack(${team}, 'any', 'gold', 30000)`,
        ),
      ).rejects.toThrow(/not enough funds/);
      await expect(
        asService(
          db,
          (tx) => tx`select public.buy_pack(${team}, 'any', 'gold', 0)`,
        ),
      ).rejects.toThrow(/must be positive/);
    });

    it("keeps some players, pays for the rest and resolves the pack once", async () => {
      const result = await asService(db, async (tx) => {
        const [p] = await tx<{ id: string }[]>`
        select public.buy_pack(${team}, 'any', 'basic', 5000) as id`;
        const pack = p?.id as string;
        await tx`select public.resolve_bought_pack(${team}, ${pack},
        ${tx.json([player("Kay")])}, ${tx.json([2])}, 1500)`;
        const again = await attempt(
          tx,
          tx`select public.resolve_bought_pack(${team}, ${pack}, '[]', '[]', 1500)`,
        );
        const players =
          await tx`select first_name, from_starter_pack from players
        where team_id = ${team}`;
        const [row] = await tx`select kept, resolved_at is not null as done
        from packs where id = ${pack}`;
        return { players, row, again, funds: await funds(tx) };
      });
      expect(result.players).toEqual([
        { first_name: "Kay", from_starter_pack: false },
      ]);
      expect(result.row).toEqual({ kept: [2], done: true });
      expect(result.again).toMatch(/pack is not open/);
      expect(result.funds).toBe(10_000 - 5_000 + 1_500);
    });

    it("removes players with resale money, but never below the minimum", async () => {
      const result = await asService(db, async (tx) => {
        const ids = await tx<{ id: string }[]>`
        insert into players (team_id, sport, first_name, last_name, display_name,
          nationality, age, primary_position, attributes, overall, potential,
          potential_low, potential_high, worth, chemistry_color)
        select ${team}, 'soccer', 'P' || g, 'X', 'P' || g, 'ENG', 25, 'CB', '{}',
          50, 55, 50, 60, 1000, 1
        from generate_series(1, 3) g returning id`;
        const [a, b, c] = ids.map((r) => r.id) as [string, string, string];
        await tx`select public.remove_player(${team}, ${a}, 250, 1)`;
        const below = await attempt(
          tx,
          tx`select public.remove_player(${team}, ${b}, 0, 2)`,
        );
        await tx`select public.remove_player(${team}, ${b}, 0, 1)`;
        const twice = await attempt(
          tx,
          tx`select public.remove_player(${team}, ${b}, 250, 0)`,
        );
        const left =
          await tx`select id from players where team_id = ${team} and id = ${c}`;
        return { below, twice, left, funds: await funds(tx) };
      });
      expect(result.below).toMatch(/below 2 players/);
      expect(result.twice).toMatch(/not on this team/);
      expect(result.left).toHaveLength(1);
      expect(result.funds).toBe(10_250);
    });

    it("stores a pack's Elo shift and left-out colors (D179, D180)", async () => {
      const result = await asService(db, async (tx) => {
        const bad = [
          await attempt(
            tx,
            tx`select public.buy_pack_with_choices(${team}, 'any', 'basic', 100, 16, '{}')`,
          ),
          await attempt(
            tx,
            tx`select public.buy_pack_with_choices(${team}, 'any', 'basic', 100, 0, '{0,1,2,3}')`,
          ),
        ];
        const [p] = await tx<{ id: string }[]>`
        select public.buy_pack_with_choices(${team}, 'defence', 'silver', 7250, 5, '{1,3}') as id`;
        const [row] = await tx`select tier, focus, elo_shift, excluded_colors
        from packs where id = ${p?.id as string}`;
        // The old function still works during a deploy, with no choices.
        await tx`update packs set resolved_at = now() where id = ${p?.id as string}`;
        const [old] = await tx<{ id: string }[]>`
        select public.buy_pack(${team}, 'any', 'basic', 100) as id`;
        const [plain] = await tx`select elo_shift, excluded_colors
        from packs where id = ${old?.id as string}`;
        return { bad, row, plain, funds: await funds(tx) };
      });
      expect(result.bad[0]).toMatch(/packs_choice/);
      expect(result.bad[1]).toMatch(/packs_choice/);
      expect(result.row).toEqual({
        tier: "silver",
        focus: "defence",
        elo_shift: 5,
        excluded_colors: [1, 3],
      });
      expect(result.plain).toEqual({ elo_shift: 0, excluded_colors: [] });
      expect(result.funds).toBe(10_000 - 7_250 - 100);
    });

    it("lets only the server call them", async () => {
      for (const run of [
        (fn: Parameters<typeof asAnon>[1]) => asAnon(db, fn),
        (fn: Parameters<typeof asAnon>[1]) => asUser(db, owner, fn),
      ]) {
        for (const call of [
          (tx: Tx) => tx`select public.buy_pack(${team}, 'any', 'basic', 1)`,
          (tx: Tx) =>
            tx`select public.buy_pack_with_choices(${team}, 'any', 'basic', 1, 0, '{}')`,
          (tx: Tx) =>
            tx`select public.resolve_bought_pack(${team}, gen_random_uuid(), '[]', '[]', 99999)`,
          (tx: Tx) =>
            tx`select public.remove_player(${team}, gen_random_uuid(), 99999, 0)`,
        ]) {
          await expect(run(call)).rejects.toThrow(/permission denied/);
        }
      }
    });
  },
);
