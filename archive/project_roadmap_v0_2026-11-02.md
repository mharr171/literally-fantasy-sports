# Soccer Manager Game — Project Roadmap

Nov 2, 2026 · @Gary

## Vision & goals

Build a browser-based soccer management game: collect generated players, set an 11-player lineup, and climb an Elo ladder against AI and other managers' saved teams. Target: a playable, publicly hosted v1 in about 19 weeks, around late March 2027, at 6–10 hrs/week.

It is a spiritual successor to LiterallyFantasySports (Rails 5, 2018). It keeps that game's best ideas (positional heatmaps, chemistry colors, Elo, energy-gated matches) and fixes its main weakness: logic in hand-written, unrolled code in one 2,000-line controller.

**Goals**

- **Fun side project:** a game you and friends actually play.
- **Portfolio piece:** clean architecture, a tested simulation engine, CI, docs and a polished public demo.
- **Run like a real project:** milestones, issues, PRs and decision records, even with a team of one.

## Scope decisions

v1 is a web app with async play: you challenge AI teams or another manager's saved lineup, and results update an Elo ladder. There is no real-time multiplayer.

| Decision | Choice | Why |
| --- | --- | --- |
| Platform | Web app, mobile-responsive | Fastest to ship, easy to share a link |
| Competition | Async vs AI and saved "ghost" lineups, global Elo ladder | No scheduling or presence problems |
| Stack | TypeScript full-stack | One language, strong portfolio signal |
| Sim engine | Evolved heatmap model, seeded and deterministic | Keeps the original's identity, replays come free |
| Pace | 6–10 hrs/week | Plan milestones at about 8 hrs/week |

**In the MVP**

- **Core loop:** generated players, buy packs, an 11-player lineup builder, sim matches, Elo ladder.
- **Seasons + energy:** weekly fixtures, energy that limits matches and refills over time, season end with final standings.
- **Match visualization:** influence heatmaps on a pitch plus a play-by-play log.

**Not in v1 (moved to the backlog):** facilities, training, selling or a transfer market, private leagues, real-time PvP, a native mobile app, monetization.

## Tech stack & architecture

The project is a pnpm + Turborepo monorepo. The match engine is a pure TypeScript package with no database or framework code, so it can be tested on its own, run in the browser for previews, and run on the server for official results.

| Layer | Choice | Notes |
| --- | --- | --- |
| Web app | Next.js (App Router), React, Tailwind, shadcn/ui | Server actions for game commands |
| Database + auth | Supabase (Postgres, Auth, row-level security) | Free tier; migrations kept in the repo |
| ORM | Drizzle | Typed schema, SQL-first migrations |
| Validation | Zod | Shared between forms and server actions |
| Sim engine | `packages/sim`, pure TS | Seeded RNG, no I/O |
| Pitch visuals | SVG/Canvas, hand-rolled | Heatmap overlay and event markers |
| Hosting | Vercel (app) + Supabase (data) | A preview deploy for every PR |
| Scheduled work | Vercel or Supabase cron, only where needed | Energy and season ticks are computed lazily from timestamps |

**Repo layout**

- `apps/web`: Next.js app (UI, server actions, auth)
- `packages/sim`: match engine, player generation, Elo math
- `packages/db`: Drizzle schema, migrations, seed script
- `packages/config`: shared tsconfig and lint config
- `docs/`: architecture notes and decision records (ADRs)

The one rule that keeps this clean: **game rules live in `packages/sim`**, and the web app only loads data, calls the engine, and saves results.

## Match engine design

The engine is one pure function, `simulateMatch(home, away, seed)`, which returns a score, an event list and both teams' influence maps. Because the same inputs and seed always give the same match, the app stores only the inputs and the seed, and a replay just runs the match again.

**How a match is simulated**

1. **Effective skill:** each starter's rating is boosted when he plays his primary position (+25%) or secondary position (+10%). Players who share the lineup's majority chemistry color get +25%. These are the original values; they live in a config file so they can be tuned.
2. **Influence map:** each position has a template grid, kept as a flat 17×25 array in code rather than 425 database columns. The team map is the sum of every starter's template multiplied by his effective skill.
3. **Phases:** the match runs as about 30 possession phases. In each one, compare the attacking team's influence in the final third with the defending team's influence there. That sets the odds of a chance, then a shot, then a goal (weighed against the keeper).
4. **Randomness:** a seeded PRNG (for example mulberry32) produces every random roll, so upsets happen but can be replayed exactly.
5. **Output:** final score, events (minute, type, zone, players involved) and both influence maps for the pitch view.

**Tuning harness:** a script that simulates 10,000+ matches and reports goals per match, the share of draws, and win rate by skill gap. Target realistic numbers, about 2.5–2.8 goals per match and roughly 25% draws.

**Core data model**

