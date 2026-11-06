# ADR 0008: How a baseball game is simulated (M17)

Status: proposed (Nov 6, 2026). Covers D194–D198, D200, D202–D204, as D205
asks. Needs Gary's answers to the questions at the end before coding starts.

## Context

M16 put soccer behind the `Sport` interface and a sport registry (ADR 0007).
Baseball has a stand-in engine (random runs per inning) so the framework
could carry a second sport. M17 replaces it with the real engine in
`packages/sport-baseball`, plus a tuning harness. M18 builds the game around
it: club creation, packs, the squad builder, seasons and series, the AI
world and the match screens.

**Done when** (roadmap):
- games are deterministic
- the harness shows realistic run totals and win rates by skill gap
- every position averages the same form rating
- engine coverage is about 90%

**What is already decided:**

| | Decision |
| --- | --- |
| D194 | At-bat by at-bat, pitcher against batter, 9 innings. No draws: extra innings with a runner on second from the 10th. The home team bats last and gets a small skill boost (admin setting) |
| D195 | P, C, 1B, 2B, 3B, SS, LF, CF, RF and DH. Pitchers only pitch. Secondary positions and the −50% out-of-position penalty apply to fielders |
| D196 | Roster 14–30. Game-day squad: batting order of 9 (with the DH), 1 starting pitcher, up to 5 bench, up to 8 relievers |
| D197 | 5-man rotation, pitch counts, rest days, relievers by a bullpen plan. A series week is 4 days |
| D198 | Batters: contact, power, eye, speed. Fielders: fielding, arm. Pitchers: velocity, control, movement, stamina |
| D200 | 4 colors; each beats 1, loses to 1, is neutral against 1. Team and individual matchups as soccer |
| D202 | Batters: games, AVG, HR, RBI, SB. Pitchers: W, L, ERA, K, saves. Form tuned so every position averages the same |
| D203 | Nationalities led by USA, Dominican Republic, Venezuela, Japan, Cuba, South Korea, Puerto Rico, Mexico |
| D204 | At-bats never stored; replays recompute them from the seed. A box score (~2 KB) per game. This ADR measures simulation time |

## Decisions

### 1. Pitch by pitch, not one roll per at-bat

D194 says at-bat by at-bat. Inside each at-bat the engine plays **every
pitch**, because three later features need pitches:
- pitch counts tire pitchers (D197)
- the diamond view shows the count (D201)
- strike zone charts show where pitches went and where a batter hits well (D201)

**One pitch:**
1. **Location.** The pitcher aims at a spot; control sets how close it
   lands. Movement makes it harder to hit.
2. **Swing or take.** Eye decides how well the batter tells balls from
   strikes: swing at strikes, lay off balls.
3. **Contact.** Contact against velocity and movement decides miss, foul or
   ball in play. A pitch outside the zone is harder to hit well.
4. **Ball in play.** Power against velocity sets how hard it's hit. That
   sets the kind of hit (ground ball, line drive, fly ball, pop-up), and
   the batter's spray profile sets its direction.
5. **Fielding.** The fielder whose range covers the landing spot best
   fields it (see §4). Their fielding decides out, hit or error, and their
   arm decides whether the runner beats the throw.
6. **Running.** Runners advance by the hit, plus an extra base on speed
   against the fielder's arm.

Four balls is a walk and three strikes a strikeout. A foul with two strikes
keeps the count.

**Stolen bases** (D202). With a fast runner on first or second, the
batting side may try a steal before a pitch. Its chance is the runner's
speed against the catcher's arm. This is automatic for every club,
following a setting.

**Extra innings** (D194). From the 10th, each half-inning starts with a
runner on second: the batter before the leadoff man, as in MLB. Play goes on
until an inning ends with one side ahead. The bottom half isn't played when
the home side already leads.

**Home advantage** (D194). The home side's effective skill gets
`homeBoost` (proposed +3%). It's an admin setting, which facilities can raise later.

**Randomness.** Each kind of roll has its own `rng.fork`:
- location
- swing
- contact
- batted ball
- fielding
- running
- steals
- injuries
- bullpen

A new kind of roll gets a new fork, so adding one never changes existing
games (CLAUDE.md).

