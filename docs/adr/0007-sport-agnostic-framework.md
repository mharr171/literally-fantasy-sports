# ADR 0007: A framework for every sport (M16)

Status: accepted (Nov 6, 2026: Gary OK'd every point, with sport toggles
in admin for point 3). Covers D190–D192, D206 and D207, as D205 asks.

## Context

Soccer works and is frozen (D185). Baseball comes next (M17, M18), then
paintball, football, basketball and hockey. Today soccer is wired straight
into the shared code:

| Where | What's soccer-only |
| --- | --- |
| `packages/game` | 52 files across it and the web app import `@lfs/sport-soccer` directly; `"soccer"` is hard-coded in team, formations, hall of fame, play-week and sport settings |
| `players`, `player_careers` | Stat columns: `goals`, `assists`, `tackles`, `saves`, `stat_goals`… |
| `players` | Condition in weeks: `injured_weeks`, `suspended_weeks`, `yellow_cards` |
| `matchday_squads` | `formation`, `lineup`, `bench`, `sub_plan` columns |
| `fixtures` | `stage` limited to league, play-in, quarter, semi, final; one game per row with no series |
| Web app | Routes at the top level (`/team`, `/season`…); the squad builder, match view, heatmaps, template editor and balance editor are soccer screens |
| `Sport` (core) | Requires a `grid`; knows only `allowsDraws` |

Some of it is already per sport:
- `teams` is unique per owner and sport, so funds, energy and Elo are
  already a club's own.
- `game_config_versions` is scoped by sport.
- `sport_settings` has a row per sport.

**M16's goal:** move every soccer-specific piece behind the `Sport`
interface and a sport registry, so baseball (and later sports) plug in
without touching shared code.

**Done when** (roadmap):
- Soccer plays exactly as before: every test, the fingerprint and the
  harness are unchanged, and existing data is migrated without loss (D131).
- Every old link redirects.
- Baseball (with a stand-in engine) is hidden from players and visible to
  admins until its toggles are switched on.

**How the shapes are chosen (D206):** they are designed with all six
sports in mind, but only what soccer and baseball need is built. Each
decision below lists the later needs it leaves room for.

## Decisions

### 1. Two registries: engine and UI

**Engine side.** `packages/game/src/sports.ts` maps each `SportId` to a
**sport module**. A sport module is the engine's `Sport`, plus what the
game layer needs from that sport:
- its stats, lineup rules, results rules and settings (§2–§7)
- its AI manager (§8)
- its pack tiers and player generation

`packages/game` asks the registry for "the sport of this club" and never
imports `@lfs/sport-soccer` outside the registry.

**UI side.** `apps/web/src/sports/<sport>/` holds each sport's screens:
- match view and player charts
- lineup builder pieces
- admin editors
- guide text

`apps/web/src/sports/registry.ts` lists them. Shared pages (season, shop,
history, hall of fame, admin) ask the registry for the parts they show.
Each sport's code is loaded with `next/dynamic` on its own pages only, so
soccer pages never download baseball code.

**The `Sport` interface in core grows.** `grid` becomes optional (D206.6).
New members describe stats, lineup groups, results rules and settings, as
plain data plus pure functions. The engine stays pure TypeScript, with no
I/O, as today.

### 2. Stats stored by key (D206.1)

**Definitions.** Each sport lists its stats: key, label, short label,
`total` or `rate`, and for a rate, its numerator and denominator keys.
- Soccer: games, wins, draws, losses, goals, assists, tackles, saves.
- Baseball later: batting average = hits ÷ at-bats, ERA = earned runs × 9
  ÷ innings.

Only totals are stored. Rates are worked out when they're shown.

**Storage.**
- `players` and `player_careers` gain a `stats jsonb` column, e.g.
  `{"goals": 12, "assists": 4}`.
- A migration backfills it from today's columns.
- Writes go to both, and reads move to `stats`.
- The old columns are dropped in a **later release**, after the backfill is
  checked on lfs-prod (step 12). Until then they are kept in sync, so
  nothing is lost (D131).

**Readers.** History, the hall of fame and the form weights read stats by
key. The hall of fame's indexes become expression indexes on
`(stats->>'goals')::int`, created per sport from its definitions. Soccer's
leaderboards stay as fast as now.

**Not built now:** per-season stat lines. They stay career totals only, as
D143.

### 3. Lineups as sport-defined groups (D206.2)

**The shape.** A saved squad becomes `lineup jsonb` of named groups, which
the sport validates:

| Sport | Groups |
| --- | --- |
| Soccer | `formation`, `starters` (slots), `bench`, `subPlan` |
| Baseball (M17) | `battingOrder` (9 with DH), `startingPitcher`, `bench` (≤ 5), `bullpen` (≤ 8), `bullpenPlan` |
| Later | football's units with depth charts, hockey's lines, basketball's minutes |

