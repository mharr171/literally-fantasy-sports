# ADR 0009: The baseball game (M18)

Status: proposed (Nov 6, 2026). Covers D193, D196, D197, D199, D201, D204
and D212 for the game around the engine, as D205 asks. Needs Gary's answers
to the questions at the end before coding starts.

## Context

M17 built baseball's engine (ADR 0008):
- the pitch-by-pitch game
- fatigue and the bullpen plan
- rotation and rest days
- bench roles and auto-pick
- box scores and stats
- the harness and the win probability table
- baseball settings in Admin → Balance

M18 turns it into a game a manager can play, and launches it (`v2.0.0`).

**Done when** (roadmap):
- a manager can play a full baseball season, postseason included
- AI clubs play baseball on their own
- the database stays within the D204 estimate

**Where things stand.** M16 made the tables sport-neutral:
- stats by key
- lineups as named groups
- fixtures with an event and a game number
- condition in days
- league size, roster limits and the Public and AI switches per sport

The code above the tables is still soccer's. Every step below goes through
the sport registry (ADR 0007 §1), so no shared file names a sport:
- **Season steps:** `startSeasonFor`, `playWeekFor` and `endSeasonFor` call
  soccer's engine and schedule.
- **SQL writers:**
  - `start_season` and `record_week` never write `event` or `game_no`.
  - `record_week` merges soccer's stat keys.
- **Packs:** soccer generates them.
- **AI world:** soccer only.
- **Web pages:** under `/soccer` only.

## Decisions

### 1. A season module per sport

The registry's `SportModule` gains a **season** part. `packages/game`'s
shared steps ask it what to do. Soccer's existing functions become its
implementation, unchanged, so soccer plays exactly as now (harness and
fingerprint tests unchanged). The season part covers:

- **schedule:** the league's fixtures from the clubs and settings
- **play a week:** the games, results, Elo, payouts, condition and the next
  fixtures (the next playoff round)
- **end of season:** aging, youth and the season record
- **packs:** starter plan, generation, tiers and prices
- **player rows:** to and from the database

Baseball implements each part on its engine.

### 2. Baseball's season (D199)

**League.** 15 clubs: the manager plus clones of the 14 nearest by Elo
(D115), with ghosts as soccer has. Every club plays every other once: 14
series, 7 at home and 7 away. A week is a 3-game series against one
opponent and costs 1 energy.

**The bye.** With 15 clubs, each week one club sits out.
- The manager's bye is **week 0**, played automatically when the season
  starts: the other 14 clubs play their week-0 series.
- So the manager plays weeks 1–14 straight through.
- Each clone's bye falls somewhere in weeks 1–14.
- The schedule is core's round robin, single round, with the odd club
  out. It gains a helper that puts a chosen club's bye in week 0.

**Series.** Each series is 3 fixture rows (`game_no` 1–3) on back-to-back
days (D197): 3 days of games, then a rest day. A series always plays all 3
games in the league.

**Standings.**
- Wins, losses, winning percentage and games behind.
- Ties break on head-to-head, then run difference (ADR 0008 §7).
- Core's `leagueTable` gains a tiebreak option, so soccer's order doesn't
  change.

**Postseason.**
- **Who qualifies:** the top 7, plus a **wildcard game**, 8th against 9th,
  for the last place.
- **Rounds:**
  - quarterfinals best of 3
  - semifinals best of 5
  - the final best of 7
- **Weeks:** each round starts a fresh week.
- **Home field:** the better seed hosts the wildcard game, all of a best of
  3, games 1, 2 and 5 of a best of 5, and games 1, 2, 6 and 7 of a best of
  7.
- **Drawing it:** core's `drawBracket` already handles series. Baseball
  lists its rounds as data, as soccer does.
- **Games not needed:** a best-of series is drawn in full. Games the series
  doesn't need (a 4–1 final leaves games 6 and 7) are marked **not
  played**. A new `fixtures.skipped` flag lets `record_week` accept a week
  with them unplayed.

**Season record.**
- `season_records` gets baseball's line: won, lost, runs scored and
  allowed, how far it went.
- `drawn` is 0 and `points` is the wins.
- `playoffs` gains `wildcard`, for losing the wildcard game.
- Reward packs follow the same ladder as soccer: champion, final, semi.

