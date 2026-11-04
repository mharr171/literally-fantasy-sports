# LiterallyFantasySports — Project Roadmap

Nov 2, 2026 · @Gary · Last updated: Nov 4, 2026 (D121)

## Review progress

The roadmap review is complete: all 8 steps are agreed. New decisions are added to the decision log as they are made. **v1.0.0 is released (Nov 4, 2026). M7 (`v1.1.0`) and M8 (`v1.2.0`) are done. Now:** M9 AI world and 12-club seasons (`v1.3.0`). Gary's notes after playing v1 are recorded as D107–D121 and planned as M7–M11 in section 5.

- [x] **Step 1: Vision & goals** (agreed Nov 2, 2026)
- [x] **Step 2: Scope decisions** (agreed Nov 2, 2026)
- [x] **Step 3: Tech stack & architecture** (agreed Nov 2, 2026)
- [x] **Step 4: Match engine & data model** (agreed Nov 3, 2026)
- [x] **Step 5: Milestones** (agreed Nov 3, 2026)
- [x] **Step 6: Post-MVP backlog** (agreed Nov 3, 2026)
- [x] **Step 7: Engineering practices** (agreed Nov 3, 2026)
- [x] **Step 8: Risks & open questions** (agreed Nov 3, 2026)

Legend: `[x]` done or agreed · `[ ]` not started · `[~]` in progress or draft

## Decision log

