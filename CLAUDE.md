# CLAUDE.md

Rules for every Claude Code session in this repo (D66). Read this first, then the
parts of `project_roadmap.md` that relate to your task.

## Project

LiterallyFantasySports: a browser-based sports management game, soccer first, built
as a multi-sport framework. Gary directs and approves; Claude Code writes all code
(D23, D65).

- Roadmap, decision log (D1…), milestones: `project_roadmap.md`
- Setup only Gary can do (accounts, secrets, DNS): `m0_setup_guide.md`
- Legal pages source: `docs/legal/` (published at `/privacy-policy`, `/terms-of-service`)

## Layout

pnpm + Turborepo monorepo.

| Path | What |
| --- | --- |
| `apps/web` | Next.js (App Router) app: UI, server actions, auth, admin |
| `packages/config` | Shared tsconfig (`@lfs/config/tsconfig.base.json`) |
| `packages/core` *(M1)* | Sport-agnostic engine: seeded RNG, Elo, seasons, `Sport` interface |
| `packages/sport-*` *(M1+)* | One package per sport, e.g. `sport-soccer` |
| `packages/db` | Drizzle schema (`src/schema.ts`), SQL migrations (`migrations/`), database tests |
| `docs/` | Architecture notes, ADRs, legal sources |

## Architecture rules

- Game rules live in the engine packages. `apps/web` only loads data, calls the
  engine and saves results.
- `packages/core` never imports a sport. Sports implement the `Sport` interface.
- Engine packages are pure TypeScript: no I/O, no database, no framework code.
  Randomness comes only from the seeded RNG so matches replay exactly.
- Build soccer cleanly; extract shared code into core only when a second sport needs it.
- Matches are simulated on the server only. Row-level security on every table.

## Next.js

This repo uses Next.js 16 with Cache Components (`cacheComponents: true`). APIs differ
from older versions: read `apps/web/AGENTS.md` and the bundled docs in
`apps/web/node_modules/next/dist/docs/` before writing Next.js code.

## Commands

Run from the repo root (Node 22, pnpm 10):

```bash
pnpm install       # install everything
pnpm dev           # run the web app at http://localhost:3000
pnpm lint          # Biome lint + format check (pnpm lint:fix to fix)
pnpm typecheck     # TypeScript in every package
pnpm test          # Vitest (engine packages, from M1)
pnpm build         # production build
pnpm db:generate   # after editing packages/db/src/schema.ts: write a new migration
pnpm test:db       # database tests (needs DATABASE_URL, see below)
```

Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` before pushing; CI runs
the same.

## Database

- Schema lives in `packages/db/src/schema.ts` (Drizzle, snake_case columns).
  Change it, run `pnpm db:generate`, and commit the generated SQL. For things
  Drizzle can't express (triggers, functions, grants) use
  `pnpm --filter @lfs/db drizzle-kit generate --custom --name=<what>`.
- Never edit a migration that has reached `main`; add a new one.
- Every table: row-level security on, explicit policies, and grants narrowed
  from Supabase's defaults. Add tests in `packages/db/test/` proving what each
  role can and can't do.
- CI applies migrations to a throwaway Postgres (prepared with
  `packages/db/ci/supabase-stub.sql`) and runs the database tests. After merge,
  `.github/workflows/db-migrate.yml` applies them to `lfs-dev`, then to
  `lfs-prod` once Gary approves the `production` environment.
- To run database tests locally: start Postgres, run `ci/supabase-stub.sql`,
  then `DATABASE_URL=… pnpm --filter @lfs/db migrate && DATABASE_URL=… pnpm test:db`.

## Conventions

- TypeScript strict. Biome for lint and format (no ESLint/Prettier).
- Conventional Commits in commit messages and PR titles (`feat:`, `fix:`, `docs:`,
  `chore:`, `ci:` …); release-please builds the changelog from them (D71). PRs are
  squash-merged, so the PR title becomes the changelog line: write it for players.
- Releases: release-please keeps a release PR open. Gary merges it at the end of
  each milestone (M0 → `v0.1.0`, M1 → `v0.2.0`, …). Don't edit `CHANGELOG.md` or
  version numbers by hand.
- One issue per session or PR. Keep PRs small.
- Never commit secrets. `.env*` is git-ignored except `.env.example`.
- Every PR description: plain-English summary, test results, preview link, what to
  click to check it (D67). Self-review before opening.
- Merging (D68): low-risk PRs (docs, tests, small fixes, UI copy) may be merged on
  green CI. High-risk PRs (migrations, auth, security rules, payouts or balance
  defaults) wait for Gary with a short review checklist.
- When something needs Gary (accounts, secrets, approvals, DNS), do everything else
  first, then give short numbered steps (D65), pointing to `m0_setup_guide.md` where
  it applies.
- Record new decisions in the roadmap's decision log with the next D number.
