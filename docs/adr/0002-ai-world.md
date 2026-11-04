# ADR 0002: The AI world and 12-club seasons (M9)

Status: proposed (Nov 4, 2026). Covers D113–D117 and D120.

## Context

In v1 every manager has their own 8-team league: the AI teams are generated
from the season seed to suit the manager's Elo, and ghosts come from other
managers' finished seasons. Everything runs inside Next.js server actions
when a manager presses a button.

M9 replaces that with a persistent world:

- 250 AI clubs that play their own seasons, buy packs, age, retire players
  and take youth, at roughly human speed (D113, D114).
- Leagues of 12: the manager plus the 11 clubs nearest their Elo,
  frozen as clones for the season (D115).
- One best ghost per real player (D116).
- 26-week seasons: 22 league weeks, a play-in, then an 8-club bracket (D117).
- The data kept is trimmed so the database stays within Supabase's free
  500 MB and backups stay small (D120).

## Decisions

### 1. AI clubs are ordinary `teams` rows

AI clubs live in the same `teams`, `players`, `matchday_squads`, `packs` and
`seasons` tables as real clubs. Every rule that applies to a real club then
applies to an AI club for free, through the same SQL functions.

- `teams.kind` is `'human'` or `'ai'`. AI clubs have no owner (`owner_id`
  becomes nullable, and is required for human clubs).
- `teams.manager_name` holds the AI club's invented manager. Real clubs keep
  using the owner's display name.
- `teams.ai` (jsonb) holds the AI club's personality and pace profile. Only
  admins and the server can read it.
- Row-level security does not change: a manager still sees only their own
  rows. Pages that show other clubs (leaderboard, league table, club view)
  read through the server and show AI clubs exactly like real ones. Only
  admin pages say which clubs are AI.

### 2. The game logic moves into a shared package

The steps a club takes (start a season, play a week, end a season, take
youth, buy and sort packs, release players, save a squad) currently live in
`apps/web`. They move into a new package, `packages/game`. It takes a
Supabase service client as input and has no Next.js code, so the web app
and the AI runner call the same code. Game rules stay in the engine
packages, as now. This is a refactor with no change in behaviour, done
before any AI work.

### 3. The AI manager is part of the engine

`packages/sport-soccer/src/ai-manager.ts` is pure and seeded like the rest
of the engine. Given a club's roster, funds, energy and season state, it
returns the next action: play a week, end the season, take some youth
prospects, buy a pack, keep or sell pack players, release players, or save a
squad.

It decides from what a manager can see. It uses the shown potential range,
never the hidden potential, so AI clubs don't play by better information.

There are three personalities to start (adjustable later):

| Personality | Packs | Keeps | Squad |
| --- | --- | --- | --- |
| Builder | Cheaper packs, more often | Young players with a high potential range | Rotates often |
| Spender | The best pack it can afford | The highest overall | Strongest XI every week |
| Steady | Mid-tier packs, keeps a cash buffer | A mix | Rotates when tired |

### 4. AI runs on a schedule in GitHub Actions

A new workflow, `ai-world.yml`, runs every 2 hours. It runs a Node script
(`packages/game/scripts/ai-run.ts`) with the Supabase URL and secret key
as repository secrets. It does not run on Vercel: a run can take a few minutes,
and the free Vercel plan has tight limits on function time and CPU.

In each run, every AI club gets a seeded chance to act. Its pace profile
sets how many weeks it plays on average, always within the same energy
rules as a manager (6 points, 1 back every 15 minutes).

| Pace | Seasons a day | Weeks per 2-hour run (average) |
| --- | --- | --- |
| Slow | 0.5 | 1.1 |
| Normal | 1 | 2.2 |
| Fast | 2 | 4.3 |

Clubs are spread across the three paces (proposed: 30% slow, 50% normal,
20% fast). Admins can change the pool size, the paces and the spread.

### 5. Leagues are frozen clones

When a season starts, the server takes the 11 clubs whose Elo is nearest the
club's own. The candidates are every AI club and every other real player's
best ghost. The club's own ghost is never a candidate. Each opponent is
copied into `season_teams` as a clone: name, colors, manager name, Elo,
players (no hidden potential) and matchday squad.

Those clones play the whole season unchanged (D115). Fixtures between two
clones are played the same way as today's AI-against-AI matches. This works
the same for real clubs and AI clubs.

A real player's ghost is a clone of their best ghost (D116), not of their
live club.

### 6. One ghost per real club

A new table, `ghosts`, holds one row per real club, frozen as the team
finished its best season by Elo (before ageing, as D92). At season end it is
replaced only if the club's Elo is higher than the ghost's. The existing
`team_snapshots` are migrated: each club's highest-Elo snapshot becomes its
ghost, and every snapshot's record becomes a season record (below).
`team_snapshots` is then dropped.

### 7. Season shape (D117)

- Weeks 1–22: double round-robin of 12 clubs.
- Week 23: play-in, 8th v 9th. Clubs 1st–7th skip it and spend no energy;
  10th–12th are finished.
- Week 24: quarter-finals, 1 v play-in winner, 2 v 7, 3 v 6, 4 v 5.
- Week 25: semi-finals, winner of 1/PI v winner of 4/5 and 2/7 v 3/6.
- Week 26: final.

Seasons gain a `format` column. Seasons already under way when this ships
finish as 8-team seasons; every new season uses the new shape. `fixtures.stage`
gains `play_in` and `quarter`.

