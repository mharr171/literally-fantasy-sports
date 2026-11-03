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
| `packages/db` *(M0/M1)* | Drizzle schema, migrations, seed |
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
```

Run `pnpm lint && pnpm typecheck && pnpm test && pnpm build` before pushing; CI runs
the same.

## Conventions

- TypeScript strict. Biome for lint and format (no ESLint/Prettier).
- Conventional Commits in commit messages and PR titles (`feat:`, `fix:`, `docs:`,
  `chore:`, `ci:` …); release-please builds the changelog from them (D71).
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
