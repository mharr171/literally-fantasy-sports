// The persistence check (D131): game data survives every migration.
//
// Usage: node scripts/persistence-check.ts <base-db-folder>
//   <base-db-folder> holds the base branch's migrations/ and ci/ folders.
//
// On a fresh database (DATABASE_URL points at any database on the server;
// a throwaway one is created next to it), it applies the base branch's
// migrations, loads representative game data, counts the rows in every
// table that holds clubs, players or settings, applies this branch's
// migrations and counts again. Any table with fewer rows fails the check.
import { readFileSync } from "node:fs";
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

/** Tables that must never lose rows in a migration (D131). */
const PROTECTED = [
  "auth.users",
  "public.profiles",
  "public.teams",
  "public.players",
  "public.matchday_squads",
  "public.seasons",
  "public.season_records",
  "public.ghosts",
  "public.player_careers",
  "public.game_config_versions",
  "public.game_config",
  "public.sport_settings",
  "public.ai_settings",
  "public.formations",
];

const base = process.argv[2];
const url = process.env.DATABASE_URL;
if (!base || !url) {
  console.error(
    "Usage: DATABASE_URL=… node scripts/persistence-check.ts <base-db-folder>",
  );
  process.exit(1);
}
const here = path.dirname(new URL(import.meta.url).pathname);
const pick = (file: string) => {
  const fromBase = path.join(base, file);
  try {
    return readFileSync(fromBase, "utf-8");
  } catch {
    // The base branch is older than this file: use this branch's copy.
    return readFileSync(path.join(here, "..", file), "utf-8");
  }
};

const admin = postgres(url, { max: 1, onnotice: () => {} });
const name = `lfs_persist_${Date.now()}`;
await admin.unsafe(`create database ${name}`);
const target = new URL(url);
target.pathname = `/${name}`;
const db = postgres(target.toString(), { max: 1, onnotice: () => {} });

const counts = async () => {
  const out: Record<string, number> = {};
  for (const table of PROTECTED) {
    const exists = await db`select to_regclass(${table}) is not null as ok`;
    if (!exists[0]?.ok) continue;
    const [row] = await db.unsafe(`select count(*)::int as n from ${table}`);
    out[table] = (row?.n as number) ?? 0;
  }
  return out;
};

let failed = false;
try {
  await db.unsafe(pick("ci/supabase-stub.sql"));
  await migrate(drizzle(db), {
    migrationsFolder: path.join(base, "migrations"),
  });
  await db.unsafe(pick("ci/persistence-seed.sql"));
  const before = await counts();
  await migrate(drizzle(db), {
    migrationsFolder: path.join(here, "..", "migrations"),
  });
  const after = await counts();
  for (const [table, n] of Object.entries(before)) {
    const now = after[table];
    const line = `${table}: ${n} → ${now ?? "gone"}`;
    if (now === undefined || now < n) {
      console.error(`::error::${line} (a migration removed game data)`);
      failed = true;
    } else console.log(line);
  }
  if (!failed) console.log("Game data kept through every migration.");
} catch (e) {
  console.error(
    `Persistence check failed: ${e instanceof Error ? e.message : e}`,
  );
  failed = true;
} finally {
  await db.end();
  await admin.unsafe(`drop database if exists ${name}`);
  await admin.end();
}
process.exitCode = failed ? 1 : 0;