Payouts per match stay the same, so earnings per energy point don't change.
A season simply has more matches. Proposed bonuses for the new bracket
(balance defaults, Gary to OK):

| Bonus | Now (top 4) | Proposed (8-club bracket) |
| --- | --- | --- |
| Reaching the quarter-finals (incl. via play-in) | — | 1,000 |
| Reaching the semi-finals | 2,000 ("playoffs") | 2,000 |
| Reaching the final | 3,000 | 3,000 |
| Winning the final | 5,000 | 5,000 |

The existing `playoffs` payout becomes "reaching the semi-finals". A new
`quarter` payout is added, and both stay adjustable in admin.

### 8. What is kept (D120)

**Forever:**
- `season_records`: one line per club per season. It holds place, W/D/L,
  goals, Elo before and after, playoff result, and the club's name and
  colors at the time. It replaces `team_snapshots` as the leaderboard.
- `ghosts`.
- `player_careers`: a line for every retired player (seasons, appearances,
  goals, best overall, clubs). To fill it, `players` gains `appearances` and
  `goals` totals, which `record_week` adds to.

**Current and previous season, real clubs:**
- Full fixtures with summaries and replays for the club's own matches.
- Scores only for the other matches in the league.
- The league's clones.

**Older seasons, real clubs:**
- The club's own matches keep their summaries but lose their replay data
  (`manager_team`).
- Other matches and the clones are deleted.

**AI clubs:**
- No replay data is ever stored for AI clubs. An admin can still compute a
  replay on demand from the seed and the clones while they exist.
- An AI club's fixtures and clones are deleted once its season is closed.
  Its season record stays.

**Packs:** rows are deleted once sorted. The pack's seed is no longer needed
after that.

A nightly `prune_old_data()` function does the deleting. It is run by the
existing nightly backup workflow, just before the dump.

The backup treats AI clubs exactly like real clubs, because players can't
tell them apart. A restore brings every club back exactly as it was,
including seasons in progress (fixtures and clones). A slow AI club halfway
through a season carries on from where it was. It saves everything the
database holds after the prune: permanent records, every club with its
players, squads, seasons, fixtures and clones, settings and the accounts.

With AI seasons in progress included, the nightly file is about 40–50 MB.
New clones every day would add several GB a year to `lfs-backups`' history,
which is too much for a GitHub repo. So the backup changes in two ways
(this changes D70):

- The file is gzipped (`lfs-prod.sql.gz`, about 8–10 MB).
- `lfs-backups` keeps the last 30 nights, plus the first night of each
  month for a year. Older nights are dropped by rewriting that repo's
  history, which only the backup workflow writes to.

**Expected size**, rough figures, measured again once it runs:

| What | Size |
| --- | --- |
| 250 AI clubs (about 30 players each) | ~4 MB |
| AI seasons in progress (clones and fixtures) | ~30 MB |
| Season records (250 clubs × 1 season a day, a year) | ~20 MB a year |
| Real clubs | small |

That is well inside 500 MB. The `season_records` growth is the one to watch.
If it gets large, AI clubs' records older than a year can be thinned to one
row per club per month.

## Order of work

Each step below is one PR. The ones marked "migration" wait for Gary's
"merge it".

1. **This ADR**, plus the decision log entries.
2. **Data kept (D120)** (migration): `season_records`, `player_careers`,
   appearance and goal totals, the leaderboard reading from season records,
   `prune_old_data()`, and the backup changes.
3. **Shared game package** (refactor): `packages/game`, with the web app
   switched to it. Behaviour stays the same.
4. **Season shape (D117)** (migration, balance): 12-club format, play-in and
   bracket, new bonuses. AI opponents are still generated for now.
5. **Ghosts (D116)** (migration): the `ghosts` table, best-season
   replacement, and the snapshot migration.
6. **AI clubs (D113)** (migration): the `teams.kind` columns, the AI manager
   module, and an admin page to create the pool (250 clubs spread around
   Elo 1500).
7. **Leagues of clones (D115)** (migration): Elo-nearest picks from AI clubs
   and ghosts, with clones stored in `season_teams`.
8. **AI runs (D114)**: the `ai-world.yml` workflow, pace settings in admin,
   and an admin page showing recent runs.
9. **Check and tick M9**: let the world run for a week, check the database
   size and backup size, then tick M9.

## Needs Gary

- OK the playoff bonuses above (balance defaults).
- OK the backup change: gzipped, with the last 30 nights plus one a month
  for a year, instead of every night forever (D70).
- Add one repository secret when step 8 lands: `SUPABASE_SECRET_KEY` for
  Actions (the same value Vercel has).
- Whether the main repo is private matters for the GitHub Actions free
  minutes. A private repo gets 2,000 minutes a month. Twelve runs a day of
  about 2–3 minutes each is 700–1,100 minutes a month, which fits.

## Consequences

- AI clubs follow the same code paths and SQL functions as real clubs. A
  rule changes in one place, and AI clubs can't drift from real ones.
- `packages/game` becomes the one place that orders the steps of a game
  action. The web app gets thinner.
- `team_snapshots` and D33's ghost picking go away. Leaderboards read from
  `season_records`.
- More of the work runs while nobody is looking, so failed AI runs need to be
  visible. The admin page (step 8) shows the last runs and any errors, and
  GitHub emails Gary when a scheduled run fails.
