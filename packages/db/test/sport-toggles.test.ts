import { afterAll, describe, expect, it } from "vitest";
import { asService, sql } from "./db";

describe.runIf(sql)("sport toggles (D207)", () => {
  // biome-ignore lint/style/noNonNullAssertion: guarded by runIf
  const db = sql!;

  afterAll(async () => {
    await db.end();
  });

  it("keeps soccer public with its AI world on, and adds baseball hidden", async () => {
    const rows = await asService(
      db,
      (tx) =>
        tx`select sport, public, ai_enabled, roster_min, roster_max, bench_max, league_size
          from sport_settings where sport in ('soccer', 'baseball') order by sport`,
    );
    expect(rows).toEqual([
      {
        sport: "baseball",
        public: false,
        ai_enabled: false,
        roster_min: 14,
        roster_max: 30,
        bench_max: 5,
        league_size: 15,
      },
      expect.objectContaining({ sport: "soccer", public: true }),
    ]);
  });

  it("carries the old AI clubs switch across: off stays off (D208)", async () => {
    const [row] = await asService(
      db,
      (tx) =>
        tx`select s.ai_enabled, coalesce(a.enabled, true) as old
          from sport_settings s left join ai_settings a on a.sport = s.sport
          where s.sport = 'soccer'`,
    );
    expect(row?.ai_enabled).toBe(row?.old);
  });
});
