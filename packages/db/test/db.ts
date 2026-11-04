import postgres from "postgres";

const url = process.env.DATABASE_URL;

/**
 * Database tests run against a throwaway Postgres prepared with
 * ci/supabase-stub.sql and the migrations (see .github/workflows/ci.yml).
 */
export const sql = url ? postgres(url, { max: 1, onnotice: () => {} }) : null;

type Tx = postgres.TransactionSql;

/** Runs `fn` as a signed-in player inside a transaction that is rolled back. */
export async function asUser<T>(
  db: postgres.Sql,
  userId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return asRole(db, "authenticated", userId, fn);
}

/** Runs `fn` as a signed-out visitor inside a transaction that is rolled back. */
export async function asAnon<T>(
  db: postgres.Sql,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return asRole(db, "anon", null, fn);
}

/** Runs `fn` as the server's service role inside a transaction that is rolled back. */
export async function asService<T>(
  db: postgres.Sql,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  return asRole(db, "service_role", null, fn);
}

class Rollback<T> extends Error {
  constructor(readonly value: T) {
    super("rollback");
  }
}

async function asRole<T>(
  db: postgres.Sql,
  role: "anon" | "authenticated" | "service_role",
  userId: string | null,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> {
  try {
    await db.begin(async (tx) => {
      const claims = JSON.stringify(userId ? { sub: userId, role } : { role });
      await tx`select set_config('request.jwt.claims', ${claims}, true)`;
      await tx.unsafe(`set local role ${role}`);
      throw new Rollback(await fn(tx));
    });
  } catch (e) {
    if (e instanceof Rollback) return e.value as T;
    throw e;
  }
  throw new Error("unreachable");
}