### 3. Pitchers' rest and the rotation

**Rest days.** A new `players.rest_days` column (integer, 0 by default) is
counted down by the days in each week (D197):
- 4 for a series week
- 4 for a bye or a gap between playoff rounds

After a game it's set from `starterRestDays` or `relieverRestDays` (D213).

**Rotation.** The rotation order and the **last starter** live in the
squad's `lineup_data`. Each game's starter comes from `nextStarter`.

**Resting relievers.** Those still resting are passed to the engine as
unavailable, and the bullpen plan skips them.

### 4. Players

Baseball's extra traits go in one new `players.traits jsonb` column:
- the pitcher's role
- the zone, spray and location presets

Soccer leaves it empty. Every other column already fits: positions,
secondary position, colors 0–3, attributes and condition. The player row
helpers, the three pack-resolve functions, the clone builder in
`start_season` and the ghost snapshot all carry `traits`.

### 5. Writers become sport-neutral

**`record_week`:**
- It takes each player's **stat deltas as a `stats` object**, keyed by the
  sport's stat keys (`gameStats`), instead of soccer's fixed list.
- Soccer sends its keys the same way.
- Fitness and yellow cards become optional. Baseball sends neither: no
  in-game fitness, no cards.

**`start_season` and `record_week`:**
- They write `event` and `game_no`.
- They accept week 0.

**Rollout.** Expand first, then switch (ADR 0007 §13): each SQL change is
a database-only PR, merged and live on lfs-prod before the code that uses
it.

### 6. Packs and the shop (D196)

**Sizes and focuses.**
- Packs are 5 players, as soccer's.
- Baseball's focuses: **Pitchers**, **Infield** (C, 1B, 2B, 3B, SS),
  **Outfield** (LF, CF, RF, DH) and **Any**. The `packs_focus` check
  widens to allow them.

**Starter packs (proposed).**
- 16 starter packs: 6 of Pitchers and 10 batters (5 Infield, 5 Outfield),
  80 players in all.
- The manager keeps 14 to 30 of them (D196).
- At least 9 pitchers and 9 batters, so a rotation of 5 and a lineup of 9
  can be set.

**Bought packs:** the same tiers, Elo shift and color choices as soccer
(D179, D180). Baseball has its own prices.

**Reward packs and youth:** as soccer's.

**Settings.** Baseball's balance settings gain these groups in Admin →
Balance, stored under baseball's versions:
- payouts
- pack prices
- condition
- form
- generation

**Proposed payouts:**

| | Amount | Note |
| --- | --- | --- |
| Per game played | 120 | |
| Per win | 180 | |
| Postseason round reached | as soccer's | |

That's about 9,000 for a .500 season of 42 games, close to soccer's
season.

### 7. Elo and payouts per game

- **Elo** moves after every game, with a K factor for baseball (proposed
  K = 8, a third of soccer's, because there are 3 games a week).
- **Energy** is spent once per week.

### 8. The squad builder (D196, D212)

Baseball's `/baseball/team/squad` has:
- **Batting order:** 9 slots in order, each with a position. The DH is
  set once.
- **Rotation:** 5 starters in order, marked with who starts next.
- **Bullpen:** up to 8 relievers in order, with the closer and setup man
  marked, and the starter's pitch limit.
- **Bench:** up to 5, each with a role: pinch hitter, pinch runner,
  defensive replacement or injury cover. A role can name the starter it
  replaces.
- **Lineup style and auto-pick:** Balanced, Bat first or Glove first.
- **Ratings:** each player shows **Bat** and **Field** at the slot, beside
  the overall (D212).

The pieces are the reusable ones ADR 0007 §3 named (an ordered list,
slots, roles). The saved squad is `lineup_data` groups that the engine
checks.

### 9. Match screens and player charts (D201)

**Match page.** It replays the game from its seed (D204) and shows:
- the **diamond view:** runners, outs, count, batter and pitcher, stepping
  pitch by pitch or play by play
- the **line score** and **box score**
- the **play-by-play**
- the **win probability graph** from ADR 0008's table

**What's stored.** The box score goes in `fixtures.summary`, the replay
team in `manager_team`, as soccer's are.

**Player pages:**
- **Strike zone charts:**
  - a batter's hot and cold zones, from his zone preset
  - a pitcher's locations, from his preset
  - the pitches from his most recent games, replayed
- **Spray chart:** from the preset, plus the most recent games' batted
  balls.

**Template editor.** For baseball it edits the fielding ranges on a field
and the presets.

### 10. The AI world (D193)

A baseball `AiManager` follows soccer's interface:
- identity
- starters and squad, using auto-pick with a style for each personality
- packs, keeps, youth and releases

The interface's soccer-shaped `formations` argument becomes per-sport
options.

**Pool and schedule.**
- A pool of **250 baseball AI clubs**, its own `ai_settings` row.
- Runs on the same schedule and pace rules as soccer (D113, D114).
- The runner loops over every sport whose AI world is on.

### 11. History, hall of fame, leaderboard

These read stats by key and the sport's stat definitions, so baseball gets:
- **History:** season lines.
- **Hall of fame:** home runs, hits, wins, saves and strikeouts.
- **Leaderboard:** wins and run difference.

`reset_account` and the guide take a sport.

### 12. Data and launch (D204)

**Measuring.** Before launch, a test fills a copy of the database with a
baseball AI season and measures:
- the box score size
- the rows per season
- the growth per year

It checks them against D204's estimate (about 2 KB per game, about 150 MB
for the AI world). The AI world keeps box scores for two seasons, as
soccer's pruning does.

