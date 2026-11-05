# ADR 0005: Season history, hall of fame and retirement tributes (M14)

Status: proposed (Nov 5, 2026). Covers D121, built on the permanent records
of D120 and the player stats of D143. Points marked **(proposed)** need
Gary's OK.

## Context

D121 asks for three things:

- a page for every past season
- a hall of fame, both global and per club (a club's all-time greats)
- retirement tributes

The data is already kept:

| Data | Where | Kept |
| --- | --- | --- |
| One line per club per season: place, W-D-L, goals, points, Elo before and after, playoff result | `season_records` | Forever (D120) |
| Every season's league: club names, final Elo, fixtures with scores and match summaries (goal scorers, cards, injuries) | `seasons`, `season_teams`, `fixtures` | Forever; replays only for the last two (D120) |
| Players' career totals: games, W-D-L, goals, assists, tackles, saves, seasons, best overall | `players` | Current players |
| Retired players' careers: the same totals, clubs and the season they retired | `player_careers` | Forever |
| Each real club's best season, frozen | `ghosts` | Forever (D116) |

So M14 adds pages, not tables. The only database change is indexes, so the
hall of fame's rankings stay fast as the game grows.

## Decisions

### 1. Season history (my club)

**Where:** a new **History** tab on My team (`/team/history`).

**The list:** every season the club has played, newest first. Each row
shows:
- season number
- final place
- W-D-L, goal difference and points
- Elo before → after
- playoff result (🏆 for champions)

The current season is at the top, marked "in progress".

**A season's page** (`/team/history/[season]`) shows:
- the final league table, as it finished
- the playoff bracket
- every one of the club's results, with links to the matches (replays
  only where they're still kept; older matches show their summary)
- the club's top scorers that season, counted from the goal events in its
  own match summaries
- who retired at the end of it, and who grew or declined (the season
  review that's already saved)

**Other clubs' seasons:** not shown here **(proposed)**. Leaderboard
entries keep showing each club's best season (D111, D116).

### 2. Hall of fame, per club

**Where:** a **Hall of fame** section on the History tab.

**All-time greats:** current and retired players together, the top 10 in
each of:
- games
- goals
- assists
- tackles
- saves
- best overall

Each list shows the player's position, seasons at the club and whether
they've retired.

**Honours:**
- titles (playoff champions)
- finals reached
- best finish
- highest Elo
- longest unbeaten league run

Players count only what they did for this club. Each player belongs to one
club for life (there are no transfers yet), so their career totals are
their totals for this club.

### 3. Hall of fame, global

**Where:** a public page, `/hall-of-fame`, in the header next to
Leaderboard. Like the leaderboard, it can be seen without signing in.

**Clubs:**
- most titles
- highest Elo ever reached
- most seasons played

Each club appears once per list, with a link to its leaderboard entry.

**Players:** the top 25 of all time in each of:
- goals
- assists
- tackles
- saves
- games

Each player is shown with their club.

**Who counts:** real clubs and AI clubs alike, as on the leaderboard. AI
clubs and real clubs look the same to players (D113). Admins see which is
which (D171).

**What's shown:** only club names, never managers' names **(proposed)**.
Players are generated, so no personal data is shown (D111).

### 4. Retirement tributes

**When:** at season end, each player who retires gets a tribute card in
the season wrap-up, instead of the one-line "retired" entry.

**What it shows:**
- name, position and age
- seasons played and games
- W-D-L and win %
- goals, assists, tackles and saves
- best overall
- "one of the club's greats" if they're in any of the club's top-10 lists

**Afterwards:**
- The card stays on that season's history page.
- The club's Hall of fame keeps a **Retired** list, newest first.

### 5. Soft resets and account resets

These pages read the same records that resets clear:
- An admin soft reset (D142) empties history and the hall of fame for the
  clubs in scope.
- An account reset (D141) removes the club entirely.

Nothing new is needed.

### 6. Performance

The new pages are read-only. Two kinds of query need indexes:
- Players by goals, assists, tackles, saves and games.
- Careers by the same totals.

These come in one small migration with no data changes, so the persistence
check (D131) is unaffected.

## Order of work (M14)

| Step | PR | Risk |
| --- | --- | --- |
| 1 | This ADR | Docs |
| 2 | History tab: the season list and a season's page | UI |
| 3 | Retirement tributes in the wrap-up and on season pages | UI |
| 4 | The club's hall of fame | UI |
| 5 | The global hall of fame, its indexes and the header link | Migration (indexes only); waits for Gary |
| 6 | Tick M14 | Docs |

## Needs Gary

- OK the two **(proposed)** points:
  - a season's page is only for your own club
  - the global hall of fame shows club names, not manager names
- Anything to add or drop from the lists above.
