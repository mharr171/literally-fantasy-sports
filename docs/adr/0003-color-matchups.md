# ADR 0003: Color matchups and the color cycle (M11)

Status: accepted (Nov 5, 2026: Gary OK'd the cycle and the strengths). Covers
D119, D138 and D149.

## Context

Every player has one of five permanent chemistry colors: Red, Blue, Green,
Yellow and Purple (D42). Today colors only matter within a team: the largest
color group on the pitch gets a skill boost, and the second-largest a smaller
one.

D119 adds matchups between colors. Each color is strong against two colors and
weak against the other two, so no color is better overall. Matchups count at
two levels:

- **Team level:** each team's dominant and second colors.
- **Between players:** where players face each other on the pitch, stronger
  matchups raise a team's influence in that area.

They stack with the chemistry boost. D138 leaves the cycle to Claude, to be
recorded here.

## Decisions

### 1. The cycle: each color beats the next two along the rainbow

Red → Yellow → Green → Blue → Purple → back to Red.

| Color | Strong against | Weak against |
| --- | --- | --- |
| Red | Yellow, Green | Blue, Purple |
| Yellow | Green, Blue | Purple, Red |
| Green | Blue, Purple | Red, Yellow |
| Blue | Purple, Red | Yellow, Green |
| Purple | Red, Yellow | Green, Blue |

It is easy to remember: go round the rainbow, and a color beats the next two
and loses to the two before it. Every color wins two matchups and loses two,
so the cycle is fully balanced. The same color against itself is even.

In code, `packages/core` gets `colorEdge(a, b, cycle)`, which returns +1, 0 or
−1 for any odd number of colors arranged in a ring. Soccer's ring is stored as
the color indexes in rainbow order. Baseball's 4 colors can't be balanced this
way and are settled when baseball is built (D119).

### 2. Team matchup

Each team's dominant color is its largest color group on the pitch, using the
same groups as chemistry: at least 2 players, and a tie means no single
dominant color. Each team's second color is the second-largest group.

- If one team's dominant color beats the other's, the winning team's skill is
  raised by **teamMatchup**. The proposed value is 4%.
- The same goes for the second colors, at **teamMatchupSecond**. The proposed
  value is 2%.

This works like the chemistry boost: it is added to each player's skill,
recalculated whenever a substitution changes who is on the pitch, and shown
on the match page.

### 3. Player matchups by area

The pitch has three areas, and in each one a side's attackers face the other
side's defenders:

- my attack against their defence
- midfield against midfield
- my defence against their attack

For each area, the engine weighs every pair of opposing players by how much
influence each has there: their template's share of that third, times their
skill. It then averages the pair's edge (+1, 0 or −1). The result runs from −1
(every matchup lost) to +1 (every matchup won). That team's influence in the
area is raised or lowered by **playerMatchup** times the result. The proposed
value is 6%.

So a striker beats their marker more often when the striker's color is strong
against the defender's. That shows on the heatmap as a stronger or weaker area.

### 4. Strengths are tuning values, off for old versions

`teamMatchup`, `teamMatchupSecond` and `playerMatchup` become match tuning
values. They are adjustable in Admin → Soccer balance, with limits and help
text like the other tuning values, and are tested there with the harness
before publishing (D149). They default to 0, and a stored version without
them plays with matchups off.

The cycle itself (which color beats which) is fixed in code for now. An
admin editor for it is planned in M12 (D149): admins can reorder the ring,
and the editor checks that every color still beats two and loses to two.

That keeps every season already under way, and every saved replay, exactly as
it was. Seasons play by the settings version they started with. Matchups start
with the first settings version published with the new values. Only new
seasons use that version.

### 5. Tuning with the harness

Matchups cancel out on average between random teams, so the targets should
hold: 2.5–2.8 goals per match and about 25% draws for even teams. The harness
gains a matchup report:

- win rate for a team whose dominant color beats the other team's
- goals and draws with matchups on and off

The proposed strengths are set so that winning the team matchup gives about
55–58% wins against an even team. Colors then matter, but don't outweigh
skill. The PR that builds this includes the harness report.

### 6. Shown to managers

- Wherever two clubs' colors are compared, each color is shown with what it
  beats and what it loses to: league clubs (D111), the season schedule (D139)
  and the matchday squad page.
- The game guide (D137) shows the cycle as a ring of five colors.
- Match reports say who won the team matchup ("Red beat Green").

## Order of work (M11)

| Step | PR | Risk |
| --- | --- | --- |
| 1 | This ADR | Docs |
| 2 | Engine: cycle, team and player matchups, tuning values (off by default), harness report | Engine; harness report in the PR |
| 3 | Out-of-position penalty (D135): −50% skill out of position; auto-pick, auto-subs and the AI avoid it | Balance; harness |
| 4 | Season schedule and chemistry on the squad page (D139), and matchups shown on club pages and match reports | UI |
| 5 | Game guide (D137) | UI and docs |
| 6 | Publish a settings version with the matchup strengths and the retuned values | Gary publishes it in admin |

## Needs Gary

- Done: Gary OK'd the cycle and the proposed strengths (Nov 5, 2026). The
  harness may still adjust the strengths in step 2, and its report goes in
  that PR.
- Step 6: publish the settings version with the matchup strengths in admin.

## Consequences

- Colors matter between teams as well as within one, so picking a squad
  around an opponent's colors pays off (D139's schedule shows them all season).
- Old seasons and replays are unaffected, because the strengths live in the
  settings version.
- The engine adds a color comparison per area each phase. That is cheap: 11 ×
  11 pairs, three times a phase.