**Storage.** `matchday_squads` gains `lineup_data jsonb`, backfilled from
today's four columns. It follows the same keep-in-sync-then-drop path as
§2. `squadProblems` and auto-pick become the sport's own lineup rules.

**The builder.** The squad builder is assembled from reusable pieces:
- **slots on a field** (soccer's pitch, baseball's diamond)
- **an ordered list** (batting order, rotation)
- **a depth chart** (built when football needs it)

Each sport's UI module says which pieces its groups use.

### 4. Seasons: events, stages and series (D206.3)

**The model.** A season holds one or more **events**. An event has
**stages**: league, pool, bracket or best-of series.

| Sport | Events and stages |
| --- | --- |
| Soccer | One event: a league, then a bracket of single games |
| Baseball | One event: a league of 3-game series, then a bracket of a wildcard game and best-of-3, 5 and 7 series |
| Paintball (later) | A tour of several events, with ranking points across them |

**Tables.** No new tables are needed now:
- `fixtures` gains `event` (default `'main'`) and `game_no` (default 1).
  A fixture row stays one game. A series is the rows that share a week and
  pairing, so a 3-game series is 3 rows with `game_no` 1–3.
- The `fixtures_stage` check is replaced by a check that the stage is a
  short key. Each sport lists its own stages (soccer keeps league,
  play_in, quarter, semi, final).
- Standings run within a stage, by the sport's rules (§6).

**Settings.** League size, byes, series lengths and the postseason shape
become per-sport settings. Soccer's values are today's: 12 clubs, a
double round robin, 8th v 9th play-in, top 8.

**Not built now:** standings across events (ranking points), for
paintball.

### 5. Fitness and recovery in days (D206.4)

**Units.** Condition counts **days**. Each sport says how many days a game
week holds, and which of them are game days. Recovery is per rest day,
injuries are in days, and bans are in games.

**Soccer keeps exactly today's numbers.** Its week is **1 day**, its only
game day, so "Weekly recovery 20" becomes "Recovery per day 20". Soccer
plays as before with no rounding.

**Baseball's week** is 4 days (3 games and a rest day, D197). Baseball
settings will hold a small per-day recovery.

**Storage.** `injured_weeks` and `suspended_weeks` are renamed to
`injured_days` and `suspended_games`, with values copied unchanged (1 soccer
week = 1 day = 1 game). The settings keys move the same way: stored
versions without the new keys load the old ones.

### 6. Results and standings from the sport (D206.5)

Each sport supplies its results rules:
- whether league games can be drawn
- how a knockout game is decided (soccer: extra time, then penalties;
  baseball: extra innings)
- the score's name (goals, runs)
- points for a win, draw and loss
- the order of standings tiebreakers

Shared code (standings, bracket drawing, the season page) reads these
instead of soccer's rules. `playoffBracket` moves from soccer to core,
because its shape comes from the stage settings (§4).

### 7. A balance editor built from settings (D206.7)

**The data.** Each sport exports its settings as groups of fields: key,
label, help, min, max, integer, default. Soccer's are today's `Limit`
records: tuning, payouts, packs, condition and form.

**The editor.** The admin balance page becomes one generic editor that
draws a sport's groups, validates against the limits, and saves to that
sport's settings versions. Soccer-only extras (the color ring editor, the
"middling season pays" line) are UI pieces from soccer's module.

**The template editor** becomes soccer's tool, under
`apps/web/src/sports/soccer/`.

### 8. The AI manager behind an interface (D206.8)

An **AI manager** per sport implements:
- `pickStarters`
- `pickSquad`
- `choosePack`
- `chooseKeeps`
- `chooseYouth`
- `chooseReleases`
- `formationChange`, optional

Soccer's existing functions become its implementation, unchanged. The AI
runner in `packages/game` loops over sports and their AI clubs, asking each
club's sport's manager. Baseball adds its pool of 250 clubs in M18 (D193).

### 9. Account progress, sport-neutral (D206.9)

A new `account_progress` table: owner, sport, kind, value, season and
time. Rows are written at season close, e.g.:
- `season_played`
- `title`
- `final`
- `best_elo`

It's for future cross-sport bonuses. Nothing reads it yet, apart from an
admin view. Each row is backfilled from `season_records`.

### 10. URLs and switching (D191)

**Routes.**
- Each sport's pages live under its id: `/soccer/team`, `/soccer/season`,
  `/soccer/leaderboard`, `/soccer/hall-of-fame`, `/soccer/guide`.
- The old top-level paths get **permanent redirects** in `next.config`,
  query strings kept, so every bookmark and link still works.
- Shared pages stay top-level: account, sign-in, legal pages, What's new.
- Admin stays at `/admin`, with a sport switcher for the sport-specific
  pages (balance, templates, formations, AI clubs).