**Measured speed** (D204). A pitch-by-pitch prototype with the real seeded
RNG took **0.074 ms per game**:
- 5,000 games
- 265 pitches and 78 plate appearances each

On the same machine soccer's harness takes about 1.5 ms a match. The real
engine does more per pitch (fatigue, matchups, fielding ranges, stats), so
budget **under 1 ms a game**. At that speed:
- a 10,000-game harness run takes about 10 seconds
- an AI run (250 clubs, at most a 3-game series each per turn) adds well
  under a second

### 2. Players: positions, attributes, overall (D195, D198)

**Attributes** use soccer's 1–99 scale:
- **Batting:** contact, power, eye, speed. Every non-pitcher has these.
- **Fielding:** fielding, arm. Every non-pitcher has these.
- **Pitching:** velocity, control, movement, stamina. Only pitchers have these.

**Overall at a position** is a weighted mix, as soccer's `overallAt`.
Proposed weights, tunable in settings:
- **DH:** batting only.
- **1B, LF, RF:** mostly batting, some fielding.
- **C, SS, 2B, CF:** more fielding. C and SS weight arm and fielding most.
- **P:** pitching only, with stamina weighted more for starters. A
  pitcher's primary position is P, and they also carry a role preference:
  starter or reliever.

**Position fit.** Primary +25% and secondary +10%, as soccer. Anywhere else
takes the out-of-position penalty, −50% (D195). Pitchers can't be placed as
fielders and fielders can't pitch (no two-way players). The squad check
refuses it.

**Generation** reuses soccer's ages, potential, growth and worth rules,
with baseball's own weights:
- **Nationalities** (D203): USA, Dominican Republic, Venezuela, Japan,
  Cuba, South Korea, Puerto Rico, Mexico, then a tail. Core's name pools
  lack four of these: Dominican Republic, Venezuela, Cuba and Puerto Rico.
  M17 adds them, which doesn't change soccer's existing names.
- **Colors:** 4 (D200). `chemistryColorCount(10)` already gives 4.

### 3. Chemistry and color matchups (D200)

**Who counts.** The 10 players in the game: 9 batters, including the DH,
plus the pitcher on the mound. A pitching change recalculates chemistry,
as a substitution does in soccer. The groups and boosts are core's,
unchanged.

**A ring of 4 colors.** Core's `colorEdge` works on odd rings: each color
beats the next half. For an even ring it currently returns 0. The rule
becomes:
- each color beats the next one
- each color loses to the one before
- each color is neutral against the one opposite

It's a small change to core, and soccer's 5-color ring gives exactly the
same answers.

**Matchups** work as in soccer (D119):
- **Team-level:** your largest color group against theirs.
- **Individual:** the **pitcher's color against the batter's**, on every
  pitch of the at-bat. This is the baseball version of soccer's direct
  opponent.

Strengths are settings, off until a settings version turns them on, as
soccer's were.

### 4. Fielding ranges and zone profiles (templates)

Soccer has a position template: each position's influence over a 17 × 25
field grid. Baseball has two kinds of template, both data the admin
template editor edits in M18 (D201):

- **Fielding range:** each fielding position's reach over a **field grid of
  fair territory**: proposed 12 directions × 8 depths, from the plate out.
  A ball's landing cell goes to the fielder with the highest range there
  times their fielding. The range is also what the template editor draws
  for baseball (D201).
- **Zone and spray profiles:**
  - Each batter has a **5 × 5 strike zone profile**: the 3 × 3 zone plus a
    ring of balls just outside. It says where they hit well (hot) or badly
    (cold).
  - Each batter also has a **spray profile**: the directions they tend to
    hit.
  - Each pitcher has a **location profile**: where they like to pitch.
  
  Like soccer's variants (D134), a player gets one of a few presets at
  generation, e.g. "low-ball hitter", "pull hitter" or "paints the
  corners". These feed the strike zone and spray charts in M18 (D201).

`Sport.grid` stays optional. Baseball sets its own two grids instead.
`MatchOutput.influence` becomes optional in core: baseball returns none,
while soccer still returns its heatmaps.

