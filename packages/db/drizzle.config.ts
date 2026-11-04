import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema.ts",
  out: "./migrations",
  schemaFilter: ["public"],
  casing: "snake_case",
  // Supabase owns the anon/authenticated/service_role roles and the auth schema.
  entities: { roles: { provider: "supabase" } },
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  strict: true,
  verbose: true,
});