| Table | Key fields |
| --- | --- |
| teams | owner, name, elo, funds, energy, energy\_updated\_at, is\_ai |
| players | team\_id, name, age, skill, potential, primary\_pos, secondary\_pos, chemistry |
| lineups | team\_id, slots (jsonb: player + position × 11) |
| matches | home/away team, seed, input snapshot (jsonb), score, elo change, season, week |
| seasons / fixtures | season number, week, home/away team, match\_id |

Name pools and position templates are static data in `packages/sim`, not database tables.

## Milestones

Seven milestones take the project from an empty repo to a public v1 around March 21, 2027. The sim engine (M1) comes before any game UI because everything else depends on it.

&#91;embedded content: MVP timeline · 7 milestones, about 19 weeks\]

M2 is planned at 4 weeks to absorb the holidays. Each milestone ends with a tagged release and a working deploy.

1. **M0 Foundations (2 wks):** monorepo, Next.js, Supabase auth, CI, preview deploys. *Done when:* you can sign in on a deployed URL and CI is green.
2. **M1 Sim engine (3 wks):** effective skill, influence maps, possession phases, seeded RNG, Elo math, tuning harness. *Done when:* `simulateMatch` is deterministic, harness metrics are on target, and coverage is about 90%.
3. **M2 Players and lineups (4 wks):** player generation, team creation with a starting squad, pack purchases, drag-and-drop lineup builder. *Done when:* a new user gets a squad and saves a valid starting 11.
4. **M3 Matches and ladder (3 wks):** seeded AI teams, challenges against AI or ghost lineups, Elo updates, result and rankings pages. *Done when:* a match runs end to end and the ladder updates.
5. **M4 Seasons and energy (2 wks):** weekly fixtures, energy that refills over time, season end and standings. *Done when:* a full season can be completed.
6. **M5 Match visualization (3 wks):** pitch heatmaps, play-by-play log, replay from the seed. *Done when:* every result page shows the replay.
7. **M6 Polish and launch prep (2 wks):** onboarding, empty and error states, README with screenshots, `v1.0.0` tag. *Done when:* a friend can sign up and play without help.

## Post-MVP backlog

These wait until v1 is live and played. The first three are listed first because they bring back the original game's economy.

| Feature | What it adds | Size | Depends on |
| --- | --- | --- | --- |
| Economy | Funds from match income and attendance, pack pricing | M | Seasons |
| Facilities | Upgrade tracks (skill floor/ceiling, roster limit, seating), driven by a config table | M | Economy |
| Training & progression | Train between matches, potential, aging at season end | M | Seasons |
| Selling / market | Sell players; later, a market between managers | L | Economy |
| Tactics | Formation presets, mentality (attack/defend) that shifts influence maps | M | Sim engine |
| Player portraits | Generated avatars (the original's `player_picture_work` branch) | S | Players |
| Private leagues | Friends' leagues with a shared schedule | L | Seasons |
| Achievements & notifications | Goals to chase, "your energy is full" alerts | S | Core loop |
| Admin tools | Inspect teams, rerun matches, tweak config | S | Core loop |

## Engineering practices

Work as if there were a team: every change goes through an issue, a branch, a PR and green CI, even when you approve your own PRs.

- **Planning:** a GitHub Projects board, one GitHub milestone per roadmap milestone, issues sized to fit one or two sessions.
- **Code quality:** TypeScript strict mode; ESLint + Prettier (or Biome); a pre-commit hook with lint-staged.
- **Testing:** Vitest for `packages/sim` (aim for about 90% coverage there; it is the heart of the game); a few Playwright smoke tests for sign up → build a team → play a match.
- **CI:** GitHub Actions runs lint, typecheck, tests and build on every PR. Vercel preview deploys on every PR.
- **Database:** Supabase migrations committed to the repo, row-level security on every table, and a seed script for local development.
- **Docs:** a README with screenshots, an architecture overview, setup steps and an `.env.example`; short ADRs for key decisions (stack, sim model, async play).
- **Commits and releases:** Conventional Commits, a tagged release and a changelog entry per milestone.
- **Repo visibility:** public (MIT) if it is meant as a portfolio piece; reviewers can then read the engine and tests.

## Risks & open questions

The biggest risk is the sim engine: balance tuning tends to take longer than planned. M1 therefore comes early and includes the tuning harness.

| Risk | Mitigation |
| --- | --- |
| Sim tuning runs long | Harness with target metrics; ship "good enough" and retune after launch |
| Scope creep (facilities, market) | Backlog is locked until v1 ships |
| Holiday weeks (late Dec) slow progress | M2 is planned 4 weeks long to absorb them |
| Next.js conventions keep changing | Engine and database stay framework-free and portable |
| Free-tier limits | Fine for a small player base; check before any public promotion |

**Open questions**

- [ ] Name and branding: keep "LiterallyFantasySports" or start fresh?
- [ ] Grid resolution: keep 17×25 or go coarser (for example 12×8) for simpler tuning?
- [ ] Ghost opponents: may any manager challenge any lineup, or only teams near your Elo?
- [ ] Season length and energy refill rate (for example 1 energy every 2 hours, maximum 3)?
- [ ] Public or private GitHub repo?