### 5. Pitchers: fatigue, bullpen plan, rotation, rest (D197)

**In-game fatigue.**
- **Starting point:** each pitcher has a pitch budget from stamina,
  proposed 60 pitches at stamina 40 up to 110 at 90. Relievers get a
  smaller budget.
- **Past the budget:** velocity, control and movement fall a little with
  every extra pitch.
- **Batters:** they don't tire within a game.

**The bullpen plan** is the baseball version of soccer's sub plan, saved
with the game-day squad:
- **Starter:** a pitch limit.
- **Relievers:** up to 8, in an order with roles: closer, setup, middle.
- **Rules:**
  - the starter comes out at the pitch limit, or once tired past a set point
  - the **closer** takes the 9th with a lead of 3 or fewer
  - the **setup** man takes the 8th
  - others come in by order when the current pitcher tires
  - a reliever who isn't rested is skipped

A club without a plan gets a default one, as AI clubs and new squads do in
soccer.

**Rotation.** Five starters in order, saved as a lineup group (ADR 0007 §3).
Each game the next rested starter starts. If none is rested, the most
rested one starts, already tired.

**Rest in days** (ADR 0007 §5). Baseball's series week is 4 days (3 games
and a rest day, D197). A week without a game counts as 4 rest days. Proposed
defaults:
- **Starters:** a starter needs 4 rest days after 75+ pitches, 3 after
  50–74 and 1 after fewer.
- **Relievers:** a reliever needs a day off after 25+ pitches or after
  pitching 2 days running.

The engine reports pitches thrown. `packages/game` stores rest the way
soccer stores condition.

### 6. Bench, injuries and energy

- **Bench** (up to 5): used only to replace an injured player in M17. The
  engine picks the best fit for the position, as soccer's automatic subs
  do. Pinch hitters and runners are left for later (see questions).
- **Injuries:** a small chance per game per player, counted in days. Rates
  are settings. Baseball has no cards or suspensions.
- **Energy** (D61): 1 per game week, a 3-game series (D199). This is M18's
  season work, not the engine's.

### 7. Results, standings and stats (D202)

**Result rules** (ADR 0007 §6):
- **No draws.**
- **Points:** win 1, draw 0, loss 0. Standings show wins, losses and
  winning percentage.
- **Score name:** run and runs.
- **Tiebreak:** extra innings, key `extra_innings`.
- **Standings ties:** head-to-head first, then run difference.

**Stored totals** (stats by key, ADR 0007 §2):
- **Batting:** games, at-bats, hits, home runs, RBI, stolen bases, walks
  and strikeouts.
- **Pitching:** games pitched, wins, losses, outs recorded, earned runs,
  strikeouts and saves.

**Rates** are worked out when shown:
- **AVG** = hits ÷ at-bats, 3 decimals.
- **ERA** = earned runs × 27 ÷ outs, i.e. per 9 innings, 2 decimals.

**Win, loss and save** follow simplified MLB rules:
- **Win:** the pitcher of record when the winning side took the lead for
  good. A starter needs 5 innings to get it; otherwise it goes to the
  reliever who pitched best.
- **Loss:** the pitcher who gave up the run that put the other side ahead
  for good.
- **Save:** goes to the pitcher who finishes a win without getting it, if
  either:
  - they entered with a lead of 3 or fewer
  - they pitched the last 3 innings

**Earned runs, simplified.** A run is unearned if the runner reached on an
error. Real scorers rebuild the inning without the error; that's left out.

**Form** (D178): each player gets a game rating from what they did. A
batter is rated on bases gained, outs made, RBI and steals; a pitcher on
outs, runs allowed, walks and strikeouts. The weights are per position. The
harness prints form by position, as soccer's `--form` does, and the weights
are tuned until every position averages the same.

### 8. What the engine returns (D204)

`simulate()` returns:
- **The result:** runs, winner, `decidedBy: "extra_innings"`.
- **Events:** every pitch and play, in order. Each carries:
  - inning, half, outs, count and bases
  - batter and pitcher
  - pitch location and the batted ball's direction
  
  These feed the play-by-play, the diamond view and the charts in M18.
  They're never stored; a replay recomputes them from the seed (D204).