**Launch.** Baseball stays hidden until Gary turns on its **Public** and
**AI world** switches (D207). Release `v2.0.0` uses a `Release-As`
footer.

## Order of work (M18)

One PR each. Database PRs (marked) wait for Gary and go live before their
code.

| Step | What | Risk |
| --- | --- | --- |
| 1 | Season module in the registry; soccer behind it, unchanged | Refactor; harness unchanged |
| 2 | **DB:** `players.traits`, `players.rest_days`, `fixtures.skipped`, `packs_focus` and `season_records_playoffs` widened | Migration |
| 3 | **DB:** `record_week` takes stat deltas by key and optional fitness; `start_season`/`record_week` write `event`/`game_no` and week 0 | Migration |
| 4 | Soccer sends stats by key (no behaviour change) | Low |
| 5 | Baseball packs, starter plan, youth and aging in the engine, plus payouts/packs/condition/form/generation settings | Low |
| 6 | Club creation with starter packs, scouting and keeping 14–30 | Gary checks the preview |
| 7 | Squad builder | Gary checks the preview |
| 8 | The season: schedule with the week-0 bye, series, standings, playing weeks, rest days, energy, Elo, payouts | Gary checks the preview |
| 9 | Postseason: wildcard, best-of series, skipped games, season close, records and reward packs | Gary checks the preview |
| 10 | Match page: diamond view, line and box score, play-by-play, win probability | Gary checks the preview |
| 11 | Player pages: strike zone and spray charts | Gary checks the preview |
| 12 | Template editor for fielding ranges and presets | Gary checks the preview |
| 13 | Baseball AI world: AiManager, 250-club pool, runner over sports | High (scheduled runs); Gary checks |
| 14 | History, hall of fame, leaderboard, guide, account reset for baseball | Gary checks the preview |
| 15 | Data check against D204; launch checklist | Gary switches baseball on |

## Not built now

- Baseball morale beyond soccer's (form only).
- Trades.
- Two-way players.
- Handedness.
- Per-season stat lines (careers only, as soccer).

## Needs Gary

1. **Season module:** each sport plugs its season into the registry, and
   soccer's code moves behind it unchanged. OK?
2. **Postseason games not needed:** marked "not played" (a new flag)
   rather than deleted. OK?
3. **Pitchers' rest:** a `rest_days` column on players, with the rotation
   and last starter in the saved squad. OK?
4. **Baseball traits:** role and presets in one `traits` column. OK?
5. **Starter packs:** 16 packs of 5 (6 Pitchers, 5 Infield, 5 Outfield),
   keeping 14–30, with at least 9 pitchers and 9 batters. OK, or a
   different mix?
6. **Pack focuses:** Pitchers, Infield, Outfield, Any. OK?
7. **Payouts:** 120 per game and 180 per win, with round bonuses as
   soccer's. Elo after every game at K = 8. OK as starting values?
8. **Player charts:** zones and spray from the presets, plus pitches and
   batted balls replayed from the most recent games. How many games: the
   last 5?
