import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { asAnon, asService, asUser, sql } from "./db";

const PACKS = [
  { focus: "goal", tier: "starter" },
  { focus: "any", tier: "starter" },
];

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

describe.runIf(sql)("starter squad functions (D83)", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;
  const tag = `s${Date.now() % 1_000_000}`;
  let owner: string;

  beforeAll(async () => {
    const [u] = await db<{ id: string }[]>`
      insert into auth.users (email) values (${`${tag}@example.com`}) returning id`;
    owner = u?.id as string;
  });

  afterAll(async () => {
    await db`delete from auth.users where id = ${owner}`;
    await db.end();
  });

  const createTeam = (tx: Parameters<Parameters<typeof asService>[1]>[0]) =>
    tx<{ id: string }[]>`
      select public.create_team_with_starter_packs(
        ${owner}, 'soccer', ${`${tag} Rovers`}, ${tx.json(PACKS)}) as id`;

  it("creates a team with its starter packs and random seeds", async () => {
    const packs = await asService(db, async (tx) => {
      const [t] = await createTeam(tx);
      return tx`select kind, focus, tier, seed, opened_at from packs
        where team_id = ${t?.id as string} order by focus`;
    });
    expect(packs.map((p) => [p.kind, p.focus, p.tier, p.opened_at])).toEqual([
      ["starter", "any", "starter", null],
      ["starter", "goal", "starter", null],
    ]);
    expect(packs[0]?.seed).not.toBe(packs[1]?.seed);
    expect(packs[0]?.seed).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("saves kept players and resolves every starter pack at once", async () => {
    const result = await asService(db, async (tx) => {
      const [t] = await createTeam(tx);
      const team = t?.id as string;
      const packs = await tx<{ id: string }[]>`
        update packs set opened_at = now() - interval '1 minute'
        where team_id = ${team} returning id`;
      const [a, b] = packs.map((p) => p.id) as [string, string];
      await tx`select public.resolve_starter_packs(${team},
        ${tx.json([player("Ann"), player("Bo")])},
        ${tx.json({ [a]: [0, 3] })})`;
      const players = await tx`select first_name, sport, from_starter_pack
        from players where team_id = ${team} order by first_name`;
      const resolved = await tx`select id, kept, resolved_at is not null as done
        from packs where team_id = ${team}`;
      // Resolving twice is refused.
      const again = await tx`savepoint s`.then(() =>
        tx`select public.resolve_starter_packs(${team}, ${tx.json([player("Cy")])}, '{}')`.then(
          () => "ok",
          (e: Error) => e.message,
        ),
      );
      return { players, resolved, a, b, again };
    });
    expect(result.players).toEqual([
      { first_name: "Ann", sport: "soccer", from_starter_pack: true },
      { first_name: "Bo", sport: "soccer", from_starter_pack: true },
    ]);
    const kept = Object.fromEntries(
      result.resolved.map((p) => [p.id, [p.kept, p.done]]),
    );
    expect(kept[result.a]).toEqual([[0, 3], true]);
    expect(kept[result.b]).toEqual([[], true]);
    expect(result.again).toMatch(/not ready to resolve \(0 of 2/);
  });

  it("refuses to resolve while a starter pack is still sealed", async () => {
    await expect(
      asService(db, async (tx) => {
        const [t] = await createTeam(tx);
        await tx`select public.resolve_starter_packs(${t?.id as string}, '[]', '{}')`;
      }),
    ).rejects.toThrow(/not ready to resolve \(0 of 2/);
  });

  it("lets only the server call them", async () => {
    for (const run of [
      (fn: Parameters<typeof asAnon>[1]) => asAnon(db, fn),
      (fn: Parameters<typeof asAnon>[1]) => asUser(db, owner, fn),
    ]) {
      await expect(
        run(
          (tx) =>
            tx`select public.create_team_with_starter_packs(${owner}, 'soccer', 'Mine FC', '[]')`,
        ),
      ).rejects.toThrow(/permission denied/);
      await expect(
        run(
          (tx) =>
            tx`select public.resolve_starter_packs(gen_random_uuid(), '[]', '{}')`,
        ),
      ).rejects.toThrow(/permission denied/);
    }
  });
});