- **The box score**, about 2 KB, the only part stored:
  - the line score by inning
  - each batter's AB, R, H, RBI, BB, K, HR and SB
  - each pitcher's outs, H, R, ER, BB, K and pitches
  - the W, L and S decisions
- **Per-player reports:** stats, form and pitches thrown, for
  `packages/game` to save.

**Win probability** (D201) is a table by inning, outs, bases and score
difference. It's built from harness games and saved as data, so the graph
in M18 is just a lookup along the events.

### 9. Settings (ADR 0007 §7)

Baseball exports `BASEBALL_SETTING_GROUPS` for the generic balance editor:
- home boost
- chemistry boosts and matchup strengths
- the out-of-position penalty
- the pitch tuning (swing, contact and power curves)
- fatigue and rest
- steals
- injuries
- form weights
- generation

They're stored as versioned `game_config` under scope `baseball`, as soccer
does. A season uses the version it started with.

### 10. The harness

`pnpm --filter @lfs/sport-baseball harness 10000` plays even and uneven
games and prints these, with proposed targets (MLB-like):

| Measure | Target |
| --- | --- |
| Runs per game (both teams) | 8.5–9.5 |
| Home win rate, even teams | 52–55% |
| Games to extra innings | 7–10% |
| Strikeouts per team per game | 7.5–9 |
| Walks per team per game | 2.8–3.5 |
| Home runs per team per game | 0.9–1.3 |
| Batting average | .240–.255 |
| Win rate by skill gap | rises steadily: about 60% at 5 overall points, 75% at 10 |

It also prints:
- form by position
- pitches per start
- how often bullpens empty, from a no-rest test

It reports the time per game too, to keep D204's budget honest.

## Order of work (M17)

One PR each. The engine PRs are pure TypeScript with no migrations, so they
merge on green CI. The two database PRs (step 1 and step 9) wait for Gary.

| Step | What | Risk |
| --- | --- | --- |
| 1 | Drop the old soccer columns (stats, lineup, condition), after the lfs-prod check (ADR 0007 §13) | Migration; waits for Gary |
| 2 | Core: `colorEdge` for even rings, optional `MatchOutput.influence`, name pools for DOM, VEN, CUB, PUR | Low |
| 3 | Positions, attributes, overall, player, generation | Low |
| 4 | Effective skill, chemistry, matchups, home boost | Low |
| 5 | The pitch-by-pitch game: count, contact, batted balls, fielding ranges, running, steals, extra innings | Low |
| 6 | Fatigue, the bullpen plan, the rotation and rest days | Low |
| 7 | Stats, the box score, W/L/S, form | Low |
| 8 | The harness and tuning to the targets; the win probability table | Low (report in PR) |
| 9 | Baseball's real `Sport` replaces the stand-in; baseball settings in the balance editor | Migration (seeds baseball's settings); waits for Gary |

Baseball stays hidden from players throughout (D207).

## Not built now

- **M18:** pinch hitters and runners, defensive subs, intentional walks,
  bunts, double switches.
- **Left- and right-handed matchups:** not in D198.
- **Other details:** balks, wild pitches and passed balls; real scorers'
  earned-run reconstruction.

## Needs Gary

1. **Pitch by pitch** inside each at-bat, for pitch counts and the strike
   zone charts? It's cheap: well under 1 ms a game.
2. **Harness targets:** the table in §10 (about 9 runs a game, home teams
   winning 52–55%, 7–10% extra innings). OK, or other numbers?
3. **Four-color ring:** each color beats the next, loses to the one before,
   and is neutral against the opposite one. The individual matchup is
   pitcher against batter. OK?
4. **Zone and spray profiles** as presets per player (like soccer's
   variants), with fielding ranges as baseball's templates. OK?
5. **Bench in M17:** injury replacements only, with pinch hitters and
   runners later. Or do you want pinch hitting now?
6. **Injuries** in days, with no cards or suspensions. Stolen bases are
   automatic, with a setting. OK?
7. **Rest-day defaults** from §5 (a starter needs 4 days after 75+
   pitches). OK as starting values?
8. **Earned runs simplified:** a run is unearned only if the runner reached
   on an error. OK?