| # | Date | Decision | Step |
| --- | --- | --- | --- |
| D1 | Nov 2, 2026 | Goal priority: real project > portfolio > friends | 1 |
| D2 | Nov 2, 2026 | No fixed dates; work at own pace. Build order is what matters | 1 |
| D3 | Nov 2, 2026 | Multi-sport framework. Planned sports: soccer, baseball, football, basketball, hockey, paintball (speedball, 5-player) | 1 |
| D4 | Nov 2, 2026 | v1 is soccer only; baseball is sport #2 | 1 |
| D5 | Nov 2, 2026 | One account manages at most one team per sport | 1 |
| D6 | Nov 2, 2026 | Progress in each sport can grant small bonuses that apply to every sport | 1 |
| D7 | Nov 2, 2026 | Every sport visualizes players with heatmaps; each sport sets its own grid size (soccer stays 17×25) | 1 |
| D8 | Nov 2, 2026 | Opponents are AI teams scaled to the player's Elo at season start, plus "ghost" teams saved from other players' finished seasons (replaced by the AI world, D113–D116) | 1 |
| D9 | Nov 2, 2026 | Admin panel to adjust game settings live; season length varies by sport and league size | 1 |
| D10 | Nov 2, 2026 | Generated player names are random but styled by nationality | 1 |
| D11 | Nov 2, 2026 | Brand: LiterallyFantasySports at www.literallyfantasysports.com, one section per sport (e.g. `/soccer`) | 1 |
| D12 | Nov 2, 2026 | GitHub for code, public repo (MIT) | 1 |
| D13 | Nov 2, 2026 | $0 hosting: Vercel Hobby + Supabase free tier. Any paid service needs an ADR | 1 |
| D14 | Nov 2, 2026 | Funds in v1: fixed amount per match played, plus bonuses for wins, playoff placement and championships | 2 |
| D15 | Nov 2, 2026 | Soccer roster: 30 max; matchday squad of 22 (11 starters + 11 subs) | 2 |
| D16 | Nov 2, 2026 | Soccer league: 8 teams, double round-robin (14 match weeks), then playoffs (now 12 clubs, D115, D117) | 2 |
| D17 | Nov 2, 2026 | 1 energy = 1 game week (your next scheduled match). Default 1 energy per 2 hours, max 3; adjustable in admin (refill changed by D93) | 2 |
| D18 | Nov 2, 2026 | Seasons mark in-game time (one in-game year). Roster and Elo carry over; nothing resets | 2 |
| D19 | Nov 2, 2026 | Per-sport leaderboard of saved season-end entries, ranked by Elo, then by that season's stats | 2 |
| D20 | Nov 2, 2026 | Sign-in: "Continue with Google" plus passwordless email magic link. No passwords to manage | 2 |
| D21 | Nov 2, 2026 | Admin is Gary only: an `is_admin` flag on his account, set by hand. Works from any computer by signing in; admin requires two-factor (TOTP), now on the back burner (D103) | 2 |
| D22 | Nov 2, 2026 | Desktop-first design, always mobile-friendly | 2 |
| D23 | Nov 2, 2026 | All code is written by AI (Claude Code). Gary directs, reviews and approves; he knows coding concepts but not this stack | 3 |
| D24 | Nov 2, 2026 | Domain is registered at Squarespace (formerly Google Domains); DNS records point to Vercel, and `literallyfantasysports.com` redirects to `www` | 3 |
| D25 | Nov 2, 2026 | Sign-in emails are sent through Resend (free tier) from the project's own domain | 3 |
| D26 | Nov 2, 2026 | Biome for linting and formatting | 3 |
| D27 | Nov 2, 2026 | Sentry (free) for error tracking and Vercel Web Analytics (free) for page views, both added in M6 before launch (skipped for now, D104) | 3 |
| D28 | Nov 2, 2026 | Two Supabase cloud projects: `lfs-prod` (live site) and `lfs-dev` (development and preview deploys). No Docker on Gary's PC. CI creates a throwaway database on each PR to test migrations | 3 |
| D29 | Nov 2, 2026 | All sports share one database (rows carry a `sport` column). A new sport is built on a Git branch as a new `packages/sport-*` folder, tested against `lfs-dev`; no extra Supabase project needed | 3 |
| D30 | Nov 3, 2026 | Playoffs: top 4 of 8, single-match ties; draws go to extra time, then penalties (now top 7 plus a play-in, D117) | 4 |
| D31 | Nov 3, 2026 | New teams start with 22 players; packs grow the roster toward 30 | 4 |
| D32 | Nov 3, 2026 | AI teams in a league are spread above and below the manager's Elo at season start (replaced by D113) | 4 |
| D33 | Nov 3, 2026 | At most 1 ghost per manager in a league. A manager's own ghost may appear in their own league under a disguised name (own ghost now excluded, D115) | 4 |
| D34 | Nov 3, 2026 | Players have several attributes per sport; an overall rating is calculated from them | 4 |
| D35 | Nov 3, 2026 | Players age at season end: young players grow toward potential, older players decline and eventually retire | 4 |
| D36 | Nov 3, 2026 | The bench matters: automatic substitutions for fatigue and injuries, plus other squad mechanics (see Step 4 questions) | 4 |
| D37 | Nov 3, 2026 | Chemistry: about n/3 colors per sport, where n = players on the field. Majority-color players get a gameday boost (originally 3 colors, +25%). Details pending | 4 |
| D38 | Nov 3, 2026 | Nationalities: as diverse as possible; weights set per sport in config | 4 |
| D39 | Nov 3, 2026 | Default payouts: 1,000 per match, +500 win, +200 draw, playoff and championship bonuses; basic pack 5,000. All adjustable in admin | 4 |
| D40 | Nov 3, 2026 | Elo works the same for every match: AI, ghost, regular season and playoffs | 4 |
| D41 | Nov 3, 2026 | Heatmap templates are designed from scratch with a visual template editor (admin tool) instead of being ported from the 2018 code | 4 |
| D42 | Nov 3, 2026 | Chemistry colors per sport = (n ÷ 3) + 1, minimum 3, where n = players on the field. Each player's color is permanent and random at creation | 4 |
| D43 | Nov 3, 2026 | Chemistry boost goes to the largest color group on the field at that moment (it changes with subs). A tie for largest gives each tied group a smaller boost (e.g. 25% alone, 15% tied). Sports with 4+ colors also give a minor boost to the second-largest group; ties cascade the same way (details pending) | 4 |
| D44 | Nov 3, 2026 | Chemistry boosts are flat percentages per rank, set per sport in the admin panel | 4 |
| D45 | Nov 3, 2026 | Squad mechanics in v1: match fitness across game weeks, in-match fatigue and auto-subs, injuries, sub plans, form, cards and suspensions, morale | 4 |
| D46 | Nov 3, 2026 | Youth intake every season: the team chooses which prospects to take. After that, packs are the only way to find players (packs act as scouting) | 4 |
| D47 | Nov 3, 2026 | Packs: 5 players each, tiers with published odds of player skill, plus position-focused packs | 4 |
| D48 | Nov 3, 2026 | Potential is shown as a rough range. Later, staff or facilities make the range more accurate | 4 |
| D49 | Nov 3, 2026 | Each player from a pack is either added to the roster or resold at a fixed "bulk" price. Players can be released for free; sales and trades may come later | 4 |
| D50 | Nov 3, 2026 | No wages or contracts in v1 | 4 |
| D51 | Nov 3, 2026 | Color count rounds to the nearest whole number, minimum 3 (soccer = 5). Replaces the rounding in D42 | 4 |
| D52 | Nov 3, 2026 | Chemistry ranking: a tie for first uses up first and second place (no second-place boost). Groups tied for second share a split second-place boost | 4 |
| D53 | Nov 3, 2026 | Youth intake offers 2n rookies (n = players on the field; 22 for soccer). Any number can be taken for free | 4 |
| D54 | Nov 3, 2026 | The roster may go over 30 temporarily (rookies, packs), but the next match is blocked until it is back to 30 or fewer. In v1 the only way down is free release or bulk resale | 4 |
| D55 | Nov 3, 2026 | Every player has a calculated worth. Bulk resale pays a percentage of worth, set in admin and kept below what sales or trades would pay later | 4 |
| D56 | Nov 3, 2026 | Milestone order: M0 Foundations, M1 Match engine, M2 Players and squads, M3 Seasons, M4 Energy and continuity, M5 Admin and visualization, M6 Polish and launch | 5 |
| D57 | Nov 3, 2026 | Friends alpha after M3 | 5 |
| D58 | Nov 3, 2026 | Each milestone is tagged as a version: `v0.1` (M0) to `v0.6` (M5), then `v1.0.0` | 5 |
| D59 | Nov 3, 2026 | Ghost snapshots record the game version and the date the season was completed. M0 starts with a setup guide for Gary | 5 |
| D60 | Nov 3, 2026 | Backlog order as listed in section 6, starting with baseball, then cross-sport bonuses | 6 |
| D61 | Nov 3, 2026 | Energy is separate for each sport and is not affected by cross-sport bonuses. Cross-sport bonuses raise the ratings of rookies offered at youth intake | 6 |
| D62 | Nov 3, 2026 | Sport order after baseball: paintball, football, basketball, hockey. Replaces the "order to be decided" in D3 | 6 |
| D63 | Nov 3, 2026 | Private leagues removed from the backlog | 6 |
| D64 | Nov 3, 2026 | Added to the backlog: season history, hall of fame, retirement tributes | 6 |
| D65 | Nov 3, 2026 | Working principle: Claude Code does as much as possible, then gives Gary step-by-step instructions for what only he can do | 7 |
| D66 | Nov 3, 2026 | A `CLAUDE.md` rules file in the repo for every Claude Code session | 7 |
| D67 | Nov 3, 2026 | PR review by plain-English summary, test results and preview link, after a Claude Code self-review | 7 |
| D68 | Nov 3, 2026 | Claude Code merges low-risk PRs on green CI; high-risk PRs (migrations, auth, security rules, balance defaults) wait for Gary | 7 |
| D69 | Nov 3, 2026 | Protected `main` (no direct pushes, green CI required). Production database changes need Gary's one-click approval | 7 |
| D70 | Nov 3, 2026 | Nightly backups of `lfs-prod` to a private GitHub repo (`lfs-backups`) | 7 |
| D71 | Nov 3, 2026 | release-please for changelog and tags, plus a player-facing "What's new" message for each release, posted on GitHub and in-game | 7 |
| D72 | Nov 3, 2026 | Confirmed: each sport has its own energy | 8 |
| D73 | Nov 3, 2026 | Deferred on purpose: player worth formula and resale percentage (M2); cross-sport bonus size and cap (when built) | 8 |
| D74 | Nov 3, 2026 | Simple privacy policy and terms of service, published at `/privacy-policy` and `/terms-of-service` (required for Google sign-in), linked from the footer and sign-in page. Source files in `docs/legal/` | M0 |
| D75 | Nov 3, 2026 | One project email address: `admin@literallyfantasysports.com`, forwarded by Squarespace to Gary's personal inbox; replies sent from Gmail through Resend. Used as the contact address in the privacy policy and terms | M0 |
| D76 | Nov 4, 2026 | Release tags use full semantic versions: `v0.1.0` (M0) … `v0.6.0` (M5), then `v1.0.0`. release-please creates them when Gary merges its release PR at the end of each milestone. Refines D58 | M0 |
| D77 | Nov 4, 2026 | Soccer positions: GK; CB, LB, RB; DM, CM, AM, LM, RM; LW, RW, ST (12 positions: wide midfielders and wingers are separate) | M1 |
| D78 | Nov 4, 2026 | Soccer attributes, each 1–99: pace, passing, shooting, defending, physical, stamina, plus goalkeeping (GK only). Overall is a position-weighted average, tuned in admin | M1 |
| D79 | Nov 4, 2026 | A chemistry colour group needs at least 2 players on the field to earn any boost; smaller groups don't rank. Refines D43/D52 | M1 |
| D80 | Nov 4, 2026 | No home advantage for now: every match is played as if on neutral ground. Can be added later as a tuning value | M1 |
| D81 | Nov 4, 2026 | Soccer match-day squad rules: up to 5 subs in up to 3 stoppages; the manager's sub plan runs first, then automatic subs for injuries and for tiredness (from 55'); red cards are never replaced; if the keeper goes with no subs left, the best outfield keeper moves in goal. Starting rates tuned with the harness (≈3.6 yellows, 0.13 reds, 0.33 injuries and 8 subs per match) | M1 |
| D82 | Nov 4, 2026 | Template variants: admins can paint several influence templates per position (e.g. an attacking and a defensive full-back) and tick which ones are available to use. Planned for M5; how a variant is chosen in a match is still open (see Step 8) | M1 |
| D83 | Nov 4, 2026 | New teams start with an empty roster and 22 free starter packs: 2 attacker, 4 midfielder, 4 defender, 1 goalkeeper and 11 all-position packs (5 players each). All 22 must be opened before the first match (the team's initial scouting). Players not kept are released for free, with no resale money. Keep 22–30 to play. Replaces D31 | M2 |
| D84 | Nov 4, 2026 | Each player is given one of the available template variants for their position when generated, and keeps it. Answers D82's open question | M2 |
| D85 | Nov 4, 2026 | Player worth = 1,000 × 1.08^(overall − 50) × age factor (×1.2 to 21, ×1.0 to 29, ×0.8 to 31, ×0.6 after) × (1 + 4% per point the shown potential midpoint is above the overall), rounded to 50. Uses the shown range, never the hidden potential. Bulk resale pays 25% of worth. Resolves D73's first item | M2 |
| D86 | Nov 4, 2026 | Initial scouting: a manager opens starter packs (one at a time or all at once), then picks their 22–30 from every opened player together, not pack by pack. Pack seeds are hidden from managers, since a seed reveals true potential | M2 |
| D87 | Nov 4, 2026 | Bought packs (proposed defaults, Gary approves): Basic 5,000 (overall 40–49 25%, 50–59 50%, 60–69 20%, 70–79 5%), Silver 12,000 (50–59 35%, 60–69 45%, 70–79 17%, 80–89 3%), Gold 30,000 (60–69 40%, 70–79 45%, 80–89 13%, 90–99 2%). Position-focused packs cost 20% more. A bought pack opens at once and must be sorted (keep or bulk-sell each player) before buying another. New teams start with 10,000 funds. Release and resale stop at 22 players; starter-pack players can be released but not sold | M2 |
| D88 | Nov 4, 2026 | Matchday squad: the manager picks a formation preset (4-4-2, 4-3-3, 4-2-3-1, 4-1-4-1, 3-5-2, 5-3-2), drags 11 starters into its slots and 11 substitutes onto the bench, and can plan up to 5 subs in up to 3 different minutes. One saved squad per team; it must be fixed if a picked player leaves. Formations only set positions; tactics and mentality stay in the backlog | M2 |
| D89 | Nov 4, 2026 | Season defaults (proposed, Gary approves): playoff bonuses 2,000 for reaching the playoffs, +3,000 for reaching the final, +5,000 for winning it (a champion earns 10,000 in bonuses on top of match pay). The 7 AI opponents' ratings are spread evenly from 300 below to 300 above the manager's Elo at season start. An AI team's starters average overall 55 at Elo 1500, +1 per 20 Elo (1700 → 65, 1300 → 45), substitutes 4 lower. League tables rank by points (3/1/0), goal difference, goals scored, then wins (AI spread and ratings replaced by D113; playoff bonuses to be reset for 8 clubs, D117) | M3 |
| D90 | Nov 4, 2026 | Playing a season (M3): a "Play week" button plays the manager's match with their saved matchday squad and the rest of the league's matches at once; energy starts gating it in M4. AI clubs never share a place name. A season's seed (which decides every match) is hidden from managers. The next season opens once season-end processing (ageing, retirement, youth intake) exists | M3 |
| D91 | Nov 4, 2026 | Season end (proposed defaults, Gary approves): players up to 27 close 25–60% of the gap to their true potential each year (at least 1 point while below it, never past it); 28–30 move −1 to +1; from 31 they lose 1–3 a year (31–32), 2–4 (33–34), then 3–6. Retirement chance at the new age: 33 10%, 34 20%, 35 40%, 36 60%, 37+ 85%. Youth intake: 22 prospects aged 16–18, overall around 45 (35–58), always including 2 keepers. Worth is recalculated after ageing. The manager ends the season, sees who improved, declined and retired, answers the intake, then starts the next season | M3 |
| D92 | Nov 4, 2026 | Ghosts and leaderboard (proposed defaults, Gary approves): ending a season freezes the team as it finished (roster, matchday squad, Elo, league record, playoff result, game version, date) before ageing. A new league takes up to 4 ghosts within 300 Elo of the manager, the latest snapshot of each team and at most one per team, each in the AI place nearest its Elo; AI clubs fill the rest. The manager's own ghost can appear under a made-up name. If a ghost's team is deleted, its place plays on as an AI club. The leaderboard lists every finished season by Elo, then points, goal difference and goals; rosters stay private (rosters now visible, D111; ghost rules changed by D115, D116) | M3 |
| D93 | Nov 4, 2026 | Energy (Gary): 1 point back every 15 minutes, up to 3 (replaces D17's 1 per 2 hours). Admins can switch the energy requirement off server-wide for each sport, and change the refill time and maximum, on the Game settings page; changes apply at once, without a new settings version. Every played week costs 1 energy, including playoff rounds the manager isn't in (maximum raised to 6, D118) | M4 |
| D94 | Nov 4, 2026 | Player condition between game weeks (proposed defaults, Gary approves): match fitness carries over and recovers 20 a week, up to 100 (a full match costs about 25, so an unrotated 11 starts week 8 at about 71). Injuries count down one game week at a time. A red card bans the player for 1 match; every 5th yellow card in a season bans them for 1 match. Unavailable players are swapped out automatically for the best fit player (bench first, then the rest of the roster), and the Season page says who. Each new season starts fit with no bans or cards; injuries carry over | M4 |
| D95 | Nov 4, 2026 | Admin testing tools (Gary): admins can refill a team's energy, add funds, heal its squad, play weeks ahead without energy, or delete a team so its manager starts over. Every use is written to an admin action log that admins can read | M4 |
| D96 | Nov 4, 2026 | Form and morale (proposed defaults, Gary approves): each player gets a simple 1–10 match rating (6 base, +1 a goal, +0.5 win / −0.5 loss, −0.5 a yellow, −2 a red; cameos under 30 minutes count half). Form (−1 to 1) keeps 60% of its old value and takes 40% from the latest rating, and fades by 20% a week when the player doesn't play. Team morale (−1 to 1) keeps 70% and adds +0.3 for a win or −0.3 for a loss. In matches, form changes a player's skill by up to ±5% and morale by up to ±3% (±8% at most): an even team at +8% wins about 43% instead of 36% | M4 |
| D97 | Nov 4, 2026 | Auto-pick (Gary): never picks an injured or suspended player over an available one, and weighs fitness and form the way matches do, so fresher, in-form players get the nod when ratings are close. Unavailable players only fill places nobody else can, so the squad can still be saved (they're swapped out at kickoff) | M4 |
| D98 | Nov 4, 2026 | Template variants in practice (D82, D84): in the template editor each position has its default template plus up to 8 named variants (lowercase names, e.g. "poacher"), each with a "new players can be given this" tick; variants are saved and published with the settings version like templates. New players (packs, starter packs, youth intake) get one ticked template at random and keep it. A player uses their variant only at their primary position, the slot's default elsewhere, and the default if their variant no longer exists. Ghosts keep their players' variants | M5 |
| D99 | Nov 4, 2026 | Seeing colours and heatmaps (Gary): every player name in the roster, scouting, opened packs and youth intake opens a player card (hover with a mouse, tap on touch screens) with their chemistry colour as a swatch, name and letter (for colour-blind players), their heatmap at their primary position (their variant if they have one), and their numbers and attributes. In the squad builder, hovering or tapping a pitch slot shows that player's heatmap there, a Team coverage toggle shades the starting 11's combined influence (weighted by rating), and tapping a player shows their card under the pitch | M5 |
| D100 | Nov 4, 2026 | Vercel deploys stay within Hobby's 100 a day (D13): the release-please branch never deploys (its PR is checked by CI, and merging it deploys `main`), and any push that changes nothing the site is built from (`apps/web`, `packages/`, `docs/legal/`, `CHANGELOG.md`, root package and lockfiles) skips its build. Upgrading to Pro waits until the limit gets in the way again | M5 |
| D101 | Nov 4, 2026 | Match pages (M5): every played fixture has a page (from the score in Results, or "Heatmap, play-by-play and replay" under the last match). The server plays the match again from its seed with the season's settings version, so nothing but the inputs is stored: AI clubs come from the season seed, ghosts from their snapshot, and the manager's team as it played (lineup, bench, sub plan, fitness, form and morale) is kept with the result (`fixtures.manager_team`). The page shows the score, possession, chances and shots on target, a pitch heatmap (both teams, home blue and away red, or one team), the full play-by-play, and a replay that plays it back minute by minute. Matches played before this, or whose ghost has since been deleted, show their summary only. The seed never leaves the server | M5 |
| D102 | Nov 4, 2026 | Balance without a deploy (M5): Admin > Balance edits match tuning, season payouts and pack prices (per tier, and the position-focus surcharge) in the numbered settings versions, with the same save draft, test (1,500 matches against live) and publish steps as templates. Every value has limits (e.g. chance rate 0.05–0.95, payouts 0–100,000, pricier tiers must cost more). A season plays and pays by the version it started with, so replays stay exact; pack prices follow the live version straight away. Pack odds stay fixed for now | M5 |
| D103 | Nov 4, 2026 | Admin two-factor sign-in goes on the back burner (Gary): this is mainly a personal project, not run for the public, so the admin flag plus Google or email sign-in is enough for now. A finished version (authenticator app, `is_admin()` requiring `aal2`) was built and closed unmerged in #47, ready to pick up again if the game opens to other players. M5 is done without it | M5 |
| D104 | Nov 4, 2026 | Sentry error tracking and Vercel Web Analytics are skipped for now (Gary): with a personal project and a handful of players, Vercel's own logs and a message from a friend are enough. Either can be added later without other changes (D27) | M6 |
| D105 | Nov 4, 2026 | M3 and M6 are done (Gary): onboarding checklist, error and empty pages, What's new and the README are in, so v1.0.0 can ship. Inviting friends (M3's alpha, M6's "a friend can sign up and play without help") is welcome but no longer a gate, since this is mainly a personal project. Next is the post-MVP backlog (section 6) | M6 |
| D106 | Nov 4, 2026 | The end of M6 ships as `v1.0.0` (D76): release-please only bumps the minor version below 1.0, so the commit that closes M6 carries a `Release-As: 1.0.0` footer. After that, features bump the minor version and fixes the patch as usual | M6 |
| D107 | Nov 4, 2026 | Club colors (Gary): when naming a club, the manager picks 2–3 club colors, used across the UI to make each club feel personal. Display only, completely separate from chemistry colors. Can be changed later from the team page (proposed) | M7 |
| D108 | Nov 4, 2026 | Scouting table (Gary): all selectable players from every opened pack (starter or bought, one or many) appear in one table with filters and sorting by primary and secondary position, chemistry color, age, overall and potential floor and ceiling (the shown range, never the hidden value). Chemistry colors are always shown | M7 |
| D109 | Nov 4, 2026 | Roster (Gary): the roster table is sortable and marks who is in the current matchday squad, as a starter or on the bench | M7 |
| D110 | Nov 4, 2026 | Squad builder (Gary): a "Rotated squad" button picks a fresh 22 (auto-pick from D97, weighted much more toward fitness, resting tired starters), and a total squad score is shown for the current selection | M7 |
| D111 | Nov 4, 2026 | Viewing other clubs (Gary): any club in your league can be clicked to see its roster, score and chemistry colors as percentages. Rosters are visible everywhere, including leaderboard entries and ghosts (players are generated, so no personal data). The privacy policy gains a line saying rosters and lineups are visible to other players. Replaces D92's private rosters | M7 |
| D112 | Nov 4, 2026 | Heatmaps (Gary): Claude Code generates 3 starting variants for each of the 12 positions, which Gary then adjusts in the template editor. When a formation has two players in the same position (ST, AM, CM, DM, CB), its slots are marked left and right (e.g. LCB and RCB) and each player uses a left or right version of their heatmap. The player card still shows the base position (CB). Three in one position (e.g. 3 CB) use left, default and right (proposed) | M8 |
| D113 | Nov 4, 2026 | AI world (Gary): a persistent pool of AI clubs (250 to start, adjustable in admin) replaces AI teams generated to match each manager's Elo (D8, D32, D89's AI spread). AI clubs run like real teams: ageing, retirement, youth intake, packs, releases and squad picks, through an AI manager module with varied personalities. To anyone but admins they are indistinguishable from real clubs: names, club colors, manager display names, leaderboard entries. Their Elo changes only through their own results | M9 |
| D114 | Nov 4, 2026 | AI pace (Gary): scheduled GitHub Actions runs several times a day; in each run every AI club has a chance to spend some or all of its energy. Roughly human speed, some slower and some faster: activity profiles default to about 0.5, 1 and 2 seasons a day (proposed defaults, adjustable in admin) | M9 |
| D115 | Nov 4, 2026 | Leagues (Gary): 12 clubs, the manager plus the 11 clubs nearest their Elo at season start. AI clubs are cloned as they are at that moment; real players take part through their best ghost (D116). A manager's own ghost never appears in their league (replaces D33). Opponents are frozen clones for the whole season: later changes to the real clubs (roster, Elo) never affect it. Replaces D16's 8 teams | M9 |
| D116 | Nov 4, 2026 | Ghosts (Gary): each real player has one ghost per sport, from their best season by Elo. At season end it is replaced only if the club's Elo is now higher than the ghost's. Frozen as the team finished, before ageing (as D92) | M9 |
| D117 | Nov 4, 2026 | Season shape (Gary): 22 weeks of double round-robin, then a play-in week where 8th plays 9th, then an 8-club bracket (quarterfinals, semifinals, final): 26 weeks in all. The play-in week costs no energy for clubs that finish 7th or higher; they skip it and get two weeks of recovery before the quarterfinals. Fixed bracket: 1 v play-in winner, 2 v 7, 3 v 6, 4 v 5 (proposed). Playoff bonuses (D89) are reset for the 8-club bracket (proposed values to come). Replaces D30's top 4 | M9 |
| D118 | Nov 4, 2026 | Energy maximum raised to 6 (Gary); refill stays 1 point every 15 minutes (D93) | M7 |
| D119 | Nov 4, 2026 | Color matchups (Gary): each chemistry color is strong against some colors and weak against others, all balanced (soccer's 5 colors: each beats 2 and loses to 2). Matchups count at team level (each team's dominant and second colors) and between individual players on the field: stronger individual matchups raise a team's influence in that area of the pitch. Stacks with the chemistry boost; strengths are tuning values in admin, set with the harness. Baseball's 4 colors can't be fully balanced and are settled when baseball is built | M10 |
| D120 | Nov 4, 2026 | Data kept (Gary), to stay within Supabase's free 500 MB and keep backups small. Forever: a one-line record per club per season (place, W/D/L, goals, Elo before and after, playoff result), one leaderboard row per season (split from the ghost snapshot), each real player's best ghost, and a career record for every retired player (seasons, appearances, goals, best overall, clubs). Current and previous season: the manager's own fixtures in full with replays; scores only for the rest of the league. Older seasons keep each match's summary (score, possession, shots, goals, cards, injuries) but no replay. Deleted when done: league clones once their season's replays go, pack rows once sorted. AI clubs never store replay details (admins can compute one on demand). Nightly backups cover only the permanent records and real players' data | M9 |
| D121 | Nov 4, 2026 | Season history and hall of fame (Gary) move from the backlog (#10–#12) into M11: a page per past season, a hall of fame both global and per club (a club's all-time greats), and retirement tributes, all built on D120's permanent records | M11 |
| D122 | Nov 4, 2026 | How D112 works: a left or right slot uses its player's template moved 3 columns (of 17) towards that touchline, with each row keeping its total. Only the heatmap moves, so match results and replays are unchanged. Of two slots in one position the leftmost is left and the rightmost right; a middle third (e.g. the middle CB of three) keeps the template as painted. The 36 generated variants are added from the template editor ("Add generated variants"), which ticks them for new players in place of the default; they reach players once Gary saves and publishes the version | M8 |

## 1. Vision & goals

LiterallyFantasySports is a browser-based sports management platform. You collect generated players, set lineups, and play seasons in leagues of AI clubs and the saved teams of other managers. It starts with soccer and is built as a framework that later sports plug into.

It is a spiritual successor to LiterallyFantasySports (Rails 5, 2018). It keeps that game's best ideas (positional heatmaps, chemistry colors, Elo, energy-gated matches) and fixes its main weakness: logic in hand-written, unrolled code in one 2,000-line controller.

**Goals, in priority order**

1. **Run like a real project:** milestones, issues, PRs and decision records, even with a team of one.
2. **Portfolio piece:** clean architecture, a tested simulation engine, CI, docs and a polished public demo.
3. **Fun with friends:** a game you and friends actually play.

**Pace:** solo, at your own pace, with no fixed dates. Durations below are effort estimates (at about 8 hrs/week) used only to size work. The order of development is what matters.

**Sports roadmap**

| Order | Sport | Notes |
| --- | --- | --- |
| 1 (v1) | Soccer | 11 players, continuous possession phases, 17×25 grid |
| 2 | Baseball | 9 + batting order + pitchers, turn-based at-bats; hardest test of the framework |
| 3–6 | Paintball, football, basketball, hockey | In that order. Paintball = speedball, 5-player, tournament formats vary |

## 2. Scope decisions

*[x] Agreed in Step 2 (D14–D22).*

v1 is a soccer web app with async play. You play seasons against a league of AI teams and ghost teams. There is no real-time multiplayer.

| Decision | Choice | Why |
| --- | --- | --- |
| Platform | Web app, desktop-first, always mobile-friendly | Fastest to ship, easy to share a link |
| Sign-in | Google or email magic link (Supabase Auth) | Least intrusive: no passwords |
| Competition | Seasons vs AI teams (scaled to your Elo) and ghost teams (saved from finished seasons); from M9, a persistent world of AI clubs (D113) | No scheduling or presence problems |
| Stack | TypeScript full-stack | One language, strong portfolio signal |
| Sim engine | Shared core + one module per sport; seeded and deterministic | Sports plug in; replays come free |
| Budget | $0 beyond the domain | Vercel Hobby + Supabase free tier |

**In the MVP**

- **Core loop:** generated players, a roster of up to 30, buy packs, a 22-player matchday squad (11 starters + 11 subs) in a lineup builder, sim matches, Elo.
- **Funds (light economy):** a fixed payment per match played, plus bonuses for wins, playoff placement and championships. Funds buy packs.
- **Seasons:** each season is one in-game year. An 8-team league of AI and ghost opponents, double round-robin (14 match weeks), then playoffs. Roster and Elo carry over between seasons. Season end saves standings, a leaderboard entry and a ghost snapshot of your team.
- **Energy:** 1 energy plays your next scheduled match (one game week). Default refill is 1 energy every 2 hours, max 3.
- **Leaderboard:** per sport, built from saved season-end entries, ranked by Elo, then by that season's stats.
- **Match visualization:** influence heatmaps on a pitch plus a play-by-play log.
- **Admin panel (Gary only; two-factor on the back burner, D103):** adjust game settings (energy, payouts, league size, sim weights) without a deploy.

**Not in v1 (moved to the backlog):** other sports, cross-sport bonuses, the full economy (attendance, ticket and pack pricing), staff, facilities, training, sales and trades, real-time PvP, a native mobile app, monetization.

## 3. Tech stack & architecture

*[x] Agreed in Step 3 (D23–D29).*

The project is a pnpm + Turborepo monorepo. The engine is pure TypeScript with no database or framework code, so it can be tested on its own, run in the browser for previews, and run on the server for official results.

| Layer | Choice | Notes |
| --- | --- | --- |
| Code host | GitHub (public, MIT) | Actions CI, Projects board, issues |
| Web app | Next.js (App Router), React, Tailwind, shadcn/ui | Server actions for game commands |
| Database + auth | Supabase (Postgres, Auth, row-level security) | Free tier: `lfs-prod` + `lfs-dev`; migrations kept in the repo |
| ORM | Drizzle | Typed schema, SQL-first migrations |
| Validation | Zod | Shared between forms and server actions |
| Engine | `packages/core` + `packages/sport-*` | Seeded RNG, no I/O |
| Visuals | SVG/Canvas, hand-rolled | Heatmap overlay per sport's field shape |
| Hosting | Vercel Hobby (app) + Supabase (data) | Preview deploy for every PR; www.literallyfantasysports.com |
| Domain + DNS | Squarespace Domains | Records for Vercel (site) and Resend (email) |
| Auth email | Resend (free tier) | Sends magic-link emails from the project's domain |
| Lint + format | Biome | One tool, fast, little config |
| Monitoring | Sentry + Vercel Web Analytics (free) | Skipped for now (D104) |
| Builder | Claude Code | AI writes the code; Gary reviews and approves PRs |
| Scheduled work | Computed lazily from timestamps | Plus a daily GitHub Actions ping so the free Supabase project is not paused |

**Repo layout**

- `apps/web`: Next.js app (UI, server actions, auth, admin panel)
- `packages/core`: sport-agnostic engine: seeded RNG, Elo, seasons and fixtures, energy, player generation from config, name pools by nationality, the `Sport` interface
- `packages/sport-soccer`: positions, lineup rules, 17×25 influence templates, match sim, event types
- `packages/db`: Drizzle schema, migrations, seed script
- `packages/config`: shared tsconfig and lint config
- `docs/`: architecture notes and decision records (ADRs)

**The rules that keep this clean**

- **Game rules live in the engine packages.** The web app only loads data, calls the engine, and saves results.
- **`packages/core` never imports a sport.** Each sport implements the `Sport` interface: its grid size, lineup structure (units, lines, batting order), match loop and tiebreak rules. Core does not assume possession phases, 11 players, one lineup, or that draws exist.
- **Abstract from real cases.** Build soccer cleanly; extract shared code into core when baseball proves it is shared.

**Environments**

| Environment | Code | Database | URL |
| --- | --- | --- | --- |
| Production | `main` branch | `lfs-prod` | www.literallyfantasysports.com |
| Preview | Every PR branch | `lfs-dev` | Vercel preview URL per PR |
| CI | Every PR | Throwaway Supabase in GitHub Actions | none |

A new sport (for example baseball) is developed on a branch, adds `packages/sport-baseball` plus any migrations, and uses `lfs-dev` like any other feature. The `lfs-dev` data can be wiped and re-seeded at any time.

## 4. Match engine design

*[x] Agreed in Step 4 (D30–D55).*

Each sport exports `simulate(participants, seed)`, which returns a result, an event list, and influence maps for the heatmap view. Because the same inputs and seed always give the same match, the app stores only the inputs and the seed, and a replay just runs the match again.

**How a soccer match is simulated**

1. **Effective skill:** each player on the field has several attributes. His rating is boosted when he plays his primary position (+25%) or secondary position (+10%). Chemistry is described below. Form, match fitness and morale also adjust effective skill. These values live in config and can be changed from the admin panel.
2. **Influence map:** each position has a 17×25 template grid, drawn in the template editor. The team map is the sum of every on-field player's template multiplied by his effective skill.
3. **Fatigue and the bench:** players tire during a match based on stamina and the match fitness they started with. The engine substitutes automatically for fatigue, injuries and red cards, following the manager's sub plan when one is set. Subs change the influence map and can change chemistry. Fitness, injuries, cards and form carry into later game weeks.

**Chemistry rules**

Colors per sport = (n ÷ 3) + 1, rounded to the nearest whole number, minimum 3 (n = players on the field). Each player's color is permanent and random.

| Sport | On field | Colors |
| --- | --- | --- |
| Soccer, football | 11 | 5 |
| Baseball | 9 | 4 |
| Hockey | 6 | 3 |
| Basketball, paintball | 5 | 3 |

Color groups on the field are ranked by size, recalculated whenever a sub changes the lineup. Boosts are flat percentages set per sport in admin (defaults shown):

| Situation | Boost |
| --- | --- |
| Largest group, alone | +25% |
| Tied for largest | +15% each; no second-place boost is given |
| Second-largest, alone (4+ colors only) | +10% |
| Tied for second (4+ colors only) | Split second-place boost (default +5% each) |

Examples (soccer): 5/3/2/1 → +25% and +10%. 4/4/2/1 → both 4s get +15%, the 2 gets nothing. 5/2/2/2 → +25%, and each 2 gets +5%. A group needs at least 2 players to earn a boost (D79): 10/1 → +25% only.

**Squad and recruitment rules (v1)**

- **Roster:** up to 30; a 22-player matchday squad (11 + 11 bench). New teams start empty and scout their first squad from 22 free starter packs (D83).
- **Youth intake:** each season, 2n rookies are offered (22 for soccer). Take as many as you like, free.
- **Packs:** 5 players each, in tiers with published skill odds, plus position-focused packs. Each player is kept or bulk-resold.
- **Roster limit:** the roster may go over 30 temporarily, but the next match is blocked until it is back to 30 or fewer.
- **Worth:** every player has a calculated worth (from overall, potential and age). Bulk resale pays a percentage of it, set in admin.
- **Potential:** shown as a rough range.
- **Release:** free. No wages, contracts, sales or trades in v1.
- **Between game weeks:** match fitness recovers, injuries and suspensions count down, form and morale update.
4. **Phases:** the match runs as about 30 possession phases. In each one, compare the attacking team's influence in the final third with the defending team's influence there. That sets the odds of a chance, then a shot, then a goal (weighed against the keeper).
5. **Randomness:** a seeded PRNG (for example mulberry32) produces every random roll, so upsets happen but can be replayed exactly.
6. **Output:** final score, events (minute, type, zone, players involved, substitutions, injuries) and both influence maps.

**Config versions and replays:** templates and tuning values can change from the admin panel, so every match records the config version it used. A replay loads that version, which keeps old replays exact after retuning.

**Template editor (admin tool):** a page where Gary paints each position's influence grid on the sport's field (17×25 for soccer). Each sport supplies its own field shape and grid size. Saving creates a new config version; a preview runs sample matches with the draft templates before they go live.

**Tuning harness:** a script that simulates 10,000+ matches and reports goals per match, the share of draws, and win rate by skill gap. Targets: about 2.5–2.8 goals per match and roughly 25% draws.

**Opponents and seasons**

- At season start, a league is built around your team: ghost teams from other managers' finished seasons, filled out with AI teams whose strength scales to your Elo at that moment.
- When you finish a season, your roster, lineup and Elo are frozen into a ghost snapshot that can appear in other managers' leagues.
- **From M9 (D113–D117):** a persistent world of 250 AI clubs plays its own seasons at human-like pace. A league is you plus frozen clones of the 11 clubs nearest your Elo (AI clubs as they are, real players as their best ghost, never your own). 22 weeks, a play-in (8th v 9th) and an 8-club bracket.

**Core data model (draft)**

| Table | Key fields |
| --- | --- |
| profiles | user\_id, display\_name, is\_admin |
| teams | owner, sport (unique per owner), name, elo, funds, energy, energy\_updated\_at |
| players | team\_id, sport, name, nationality, age, attributes (jsonb), overall, worth, potential (true value, hidden) + shown range, primary\_pos, secondary\_pos, chemistry color, fitness, form, morale, injury / suspension weeks |
| packs | team\_id, sport, tier, position focus, seed, opened\_at, choices (keep or resell per player) |
| youth\_intakes | team\_id, season\_id, prospects (jsonb), picks |
| lineups | team\_id, sport, slots (jsonb) |
| seasons | team\_id, sport, number, league\_size, start\_elo, status |
| season\_opponents | season\_id, kind (ai or ghost), snapshot\_id or generated roster, elo |
| fixtures | season\_id, week, opponent, match\_id |
| matches | sport, seed, input snapshot (jsonb), result, elo change |
| team\_snapshots | team\_id, sport, season\_id, roster + lineup (jsonb), elo, season stats (jsonb), game\_version, completed\_at. Serves as both ghost team and leaderboard entry |
| game\_config | sport (or global), version, key, value (jsonb); edited in the admin panel. Includes position templates |

Name pools are static data in the engine packages. Position templates and tuning values are stored as versioned config (edited in the admin panel) and passed into the engine, which stays free of database code. Each match stores its config version.

## 5. Milestones

*[x] Agreed in Step 5 (D56–D59). Durations are effort estimates, not dates.*

The engine (M1) comes before any game UI because everything else depends on it. Mechanics that need game weeks (match fitness, suspensions, form, morale) come after seasons exist. Each milestone ends with a version tag and a working deploy.

- [x] **M0 Foundations (~2 wks) → `v0.1`:** *Released as `v0.1.0` on Nov 4, 2026.* setup guide for Gary (Vercel, Supabase, Resend, Sentry accounts; Squarespace DNS; Claude Code access; private `lfs-backups` repo), `CLAUDE.md`, branch protection, nightly backups, release-please, monorepo, Next.js, Supabase auth (Google + magic link), privacy policy and terms of service pages, `lfs-prod` + `lfs-dev`, CI, preview deploys, domain connected, keep-alive ping. *Done when:* you can sign in at www.literallyfantasysports.com, the privacy policy and terms pages are live, and CI is green.
- [x] **M1 Match engine (~4 wks) → `v0.2`:** `packages/core` (RNG, Elo, `Sport` interface, config types), `packages/sport-soccer` (attributes, effective skill, chemistry, influence maps, possession phases, in-match fatigue, auto-subs, in-match injuries and cards), name pools by nationality, versioned `game_config` table, template editor (admin-only page; the admin flag is added here), tuning harness, ADR for the sport interface. *Done when:* the sim is deterministic, harness metrics are on target, and engine coverage is about 90%.
- [x] **M2 Players and squads (~4 wks) → `v0.3`:** player generation with worth (each player keeps a template variant, D84), team creation with 22 starter packs to scout the first squad (one team per sport per account, D83), tiered and position-focused packs (keep or bulk-resell), free release, drag-and-drop matchday squad builder with sub plan. *Done when:* a new user opens their 22 starter packs, keeps 22–30 players, opens a pack, and saves a valid matchday 22.
- [x] **M3 Seasons (~3 wks) → `v0.4`, friends alpha:** *Released as `v0.4.0`; the friends alpha is optional for a personal project (D105).* league building from AI and ghost teams, double round-robin fixtures, top-4 playoffs, Elo, payouts, standings, season end (aging, retirement, youth intake, roster limit check), ghost snapshot (tagged with game version and completion date) and leaderboard entry. *Done when:* a full season including playoffs can be played, the roster carries into the next season, its ghost appears in another league, and a few friends are invited to the alpha.
- [x] **M4 Energy and continuity (~3 wks) → `v0.5`:** energy refill, match fitness carried between game weeks, injury and suspension countdowns, form, morale. Includes fixes from alpha feedback. *Done when:* rotating the squad visibly matters over a season.
- [x] **M5 Admin and visualization (~4 wks) → `v0.6`:** *Released as `v0.6.0` on Nov 4, 2026.* full admin panel (two-factor sign-in on the back burner, D103), template variants (several templates per position, with checkboxes for which are available, D82), pitch heatmaps on result pages, play-by-play log, replay from the seed and stored config version. *Done when:* an admin changes a setting without a deploy, and every result page shows the replay.
- [x] **M6 Polish and launch (~2 wks) → `v1.0.0`:** onboarding, empty and error states, in-game "What's new" page, README with screenshots (Sentry and Vercel Analytics skipped for now, D104). *Done when:* a friend can sign up and play without help.

Total: about 22 weeks of effort (finished in two days).

### After v1.0.0

Gary's notes after playing v1 (D107–D121). Each milestone ends with Gary merging the release-please PR, which bumps the minor version. Sizes are rough.

- [x] **M7 Quality of life (S–M) → `v1.1.0`:** club colors at club creation (D107), one filterable, sortable scouting table for opened packs (D108), sortable roster with matchday markers (D109), rotated squad button and total squad score (D110), clickable clubs in your league with visible rosters and color percentages, plus the privacy policy line (D111), energy maximum 6 (D118). *Done when:* a new club has its colors across the UI, you can sort and filter a multi-pack opening, and you can inspect any club in your league.
- [x] **M8 Heatmaps (M) → `v1.2.0`:** 3 generated variants per position for Gary to adjust, left and right slots for shared positions in every formation preset (D112). *Done when:* every position offers 3 variants to new players, and a 4-4-2 shows distinct LCB/RCB, LCM/RCM and LST/RST heatmaps.
- [ ] **M9 AI world and 12-club seasons (L, high-risk) → `v1.3.0`:** data retention first (D120), then the AI manager module and the pool of 250 clubs (D113), scheduled AI runs (D114), Elo-nearest 12-club leagues of frozen clones (D115), one best ghost per real player (D116), 26-week seasons with play-in and 8-club bracket (D117), new playoff bonuses. Needs an ADR. *Done when:* AI clubs play seasons on their own for a week, a new season draws the 11 nearest clubs, database size holds steady, and backups stay small.
- [ ] **M10 Color matchups (M, high-risk) → `v1.4.0`:** team-level and individual matchups in the soccer engine (D119), tuned with the harness, strengths in admin. *Done when:* harness metrics stay on target and matchups visibly shift influence on the heatmap.
- [ ] **M11 History and hall of fame (M) → `v1.5.0`:** season history pages, hall of fame global and per club, retirement tributes (D121). *Done when:* you can browse every past season and see your club's all-time greats.

## 6. Post-MVP backlog

*[x] Agreed in Step 6 (D60–D64).*

These wait until M7–M11 ship. They are listed in build order; check each one off as it ships. Items 10–12 moved into M11 (D121).

| Done | # | Feature | What it adds | Size | Depends on |
| --- | --- | --- | --- | --- | --- |
| [ ] | 1 | Baseball (sport #2) | Second sport; proves the framework | L | v1 |
| [ ] | 2 | Cross-sport bonuses | Progress in any sport raises the ratings of rookies offered at youth intake in every sport | M | Baseball |
| [ ] | 3 | Full economy | Attendance, ticket pricing and pack pricing on top of v1's match payouts | M | v1 |
| [ ] | 4 | Sales and trades | Sell players for funds; trade between managers | L | Full economy |
| [ ] | 5 | Staff | Scouts and coaches; scouts make potential ranges more accurate | M | Full economy |
| [ ] | 6 | Facilities | Upgrade tracks (skill floor/ceiling, roster limit, seating), driven by config | M | Full economy |
| [ ] | 7 | Training | Train between matches to grow toward potential (aging is already in v1) | M | v1 |
| [ ] | 8 | Tactics | Formation presets, mentality that shifts influence maps | M | Engine |
| [ ] | 9 | Achievements & notifications | Goals to chase, "your energy is full" alerts | S | v1 |
| → M11 | 10 | Season history | A page per past season: standings, results, top players | S | v1 |
| → M11 | 11 | Hall of fame | The best ghost teams of all time, per sport | S | Season history |
| → M11 | 12 | Retirement tributes | A career summary when a player retires | S | v1 |
| [ ] | 13 | Paintball (sport #3) | Speedball, 5-player, varied tournament formats | L | Baseball |
| [ ] | 14 | Football (sport #4) | Offense, defense and special-teams units; play-by-play downs | L | Baseball |
| [ ] | 15 | Basketball (sport #5) | 5 players, rotations, many short possessions | L | Baseball |
| [ ] | 16 | Hockey (sport #6) | 6 players, line changes | L | Baseball |
| [ ] | 17 | Player portraits | Generated avatars | S | v1 |

**Removed:** private leagues (D63).

## 7. Engineering practices

*[x] Agreed in Step 7 (D65–D71).*

Work as if there were a team: every change goes through an issue, a branch, a PR and green CI. **Claude Code does as much of the work as possible, then gives Gary short, step-by-step instructions for anything only he can do** (account settings, approvals, secrets, DNS).

**Roles**

| Who | Does |
| --- | --- |
| Claude Code | Writes issues, code, tests, migrations and docs; opens PRs; runs a self-review; merges low-risk PRs; prepares releases |
| Gary | Sets priorities, clicks through preview deploys, approves high-risk PRs and production database changes, follows setup instructions |

**Workflow**

- **Planning:** a GitHub Projects board, one GitHub milestone per roadmap milestone, one issue per Claude Code session or PR.
- **`CLAUDE.md`:** a rules file in the repo that every Claude Code session reads first: architecture rules, conventions, how to run tests, and links to this roadmap and its decision log.
- **Every PR includes:** a plain-English summary, test results, a preview link and what to click to check it. Claude Code runs a self-review before opening it.
- **Merging:** Claude Code merges low-risk PRs (docs, tests, small fixes, UI copy) once CI is green. High-risk PRs (database migrations, auth, security rules, payouts or game balance defaults) wait for Gary, with a short checklist of what to look at.
- **Protected `main`:** no direct pushes; green CI required before any merge. Claude Code configures this where it can and gives Gary instructions for the rest.
- **Production database changes:** tested in CI and on `lfs-dev` first. Applying them to `lfs-prod` waits for Gary's one-click approval in GitHub (a protected "production" environment), with instructions in the PR.
- **Backups:** a nightly GitHub Action saves a copy of `lfs-prod` to a separate **private** repo (`lfs-backups`). Setup instructions are part of the M0 guide.

**Quality**

- **Code:** TypeScript strict mode; Biome; a pre-commit hook with lint-staged.
- **Testing:** Vitest for the engine packages (about 90% coverage); Playwright smoke tests for sign up → build a squad → play a match.
- **CI:** GitHub Actions runs lint, typecheck, tests, build and a throwaway-database migration test on every PR. Vercel preview deploys on every PR.
- **Database:** migrations committed to the repo, row-level security on every table, a seed script for `lfs-dev`.
- **Docs:** a README with screenshots, an architecture overview, setup steps and an `.env.example`; short ADRs for key decisions (stack, sim model, async play, sport interface, free-tier hosting).

**Releases**

- **Conventional Commits** in every PR title.
- **release-please** (free GitHub Action) builds the changelog and the version tags (`v0.1` … `v1.0.0`) from those commits.
- **Player-facing release notes:** each release also gets a PR-style "What's new" message written for players, explaining the changes in plain language (new features, balance changes, fixes). It is posted with the GitHub release and on an in-game "What's new" page.

## 8. Risks & open questions

*[x] Agreed in Step 8 (D72–D73).*

| Risk | Mitigation |
| --- | --- |
| v1 scope has grown (7 squad mechanics, template editor, admin) and could take long to become fun | Friends alpha after M3; mechanics tuned in admin rather than perfected up front |
| Sim balance with many interacting systems (chemistry, fitness, form, morale) | Tuning harness from M1; every value adjustable in admin |
| AI-written code that Gary can't easily review | ~90% engine test coverage, `CLAUDE.md` rules, self-review, CI gates, ADRs explaining design choices |
| Claude plan usage limits slow progress | Small issues (one per session); progress tracked on the board and in this roadmap |
| Secrets leaking in a public repo | Keys only in Vercel and GitHub secrets; GitHub secret scanning and push protection on |
| Cheating (faked results) | Matches simulated only on the server; database rules block direct writes |
| Framework over-designed before baseball | Build soccer cleanly; extract shared code when baseball needs it |
| Scope creep | Backlog is locked until v1 ships |
| Too few ghosts at launch | AI teams fill empty league slots |
| Free-tier limits (Supabase pausing, Vercel non-commercial, Resend email cap) | Keep-alive ping, no monetization, check usage before any public promotion |
| Next.js conventions keep changing | Engine and database stay framework-free and portable |
| The AI world fills Supabase's free 500 MB (thousands of fixtures a day) | Data tiers in D120; AI clubs store no replays; check database size weekly after M9 ships |
| Backups grow too large for a GitHub repo | Back up only permanent records and real players' data (D120) |
| GitHub disables scheduled workflows in public repos after 60 days without commits, stopping AI runs and the keep-alive ping | Watch for GitHub's warning email; any commit (or re-enabling the workflow) restarts them |
| The AI world and color matchups change balance at the same time | Ship them as separate milestones (M9, M10), each retuned with the harness |

**Open questions**

- [x] Name and branding → LiterallyFantasySports (D11)
- [x] Grid resolution → 17×25 for soccer; each sport sets its own (D7)
- [x] Ghost opponents → season leagues of AI + ghost teams (D8)
- [x] Energy → separate per sport, 1 per 2 hours, max 3, adjustable in admin (D9, D17, D61, D72)
- [x] Public or private repo → public (D12)
- [x] Soccer league size and season length → 8 teams, double round-robin + playoffs (D16)
- [x] Playoff format → top 4, single-match ties (D30)
- [x] Starting squad size → 22 (D31)
- [x] AI team strength → spread above and below Elo (D32)
- [x] Ghost selection → 1 per manager per league (D33)
- [x] Do subs matter in the sim → yes (D36)
- [x] Do players age → yes (D35)
- [x] Payout amounts and pack price → defaults in D39
- [x] Chemistry details → D51, D52
- [x] Squad mechanics → D45
- [x] Packs, recruitment and roster → D46–D50, D53–D55
- [x] Player worth formula and bulk resale percentage → D85
- [ ] Cross-sport bonus size and cap → decide when the feature is built (D73)
- [x] Template variants: each player gets one at generation and keeps it (D84)
- [ ] Gary to approve the proposed defaults in D87, D89, D91, D92, D94 and D96
- [ ] Playoff bonuses for the 8-club bracket (D117) → decide in M9
- [ ] AI manager personalities: what kinds, and how they differ → decide at the start of M9
