// Applies pending migrations from ../migrations to DATABASE_URL.
// Used instead of `drizzle-kit migrate`, which hides the database's error
// message when a migration fails. All pending migrations run in one
// transaction, so a failure leaves the database unchanged.
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const client = postgres(url, { max: 1, onnotice: () => {} });

type PgError = Error & {
  code?: string;
  detail?: string;
  hint?: string;
  where?: string;
  cause?: unknown;
};

function describe(error: unknown): string {
  const lines: string[] = [];
  let e: unknown = error;
  while (e instanceof Error) {
    const pg = e as PgError;
    lines.push(pg.message);
    if (pg.code) lines.push(`  code: ${pg.code}`);
    if (pg.detail) lines.push(`  detail: ${pg.detail}`);
    if (pg.hint) lines.push(`  hint: ${pg.hint}`);
    if (pg.where) lines.push(`  where: ${pg.where}`);
    e = pg.cause;
  }
  return lines.join("\n");
}

try {
  await migrate(drizzle(client), {
    migrationsFolder: new URL("../migrations", import.meta.url).pathname,
  });
  console.log("Migrations applied.");
} catch (error) {
  console.error(`Migration failed:\n${describe(error)}`);
  process.exitCode = 1;
} finally {
  await client.end();
}