**Choosing a sport.**
- **Home page:** a card for each sport the viewer can see.
- **Top bar:** a small icon per sport. Each one goes to that sport's team
  page, or its club creation page if the viewer has no club in it yet.

### 11. Clubs and settings per sport (D192)

Already in place:
- Clubs, funds, energy and Elo, since clubs are unique per owner and sport.
- Settings versions, which are scoped by sport.

M16 adds:
- **League size** in `sport_settings`, with the format settings of §4.
- **Per-sport pages:** leaderboards and the hall of fame filter by sport.
- **Club creation:** a "Copy from my soccer club" option fills the name
  and colors. Names stay unique per sport.

The account and theme stay shared.

### 12. Sport toggles in admin (D190, D207)

**Two toggles per sport.** Admin → Sports lists every sport with:

| Toggle | On | Off |
| --- | --- | --- |
| **Public** | Players see the sport: home page card, top-bar icon, club creation, its pages, leaderboard and hall of fame | Hidden from players; its pages show "not found" to them |
| **AI world** | The scheduled AI runs play that sport's AI clubs | The scheduled AI runs skip it |

**Who sees a hidden sport.** Admins always see every sport, public or
not, so a sport can be built and tried before launch.

**The starting values.**
- Soccer starts with both toggles on, as today.
- Baseball starts with both off.

**Storage.** `sport_settings` gains `public` and `ai_enabled` booleans.
Every page and the AI runner check them on the server, so a hidden sport
can't be reached by typing its URL.

**Baseball during M16.** There's no baseball engine until M17. So that
the toggles can be tried end to end in M16, baseball gets a stand-in:
matches with random scores, a lineup of 9 and one stat. Only admins can
see it while Public is off. M17 replaces the stand-in with the real
engine, and the toggles stay as they are.

### 13. Replay safety and data

**Soccer replays.** Every stored soccer match must replay to exactly the
same result:
- the fingerprint test and the harness report stay byte-for-byte the same
- seeded random streams are untouched (`createRng` and every fork label)

**Migrations follow expand, backfill, switch, contract:**
1. Add new columns with defaults.
2. Backfill them in the same migration.
3. Write both old and new; read the new.
4. Drop the old only in a later release, once a check confirms they match
   on lfs-prod.

CI's persistence check (D131) runs on every step, and the database tests
gain checks that each backfill matches the old columns.

## Order of work (M16)

| Step | PR | Risk |
| --- | --- | --- |
| 1 | This ADR | Docs |
| 2 | Extended `Sport` interface in core, soccer's module, the game registry; `packages/game` stops importing soccer directly (§1, §6, §8) | Engine refactor; harness and fingerprint unchanged |
| 3 | Stats by key: `stats` columns, backfill, readers moved (§2) | Migration; waits for Gary |
| 4 | Lineups as groups: `lineup_data`, backfill, soccer's lineup rules (§3) | Migration; waits for Gary |
| 5 | Events, stages and `game_no`, format settings, results rules, bracket in core (§4, §6) | Migration; waits for Gary |
| 6 | Condition in days (§5) | Migration; waits for Gary |
| 7 | Settings-driven balance editor (§7) | Admin UI |
| 8 | Web sport registry: soccer's screens into `sports/soccer/`, template editor moved (§1, §7) | UI refactor |
| 9 | `/soccer/...` URLs, redirects, sport picker and top-bar icons (§10) | UI; every old link tested |
| 10 | Per-sport club creation with copy option, leaderboards and hall of fame by sport (§11) | UI |
| 11 | Public and AI world toggles per sport, and the baseball stand-in for admins (§12) | Migration; waits for Gary |
| 12 | Account progress (§9) | Migration; waits for Gary |
| 13 | Tick M16 and release `v1.7.0`; the drops of old columns follow in M17's first PR once lfs-prod is checked | Docs |

## Not built now (D206)

These are recorded here so M16's shapes leave room for them:
- **Paintball:** a tour of tournaments, ranking points across events, an
  invitation-only year-end event.
- **Football:** a three-unit squad builder with depth charts.
- **Hockey:** line changes during a game.
- **Basketball:** a minutes rotation.
- Per-season stat lines.

## Needs Gary

Gary OK'd all five (Nov 6, 2026):

1. Soccer's week counts as one day, so every soccer number stays exactly
   as it is (§5).
2. Sport pages go under `/soccer/...`; account, sign-in, legal and What's
   new stay shared; admin stays at `/admin` with a sport switcher (§10).
3. Admin → Sports has a **Public** toggle and an **AI world** toggle for
   each sport. Admins always see every sport. Baseball starts hidden, with
   a stand-in engine until M17 (§12, D207).
4. The old soccer stat, lineup and condition columns are kept in sync
   through `v1.7.0` and dropped in M17's first PR, after a check on
   lfs-prod (§13).
5. Account progress is a simple log of season-end milestones per sport
   (§9).
