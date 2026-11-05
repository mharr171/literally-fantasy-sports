# ADR 0006: Packs, rosters and playoffs (M15)

Status: proposed (Nov 5, 2026). Covers D178–D184. Gary already OK'd the
proposed points in D180, D181 and D183. Points marked **(proposed)** here
need Gary's OK.

## Context

Gary's fourth round of notes (D178–D184) is the last soccer milestone
before the freeze (D185):

- form that builds the same for every position
- packs that keep up as a club climbs
- more kinds of packs
- per-sport roster limits
- playing a man down
- a drawn playoff bracket

**Replay rules (as in ADR 0003):**
- Anything that changes how matches play is a settings value that is off
  in versions without it.
- Seasons play by the settings version they started with.
- New random rolls get their own `rng.fork`.

## Decisions

### 1. Roster limits per sport (D182)

**Where they live:** in `sport_settings`, edited in Admin → Sports.
- New columns: `roster_min`, `roster_max` and `bench_max`.
- Soccer gets 11, 33 and 11.

**The engine:** it reads the limits instead of fixed constants. They
replace `ROSTER_MIN` 22, `ROSTER_MAX` 30 and `BENCH_SIZE` 11.

**The matchday squad:** 11 starters and **0–11 substitutes**.
- A shorter bench just means fewer subs to make.
- The sub plan can only use players on the bench.

**Starter scouting:** keeps 11–33 of the 110 players offered.

**Blocks:**
- Releasing or reselling below the minimum is blocked.
- A roster above the maximum blocks the next match, as in D54.

**Migration:** this is a migration, but nothing about existing data
changes. Every current roster of 22–30 is valid under 11–33.

### 2. Playing a man down (D183)

**Who plays:** injured or suspended players never fill in. Today
`availableSquad` swaps in the bench and fails when it runs out. From now
on:

1. Each unavailable starter is replaced from the bench, as today:
   - in-position players first
   - then the best rating
2. A slot nobody can fill **stays empty**.
3. An empty slot has no player. It adds no influence and no skill, so
   the opponent's influence in that area is unopposed.
4. If no keeper is available, the best available outfield player moves
   into the keeper's slot with the out-of-position penalty (D135).
   Their own slot is left empty instead.
5. A club with fewer than **7 players** available forfeits the match
   3–0, as in real soccer **(proposed)**.

**Auto-pick and the AI:** they leave unavailable players out instead of
padding the lineup with them (this replaces part of D97). The squad page
shows an empty slot with "nobody available".

**Replays:** matches that played before are unchanged. The engine only
takes the new path where, until now, the match couldn't be played at all
("fewer than 11 players can play").

**Harness:** gains a "10 against 11" report. The target is that the side
with 10 wins clearly less often, about 25–30% wins against an equal side.

### 3. Form by position and minutes (D178)

**The problem:** a match rating starts at 6 and moves with:
- the result
- goals, assists, tackles and saves
- clean sheets
- cards

Today attackers average higher than defenders and keepers, so they build
form faster.

**Per-position weights:** each stat gets a weight per **position line**
(keeper, defence, midfield, attack). That's 4 lines × 5 stats (goals,
assists, tackles, saves, clean sheets), new settings in the "Form and
morale" group.
- A version without them uses today's single set of weights.
- The harness gains an "average match rating by position" report.
- Claude Code tunes the weights until every line averages within
  **±0.1** of the others.

**Minutes:** how far form moves scales with minutes played (minutes ÷ 90,
up and down alike). A new setting, `minutesScaling`, turns this on and
replaces the cameo halving. It's off (0) in old versions, which keep the
halving.

Form's effect on skill is unchanged, so matches only change through the
form players carry in.

### 4. Elo-scaled packs (D179)

**The shift:** each bought tier's skill bands move with the club's Elo
when the pack is bought:
- `shift = round((elo − 1500) ÷ eloPerOverall)`
- `eloPerOverall` defaults to **40** **(proposed)**. That's half as
  steep as AI clubs, where 20 Elo is one overall point, so packs trail a
  club's strength and strong clubs can't run away.
- The shift is capped at **−10 and +15**.
- Bands stay within 30–99.

**Prices:** move with the shift.
- `price × (1 + shift × pricePerOverall)`
- `pricePerOverall` defaults to **3%** **(proposed)**.
- So a Gold pack at Elo 1900 (shift +10) costs 39,000 instead of 30,000.

**The shop:** shows the odds and price for the club's Elo now.

**AI clubs:** buy by the same rules.

**Settings:** both values sit in a new "Packs" group of the soccer
balance settings. The scaling is off (shift 0) until a version sets them.

**Check before publishing:** a harness run of 10 simulated seasons of AI
clubs. Each season they buy packs at their Elo, age and play. The
spread of squad overall between the top and bottom clubs must not grow
season on season.

### 5. Color exclusion (D180)

A bought pack can leave out 1, 2 or 3 of the five chemistry colors.
- **Surcharges:** +25%, +60% and +120%, set in admin.
- **With a position focus:** the surcharges add, e.g. a defence focus
  plus 1 color left out costs +20% + 25% = +45%.
- **How players are rolled:** in the pack's own `rng.fork("colors")`,
  from the colors that remain.

### 6. New pack types (D181)

| Pack | Ages | Skill | Potential | Price |
| --- | --- | --- | --- | --- |
| **Prospect** | 17–20 | Basic's bands −10 | Rolled higher: the potential range starts 10 above overall **(proposed)** | Like Silver |
| **Veteran** | 30–33 | Silver's bands +3 | At or below overall | 70% of Silver **(proposed)** |
| **Wildcard** | Any | Wider bands: 15% at 40–49, 15% at 80–89, the rest across 50–79 **(proposed)** | Normal | Like Silver |
| **Reward** | Any | Gold, Silver or Basic | Normal | Free |

**Shared rules:** all of them follow the Elo shift and can take a position
focus and color exclusion. They have published odds like the other tiers.

**Reward packs:** given at season end for the playoff finish:
- champion: Gold
- finalist: Silver
- semi-finalist: Basic

They land unsorted with the club's other packs. AI clubs get theirs too.

### 7. Playoff bracket (D184)

A bracket drawing replaces the playoff part of the results list:
- **Rounds:** play-in, quarter-finals, semi-finals and the final.
- **Each match:** the seed, club, score and winner. Rounds not yet
  played show the seeds that will meet.

It appears on the season page and on every past season in History. Old
8-club seasons draw their semi-finals and final. It's UI only.

## Order of work (M15)

| Step | PR | Risk |
| --- | --- | --- |
| 1 | This ADR | Docs |
| 2 | Playoff bracket (§7) | UI |
| 3 | Roster limits per sport and a bench of up to 11 (§1) | Migration; waits for Gary |
| 4 | Playing a man down (§2), with the harness report | Engine; harness |
| 5 | Form by position and minutes (§3), with tuned weights | Balance; harness |
| 6 | Elo-scaled packs and color exclusion (§4, §5) | Migration and balance; waits for Gary |
| 7 | Prospect, Veteran, Wildcard and Reward packs (§6) | Migration; waits for Gary |
| 8 | Gary publishes a settings version with the new values; tick M15 | Admin |

## Needs Gary

OK the **(proposed)** points:
1. Forfeit 3–0 below 7 available players.
2. Packs move 1 overall per 40 Elo, capped at −10 and +15, with prices
   moving 3% per overall point.
3. The Prospect, Veteran and Wildcard numbers in §6.
