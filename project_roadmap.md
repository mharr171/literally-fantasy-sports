# LiterallyFantasySports — Project Roadmap

Nov 2, 2026 · @Gary · Last updated: Nov 5, 2026 (D186)

## Review progress

The roadmap review is complete: all 8 steps are agreed. New decisions are added to the decision log as they are made. **v1.0.0 is released (Nov 4, 2026). M7 (`v1.1.0`) and M8 (`v1.2.0`) are done; M9 shipped as `v1.3.0` and is ticked after its week-long check. M10 and M11 are done and both shipped in `v1.4.0` (D164). M12 Squad balance and polish (its settings published by Gary), M13 Admin tools (Gary tried the soft reset and turning a formation off on `lfs-dev`) and M14 History and hall of fame (Gary browsed past seasons and the halls of fame on `lfs-dev`) are done and all shipped in `v1.5.0` (Nov 5, 2026, D176). Next:** M15 Packs, rosters and playoffs (`v1.6.0`), then soccer is frozen and baseball starts (D185). Gary's notes after playing v1 are D107–D121, his second round D131–D143, his third round D154–D163 (M12–M14) and his fourth round D178–D184 (M15).

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
| D13 | Nov 2, 2026 | $0 hosting: Vercel Hobby + Supabase free tier. Any paid service needs an ADR (paid hosting since D128) | 1 |
| D14 | Nov 2, 2026 | Funds in v1: fixed amount per match played, plus bonuses for wins, playoff placement and championships | 2 |
| D15 | Nov 2, 2026 | Soccer roster: 30 max; matchday squad of 22 (11 starters + 11 subs) (roster limits now per sport in admin, soccer 11–33, D182) | 2 |
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
| D31 | Nov 3, 2026 | New teams start with 22 players; packs grow the roster toward 30 (roster 11–33, D182) | 4 |
| D32 | Nov 3, 2026 | AI teams in a league are spread above and below the manager's Elo at season start (replaced by D113) | 4 |
| D33 | Nov 3, 2026 | At most 1 ghost per manager in a league. A manager's own ghost may appear in their own league under a disguised name (own ghost now excluded, D115) | 4 |
| D34 | Nov 3, 2026 | Players have several attributes per sport; an overall rating is calculated from them | 4 |
| D35 | Nov 3, 2026 | Players age at season end: young players grow toward potential, older players decline and eventually retire (playing time now affects growth, D154) | 4 |
| D36 | Nov 3, 2026 | The bench matters: automatic substitutions for fatigue and injuries, plus other squad mechanics (see Step 4 questions) | 4 |
| D37 | Nov 3, 2026 | Chemistry: about n/3 colors per sport, where n = players on the field. Majority-color players get a gameday boost (originally 3 colors, +25%). Details pending | 4 |
| D38 | Nov 3, 2026 | Nationalities: as diverse as possible; weights set per sport in config | 4 |
| D39 | Nov 3, 2026 | Default payouts: 1,000 per match, +500 win, +200 draw, playoff and championship bonuses; basic pack 5,000. All adjustable in admin | 4 |
| D40 | Nov 3, 2026 | Elo works the same for every match: AI, ghost, regular season and playoffs | 4 |
| D41 | Nov 3, 2026 | Heatmap templates are designed from scratch with a visual template editor (admin tool) instead of being ported from the 2018 code | 4 |
| D42 | Nov 3, 2026 | Chemistry colors per sport = (n ÷ 3) + 1, minimum 3, where n = players on the field. Each player's color is permanent and random at creation | 4 |
| D43 | Nov 3, 2026 | Chemistry boost goes to the largest color group on the field at that moment (it changes with subs). A tie for largest gives each tied group a smaller boost (e.g. 25% alone, 15% tied). Sports with 4+ colors also give a minor boost to the second-largest group; ties cascade the same way (details pending) | 4 |
| D44 | Nov 3, 2026 | Chemistry boosts are flat percentages per rank, set per sport in the admin panel | 4 |
| D45 | Nov 3, 2026 | Squad mechanics in v1: match fitness across game weeks, in-match fatigue and auto-subs, injuries, sub plans, form, cards and suspensions, morale (substitution timing changed by D159) | 4 |
| D46 | Nov 3, 2026 | Youth intake every season: the team chooses which prospects to take. After that, packs are the only way to find players (packs act as scouting) | 4 |
| D47 | Nov 3, 2026 | Packs: 5 players each, tiers with published odds of player skill, plus position-focused packs (expanded by D179–D181) | 4 |
| D48 | Nov 3, 2026 | Potential is shown as a rough range. Later, staff or facilities make the range more accurate | 4 |
| D49 | Nov 3, 2026 | Each player from a pack is either added to the roster or resold at a fixed "bulk" price. Players can be released for free; sales and trades may come later | 4 |
| D50 | Nov 3, 2026 | No wages or contracts in v1 | 4 |
| D51 | Nov 3, 2026 | Color count rounds to the nearest whole number, minimum 3 (soccer = 5). Replaces the rounding in D42 | 4 |
| D52 | Nov 3, 2026 | Chemistry ranking: a tie for first uses up first and second place (no second-place boost). Groups tied for second share a split second-place boost | 4 |
| D53 | Nov 3, 2026 | Youth intake offers 2n rookies (n = players on the field; 22 for soccer). Any number can be taken for free | 4 |
| D54 | Nov 3, 2026 | The roster may go over 30 temporarily (rookies, packs), but the next match is blocked until it is back to 30 or fewer. In v1 the only way down is free release or bulk resale (limit now 33, D182) | 4 |
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
| D83 | Nov 4, 2026 | New teams start with an empty roster and 22 free starter packs: 2 attacker, 4 midfielder, 4 defender, 1 goalkeeper and 11 all-position packs (5 players each). All 22 must be opened before the first match (the team's initial scouting). Players not kept are released for free, with no resale money. Keep 22–30 to play. Replaces D31 (starters keep 11–33, D182) | M2 |
| D84 | Nov 4, 2026 | Each player is given one of the available template variants for their position when generated, and keeps it. Answers D82's open question | M2 |
| D85 | Nov 4, 2026 | Player worth = 1,000 × 1.08^(overall − 50) × age factor (×1.2 to 21, ×1.0 to 29, ×0.8 to 31, ×0.6 after) × (1 + 4% per point the shown potential midpoint is above the overall), rounded to 50. Uses the shown range, never the hidden potential. Bulk resale pays 25% of worth. Resolves D73's first item | M2 |
| D86 | Nov 4, 2026 | Initial scouting: a manager opens starter packs (one at a time or all at once), then picks their 22–30 from every opened player together, not pack by pack. Pack seeds are hidden from managers, since a seed reveals true potential | M2 |
| D87 | Nov 4, 2026 | Bought packs (proposed defaults, Gary approves): Basic 5,000 (overall 40–49 25%, 50–59 50%, 60–69 20%, 70–79 5%), Silver 12,000 (50–59 35%, 60–69 45%, 70–79 17%, 80–89 3%), Gold 30,000 (60–69 40%, 70–79 45%, 80–89 13%, 90–99 2%). Position-focused packs cost 20% more. A bought pack opens at once and must be sorted (keep or bulk-sell each player) before buying another. New teams start with 10,000 funds. Release and resale stop at 22 players; starter-pack players can be released but not sold | M2 |
| D88 | Nov 4, 2026 | Matchday squad: the manager picks a formation preset (4-4-2, 4-3-3, 4-2-3-1, 4-1-4-1, 3-5-2, 5-3-2), drags 11 starters into its slots and 11 substitutes onto the bench (up to 11, D182), and can plan up to 5 subs in up to 3 different minutes. One saved squad per team; it must be fixed if a picked player leaves. Formations only set positions; tactics and mentality stay in the backlog (admins can now create formations and turn them on or off, D140) | M2 |
| D89 | Nov 4, 2026 | Season defaults (proposed, Gary approves): playoff bonuses 2,000 for reaching the playoffs, +3,000 for reaching the final, +5,000 for winning it (a champion earns 10,000 in bonuses on top of match pay). The 7 AI opponents' ratings are spread evenly from 300 below to 300 above the manager's Elo at season start. An AI team's starters average overall 55 at Elo 1500, +1 per 20 Elo (1700 → 65, 1300 → 45), substitutes 4 lower. League tables rank by points (3/1/0), goal difference, goals scored, then wins (AI spread and ratings replaced by D113; playoff bonuses to be reset for 8 clubs, D117) | M3 |
| D90 | Nov 4, 2026 | Playing a season (M3): a "Play week" button plays the manager's match with their saved matchday squad and the rest of the league's matches at once; energy starts gating it in M4. AI clubs never share a place name. A season's seed (which decides every match) is hidden from managers. The next season opens once season-end processing (ageing, retirement, youth intake) exists | M3 |
| D91 | Nov 4, 2026 | Season end (proposed defaults, Gary approves): players up to 27 close 25–60% of the gap to their true potential each year (at least 1 point while below it, never past it); 28–30 move −1 to +1; from 31 they lose 1–3 a year (31–32), 2–4 (33–34), then 3–6. Retirement chance at the new age: 33 10%, 34 20%, 35 40%, 36 60%, 37+ 85%. Youth intake: 22 prospects aged 16–18, overall around 45 (35–58), always including 2 keepers. Worth is recalculated after ageing. The manager ends the season, sees who improved, declined and retired, answers the intake, then starts the next season | M3 |
| D92 | Nov 4, 2026 | Ghosts and leaderboard (proposed defaults, Gary approves): ending a season freezes the team as it finished (roster, matchday squad, Elo, league record, playoff result, game version, date) before ageing. A new league takes up to 4 ghosts within 300 Elo of the manager, the latest snapshot of each team and at most one per team, each in the AI place nearest its Elo; AI clubs fill the rest. The manager's own ghost can appear under a made-up name. If a ghost's team is deleted, its place plays on as an AI club. The leaderboard lists every finished season by Elo, then points, goal difference and goals; rosters stay private (rosters now visible, D111; ghost rules changed by D115, D116) | M3 |
| D93 | Nov 4, 2026 | Energy (Gary): 1 point back every 15 minutes, up to 3 (replaces D17's 1 per 2 hours). Admins can switch the energy requirement off server-wide for each sport, and change the refill time and maximum, on the Game settings page; changes apply at once, without a new settings version. Every played week costs 1 energy, including playoff rounds the manager isn't in (maximum raised to 6, D118) | M4 |
| D94 | Nov 4, 2026 | Player condition between game weeks (proposed defaults, Gary approves): match fitness carries over and recovers 20 a week, up to 100 (a full match costs about 25, so an unrotated 11 starts week 8 at about 71). Injuries count down one game week at a time. A red card bans the player for 1 match; every 5th yellow card in a season bans them for 1 match. Unavailable players are swapped out automatically for the best fit player (bench first, then the rest of the roster), and the Season page says who. Each new season starts fit with no bans or cards; injuries carry over | M4 |
| D95 | Nov 4, 2026 | Admin testing tools (Gary): admins can refill a team's energy, add funds, heal its squad, play weeks ahead without energy, or delete a team so its manager starts over. Every use is written to an admin action log that admins can read | M4 |
| D96 | Nov 4, 2026 | Form and morale (proposed defaults, Gary approves): each player gets a simple 1–10 match rating (6 base, +1 a goal, +0.5 win / −0.5 loss, −0.5 a yellow, −2 a red; cameos under 30 minutes count half). Form (−1 to 1) keeps 60% of its old value and takes 40% from the latest rating, and fades by 20% a week when the player doesn't play. Team morale (−1 to 1) keeps 70% and adds +0.3 for a win or −0.3 for a loss. In matches, form changes a player's skill by up to ±5% and morale by up to ±3% (±8% at most): an even team at +8% wins about 43% instead of 36% | M4 |
| D97 | Nov 4, 2026 | Auto-pick (Gary): never picks an injured or suspended player over an available one, and weighs fitness and form the way matches do, so fresher, in-form players get the nod when ratings are close. Unavailable players only fill places nobody else can, so the squad can still be saved (they're swapped out at kickoff) (unavailable players no longer fill in; clubs play a man down, D183) | M4 |
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
| D119 | Nov 4, 2026 | Color matchups (Gary): each chemistry color is strong against some colors and weak against others, all balanced (soccer's 5 colors: each beats 2 and loses to 2). Matchups count at team level (each team's dominant and second colors) and between individual players on the field: stronger individual matchups raise a team's influence in that area of the pitch. Stacks with the chemistry boost; strengths are tuning values in admin, set with the harness. Baseball's 4 colors can't be fully balanced and are settled when baseball is built (cycle and display detailed in D138) | M11 |
| D120 | Nov 4, 2026 | Data kept (Gary), to stay within Supabase's free 500 MB and keep backups small. Forever: a one-line record per club per season (place, W/D/L, goals, Elo before and after, playoff result), one leaderboard row per season (split from the ghost snapshot), each real player's best ghost, and a career record for every retired player (seasons, appearances, goals, best overall, clubs). Current and previous season: the manager's own fixtures in full with replays; scores only for the rest of the league. Older seasons keep each match's summary (score, possession, shots, goals, cards, injuries) but no replay. Deleted when done: league clones once their season's replays go, pack rows once sorted. AI clubs never store replay details (admins can compute one on demand). Nightly backups cover only the permanent records and real players' data (detail trimmed only after stats are counted, D143) | M9 |
| D121 | Nov 4, 2026 | Season history and hall of fame (Gary) move from the backlog (#10–#12) into M11 (now M14): a page per past season, a hall of fame both global and per club (a club's all-time greats), and retirement tributes, all built on D120's permanent records | M14 |
| D122 | Nov 4, 2026 | How D112 works: a left or right slot uses its player's template moved 3 columns (of 17) towards that touchline, with each row keeping its total. Only the heatmap moves, so match results and replays are unchanged. Of two slots in one position the leftmost is left and the rightmost right; a middle third (e.g. the middle CB of three) keeps the template as painted. The 36 generated variants are added from the template editor ("Add generated variants"), which ticks them for new players in place of the default; they reach players once Gary saves and publishes the version | M8 |
| D123 | Nov 4, 2026 | M9 plan (ADR 0002, accepted by Gary): AI clubs are ordinary `teams` rows (`kind` 'ai', no owner, an invented manager name) run by a pure, seeded AI manager in the engine that sees only what managers see; the game steps move into a shared `packages/game` used by the web app and by a GitHub Actions run every 2 hours; leagues store frozen clones; `ghosts`, `season_records` and `player_careers` replace `team_snapshots`; a nightly prune keeps D120's limits. Backups treat AI clubs exactly like real clubs, seasons in progress included (Gary: slow AI clubs must not lose a season), changing D120's backup line; the dump is gzipped and `lfs-backups` keeps the last 30 nights plus one a month for a year (changes D70). Bonuses: quarter-finals 1,000, semi-finals 2,000, final 3,000, champion 5,000 (Gary OK'd) | M9 |
| D124 | Nov 5, 2026 | How D117 ships (ADR 0002 step 4): new seasons have 12 clubs (11 generated AI opponents until leagues of clones, D115, land), 22 league weeks, a play-in (week 23), quarter-finals, semi-finals and a final (week 26). A season's format follows its number of clubs, so 8-team seasons already under way finish the old way. A week without the club's own match costs no energy: the play-in for 1st–7th (who rest, as D117 says) and every round after the club is out. New payout `quarter` (1,000, Gary OK'd in D123); `playoffs` now means reaching the semi-finals, in both formats | M9 |
| D125 | Nov 5, 2026 | How D116 ships (ADR 0002 step 5): `ghosts` holds one row per real club, written at season end only when the club finishes above its ghost's Elo. When a league starts, the database copies each ghost into the season (`season_teams.clone`), so a club's newer best season never changes a league already under way (D115). A club never meets its own ghost (replaces D33's disguised own ghost). `team_snapshots` is dropped: each club's best snapshot became its ghost, leagues in progress kept their copies, and the leaderboard links a season to its roster only when that season is the club's ghost. Managers can't read the copies' rosters (attributes stay server-side, D111); the nightly prune clears copies older than the previous season | M9 |
| D126 | Nov 5, 2026 | AI manager (ADR 0002 step 6a, proposed defaults, adjustable later): decisions use only what a manager sees (overall, age, positions, shown potential range). Rosters aim for 28 (builder), 25 (spender) or 26 (steady) and always cover 3 keepers, 8 defenders, 8 midfielders and 5 forwards. Builders buy Basic all-position packs and keep up to 4 youth prospects (shown potential up to 70+); spenders buy the best pack they can afford aimed at their weakest line and take 1 prospect (80+); steady clubs keep 8,000 back, buy Silver or Basic for their weakest line and take 2 prospects (75+). Each club keeps one formation. Rotation: builders rest tired players most, spenders least | M9 |
| D127 | Nov 5, 2026 | AI clubs in the database (ADR 0002 step 6b): `teams.kind` is 'human' or 'ai'; AI clubs have no owner, an invented `manager_name` and a profile, and start like a new manager: 22 starter packs, then the AI manager picks the first squad. AI clubs get season records but no ghost (they play in leagues as themselves, D115). `ai_settings` (server only) holds the pool size (250), runs a day (12) and an on/off switch, off until scheduled runs land (step 8). Admin → AI clubs can add clubs and run a turn for testing; an AI club's turn goes through the same game code as a manager's | M9 |
| D128 | Nov 5, 2026 | Hosting (Gary): Vercel Pro, and Supabase Pro for `lfs-prod` only (Micro compute, covered by the plan's compute credit: $25 a month). `lfs-dev` stays on Nano in a free organization, kept awake by the keep-alive workflow. Scheduled AI runs stay on GitHub Actions (ADR 0002): known free limits, long runs, and kept apart from the live site; moving them to Vercel's scheduler stays possible since the code is shared | M9 |
| D129 | Nov 5, 2026 | How D115 ships (ADR 0002 step 7): a new league takes the 11 clubs nearest the club's Elo from every AI club and every other real club's ghost, ties broken at random; generated clubs fill any places left while the pool is small. `start_season` copies each one as it is (an AI club from its roster and matchday squad, a real club from its ghost) with its colors, frozen for the season. Copies show as ordinary clubs (no "ghost" label), so AI and real clubs look the same (D113). AI clubs keep no replay data, and their closed seasons' fixtures and copies are pruned nightly (their season records stay) | M9 |
| D130 | Nov 5, 2026 | How D114 ships (ADR 0002 step 8): `.github/workflows/ai-world.yml` runs every 2 hours (at :23) against lfs-prod with repository secrets `PROD_SUPABASE_URL` and `PROD_SUPABASE_SECRET_KEY`. Each run adds up to 40 clubs towards the pool size (using at most a third of the run), then gives every AI club a turn of its pace's weeks (seeded per run and club), 6 at a time, within 20 minutes, longest-waiting first. Runs do nothing while the AI world is off in Admin → AI clubs. Each run is logged in `ai_runs` (server only, kept two weeks) and shown on that page; the workflow fails, so GitHub emails, only when the run itself fails or most clubs hit a problem | M9 |
| D131 | Nov 5, 2026 | Data persistence (Gary): deploys and migrations never reset, reseed or delete real clubs, AI clubs, players or game settings (including template variants) on `lfs-prod`. Migrations keep existing rows (backfill, never wipe). CI's migration test runs against seeded data and fails if any of those tables loses rows. The only ways to remove game data are the reset tools in D141 and D142 | M10 |
| D132 | Nov 5, 2026 | Template variant checks (Gary): the template editor warns when variants are ticked but not yet published, and the admin overview shows how many players still use the default heatmap. Tests make sure every new player (starter packs, bought packs, youth intake, AI clubs) gets an enabled variant for each of their positions | M10 |
| D133 | Nov 5, 2026 | Dropdowns and theme (Gary): the site follows the computer's light or dark setting, and dropdowns showed light text on a white background. Every dropdown is fixed for both modes, and a Light / Dark / System choice is added to account settings (proposed). Long lists use one shared searchable dropdown: type to filter, arrow keys, Enter to choose, with filters where useful (e.g. All / Real / AI). First used for the team picker on Admin → Testing tools and the AI clubs page | M10 |
| D134 | Nov 5, 2026 | Weeks without a match (Gary): never cost energy and are never blocked at 0 energy (today the Play button is disabled at 0 even when the club has no match). A setting lets each manager either click through them or have them skipped automatically. Either way, the club rests as usual | M10 |
| D135 | Nov 5, 2026 | Positions (Gary): a player can still be played anywhere, but out of position his skill drops 50% (replaces the 0% fit for "other" positions; primary +25% and secondary +10% stay). Auto-pick, auto-subs and the AI manager avoid out-of-position players unless nobody else can fill the slot. Out of position, a player uses that slot's default heatmap. Balance change, retuned with the harness | M11 |
| D136 | Nov 5, 2026 | Secondary heatmaps (Gary): every player with a secondary position gets a random enabled variant for it too, as for the primary (D84). Existing players get one assigned once, at random | M10 |
| D137 | Nov 5, 2026 | Game guide (Gary): a general info page for new managers covering the basics (seasons, energy, squads, positions, packs, youth) and chemistry, including which colors are strong and weak against which. Linked from the getting-started checklist | M11 |
| D138 | Nov 5, 2026 | Color cycle (Gary: Claude decides): Claude Code designs soccer's 5-color cycle (each color beats 2 and loses to 2) and records it in an ADR with the matchup strengths. It is shown in the game guide (D137) and wherever colors are compared | M11 |
| D139 | Nov 5, 2026 | Planning around colors (Gary): a season schedule page lists every fixture with each opponent's chemistry colors as percentages (leagues are frozen copies, so they stay accurate all season). The matchday squad page shows the chemistry colors of the starting 11 and of the whole roster | M11 |
| D140 | Nov 5, 2026 | Formation creator (Gary): an admin page to create formations (slots on the pitch, each with a position and left or right side where shared) and turn any formation on or off. Turning one off affects every club, real and AI, from its next match; a club whose saved formation is off is moved to the closest enabled one and asked to check its squad (proposed). The AI manager only picks enabled formations | M13 |
| D141 | Nov 5, 2026 | Account reset (Gary): a button in account settings resets the account as if new: the club, players, seasons, ghost, season records and careers are deleted, and the manager starts again from naming a club. Needs the club name typed to confirm (proposed) | M13 |
| D142 | Nov 5, 2026 | Admin soft reset (Gary): applies to AI clubs, real clubs or all. Each club in scope goes back to the starting Elo and starting funds, its current season ends and the next one starts fresh, and all history is wiped: season records, ghosts, retired careers, leaderboard, hall of fame and player stats. Every player on the roster is kept and fully healed (fitness 100, injuries, bans and yellow cards cleared); form and morale go back to neutral (proposed). Needs a typed confirmation and is logged in `admin_actions` | M13 |
| D143 | Nov 5, 2026 | Player stats (Gary): each player keeps career totals of games played, wins, draws and losses (shown as win %), goals, assists, tackles and saves. The engine credits an assist on a goal (weighted by attacking influence and passing) and a tackle when a chance is stopped (weighted by defensive influence and defending), each on its own random stream so scores and existing replays don't change; the defending keeper gets each save. Only a club's own season counts, not its copies in other leagues. Totals are updated as each week is played (before D120 trims detail), carried into `player_careers` at retirement and shown on player cards. Career totals only, no per-season lines. Built early so the hall of fame (M14) has data | M10 |
| D144 | Nov 5, 2026 | How D133 ships: the theme (Light / Dark / System) is chosen on a new Account page (`/account`, linked from your name in the header) and kept in the browser, applied before the page draws; System follows the computer. Every dropdown takes the page's colors in both themes. The shared searchable dropdown (type to filter, arrow keys, Enter, Escape, optional tabs) is used for the club picker on Admin → Testing tools (All / Real / AI) and to find an AI club on Admin → AI clubs | M10 |
| D145 | Nov 5, 2026 | How D132 and D136 ship: players gain a secondary template variant, rolled on its own random stream so every other part of a pack, youth or AI player stays as it was. Matches, the squad heatmap and the player card (now with a second heatmap) use it at the secondary position. Existing players with a secondary position got one at random from the live version's ticked templates, once, by migration. League copies and ghosts taken before this play with the default there, as frozen copies. Old replays are unchanged. The template editor warns when ticked templates aren't live yet, and the admin overview counts players on the default template at each position | M10 |
| D146 | Nov 5, 2026 | How D143 ships: a tackle is credited whenever an attack is stopped before it becomes a chance, to an outfield defender weighted by defensive influence and defending (about 10 a team per match). 80% of goals get an assist, to a teammate weighted by attacking influence and passing. Each save goes to whoever is in goal. Assists and tackles have their own random streams, and a test pins 200 matches to prove scores and events don't change. Games are the existing appearances. Results weren't kept before, so win % counts only games with a recorded result (wins + draws + losses). Players' and careers' new totals start at 0 | M10 |
| D147 | Nov 5, 2026 | Player stats on one start (Gary, after playing a week: one match showed "16 games, 100% win, 1-0-0"): every number on the player card counts from when player stats started (D143). New `stat_games` and `stat_goals` sit beside the totals since v1.3 (appearances and goals), which stay for the career record. Existing games were set to wins + draws + losses, and goals since the start were counted once from the club's own match summaries. Win % is wins / games. This replaces D146's win % rule. Soft resets (D142) clear all of these | M10 |
| D148 | Nov 5, 2026 | Color cycle (D138, proposed in ADR 0003): each color beats the next two along the rainbow, Red → Yellow → Green → Blue → Purple → Red. Team matchups (dominant colors +4%, second colors +2%) and player matchups by area of the pitch (up to ±6% influence) are tuning values. They are off in stored versions without them, so seasons under way and replays don't change (Gary OK'd, Nov 5, 2026) | M11 |
| D149 | Nov 5, 2026 | Color settings in admin (Gary): the three matchup strengths are match tuning values in Admin → Soccer balance, tested with the harness before publishing (M11). An admin editor for the color cycle itself (reorder the ring; it checks every color still beats two and loses to two) is added to M13 | M11, M13 |
| D150 | Nov 5, 2026 | Matchup strengths (Gary, after the harness sweep in #90): team matchup 7%, second colors 3.5%, player matchups 9%, for the settings version that turns matchups on. Defaults stay 0 until that version is published | M11 |
| D151 | Nov 5, 2026 | How D135 ships: the out-of-position penalty is a match tuning value (Admin → Soccer balance → Positions), 0 until a settings version sets it to −50%, so seasons under way and replays don't change. Auto-pick, cover for injured or banned starters, the AI and ghosts (through auto-pick) always choose players in their own position when anyone can fill the slot. In-match subs do too once the penalty is on. The squad page shows ratings with the penalty of the season being played | M11 |
| D152 | Nov 5, 2026 | How D139 ships: a Schedule page (Season → Schedule and opponents' colors) lists every fixture with the opponent's starting 11 by chemistry color and whether your dominant color beats, loses to or is even with theirs, plus results once played. The matchday squad page shows the starting 11's colors (updating as you move players) and the whole roster's. Club pages use the same color bar | M11 |
| D153 | Nov 5, 2026 | How D137 ships: a public Game guide page (`/guide`, linked from the getting-started checklist and the footer) covers your club, seasons, energy, squads and positions, packs, youth and ageing, chemistry and color matchups, with the cycle drawn as a ring and a beats / loses-to table. Its numbers (payouts, prices, energy, position bonuses, the out-of-position penalty and matchup strengths) come from the live settings, so the guide changes with admin. It says when matchups or the penalty aren't switched on yet | M11 |
| D154 | Nov 5, 2026 | Growth from playing time (Gary): at season end, a young player's growth toward potential scales with how much he played that season, counting minutes as a starter or a substitute. Regulars grow most; players who rarely play grow less. Needs a per-season minutes counter, reset each season. Older players' decline is unchanged (proposed). How strongly minutes count is a balance value in admin | M12 |
| D155 | Nov 5, 2026 | Tooltips (Gary): floating tooltips and pop-ups open centered vertically on the screen, so their content is visible without scrolling the page. If one is taller than the screen, it scrolls inside itself | M12 |
| D156 | Nov 5, 2026 | Roster table (Gary): the sell and release column gets a heading, and the table is reformatted so everything fits without scrolling sideways: details stacked under the main values (e.g. positions under the name, potential under overall) and compact buttons. On phones each row becomes a card (proposed) | M12 |
| D157 | Nov 5, 2026 | Fatigue per match (Gary): Admin → Soccer balance shows fatigue in plain terms, as the fitness an average player loses over a full match (and a keeper's), next to the in-match values that drive it. Tested with the harness like other balance values | M12 |
| D158 | Nov 5, 2026 | Weekly recovery (Gary): the fitness every player regains each game week (now fixed at 20) becomes a balance setting in admin, versioned like the others. The rest of the fitness, ban and form settings (yellow and red card bans; form and morale strength) move into admin with it (proposed) | M12 |
| D159 | Nov 5, 2026 | Logical substitutions (Gary): when there are fewer substitution windows than substitutions (5 subs, 3 windows), automatic subs wait until several are needed and make them together, so all 5 can be used. Tired-player subs become more likely toward the end of the substitution period. Injuries and red-card cover still happen straight away, and that window also brings on anyone tired who is nearly due (proposed). A manager's own sub plan is followed as set. Changes match results, so it is switched on by a settings version (as D148 and D151) and checked with the harness | M12 |
| D160 | Nov 5, 2026 | Admin AI turns (Gary): "Run a turn now" on Admin → AI clubs no longer uses the clubs' energy (today it does). The scheduled runs still use energy (D114). The text under "Run every AI club" is rewritten to say so | M12 |
| D161 | Nov 5, 2026 | Form (answer to Gary): form already changes a player's skill in his next match, by up to ±5% at full form, and drifts back to 0 while he doesn't play. The match rating behind it only counts goals, results and cards, so defenders and keepers rarely build form. It now also counts assists, tackles, saves and clean sheets (proposed) | M12 |
| D162 | Nov 5, 2026 | Squad score and Today (answer to Gary): Today counts this week's fitness and form, so fully fit players in good form lift it above the squad score. The squad page explains both numbers in a tooltip, and Today also counts morale, like matches do (proposed) | M12 |
| D163 | Nov 5, 2026 | Admin view (Gary): when an admin is signed in, public pages show extra information (e.g. hidden potential, worth, Elo details, an AI club's activity profile and manager personality, the settings version a match used) in a different color with an "Admin" label. Admins can always tell real clubs and managers from AI ones. The extra data is only sent to admins. A switch lets an admin view pages as a normal player (proposed) | M13 |
| D164 | Nov 5, 2026 | Versions: M10 and M11 both shipped in `v1.4.0`. The open release-please PR for `v1.4.1` only holds a docs change. Later milestones move up one: M12 Squad balance and polish → `v1.5.0`, M13 Admin tools → `v1.6.0`, M14 History and hall of fame → `v1.7.0` | M12 |
| D165 | Nov 5, 2026 | How D159 ships: a "Logical substitutions" switch in Admin → Soccer balance (0 until a settings version sets it to 1). When on and there are fewer windows left than subs, a tired-player window opens only once enough players are due to share it (subs left ÷ windows left, rounded up); the energy limit rises by 15 from the first auto-sub minute to 85', and from 85' any window left is used. A window already opened by a planned sub, an injury or a red card also brings on anyone within 10 of the limit. Harness: teams using all 5 subs go from 34% to 64%, goals and draws unchanged | M12 |
| D166 | Nov 5, 2026 | How D161 ships: a "Contributions count for form" switch in Admin → Soccer balance → Form and morale (0 until a settings version sets it to 1). When on, the match rating also adds +0.5 per assist, +0.1 per tackle (up to +1), +0.25 per save (up to +1.5) and, after 60+ minutes, +1 for a keeper's clean sheet or +0.5 for a defender's (by main position). In a 22-match simulation, average season-end form goes from 0.00 to 0.37 for keepers and from −0.05 to 0.11 for defenders; strikers 0.20 → 0.26 | M12 |
| D167 | Nov 5, 2026 | How D154 ships: players count `season_minutes` in their club's own matches (starter or substitute), reset when the season closes. A "Growth from playing time" setting in Admin → Soccer balance → Recovery, bans and growth (0 until a settings version sets it) scales a young player's growth by his minutes: regulars (70%+ of the club's minutes) grow fully, a player who didn't play grows (1 − weight) as much. Older players' decline is unchanged. At 0.5, an 18-year-old grows +12.0 as a regular, +8.1 with a quarter of the minutes and +6.0 without playing | M12 |
| D168 | Nov 5, 2026 | Resets (D141, D142, proposed in ADR 0004): an account reset is confirmed by typing the club's name and deletes the club with everything that belongs to it (the account stays, and other leagues keep their frozen copies). A soft reset is chosen by scope, previewed with counts and confirmed by typing RESET AI / RESET REAL / RESET ALL. It keeps every player (healed, form 0), squads and unsorted packs, and wipes all seasons, season records, ghosts, careers and player stats, with Elo 1500, funds 10,000, energy full and morale 0. Both run in one transaction and are logged in `admin_actions` (Gary OK'd, Nov 5, 2026) | M13 |
| D169 | Nov 5, 2026 | How D141 ships: Account → Start over deletes the manager's club by the `reset_account` database function, only after the club's exact name is typed (checked in the page, the server action and the database). The existing cascades remove players, packs, squad, seasons, season records, careers and the ghost; the account and profile stay, and other managers' leagues keep their frozen copies. Logged in `admin_actions` as `account_reset` with counts. Managers can't call the function directly | M13 |
| D170 | Nov 5, 2026 | How D142 ships: Admin → Testing tools → Soft reset. The admin picks AI, real or all clubs, presses Preview to see the counts (clubs and players kept; seasons, season records, ghosts and careers deleted), then types RESET AI / RESET REAL / RESET ALL. The `admin_soft_reset` database function checks the admin and the phrase again, locks the clubs, and does the whole reset in one transaction; real clubs are `kind = 'human'`. Energy goes to the sport's `energy_max`. Logged in `admin_actions` as `soft_reset` with the scope and counts. Only the server can call it. A "Back up now" link opens the backup workflow; the page names the nightly time rather than reading the last run | M13 |
| D171 | Nov 5, 2026 | How D163 ships (first part): admin extras are violet with an "Admin" label. Club pages (league and leaderboard) show where the club comes from (real club and its manager, AI club with its manager, personality, pace and formation, or generated for this league), its start and current Elo, and each player's age, true potential, shown range, worth and fitness today. The leaderboard, the season table and match pages label every club real or AI, and match pages name the settings version played. The extras are loaded on the server only when an admin has them on, so they never reach anyone else. A header switch ("Admin view on" / "Player view") hides them, stored in an http-only cookie | M13 |
| D172 | Nov 5, 2026 | How D140 ships: a `formations` table holds the six built-in presets (defined in code) and admin-made formations (11 slots, one keeper, each with a position and a place on the pitch; left and right are worked out as in D112). A formation can't be changed or deleted once it exists (a database trigger refuses), so every match that used it replays the same; to change one, create a new one and turn the old one off. Admin → Formations turns any formation on or off (one always stays on) and logs it. Managers can only newly pick formations that are on. Second PR: clubs whose saved formation is off move to the closest one that is on at their next match and are asked to check their squad, and the AI only picks formations that are on | M13 |
| D173 | Nov 5, 2026 | Moving off a formation that's off (D140, second part): at a club's next match, a saved squad in a formation that's off moves to the one that's on with the most positions in common (ties: the first in the list). The same 11 start, each put in a slot of their old position, then one they can play, then where they rate best; bench and sub plan are kept. The squad page and the season page say "X has been turned off for every club, so your squad now plays Y" until the manager saves the squad. An AI club whose formation is off switches to the closest one that's on at its next turn, and new AI clubs only roll formations that are on. League copies already in a season keep their frozen formation (D115) | M13 |
| D174 | Nov 5, 2026 | How D149 ships: the color cycle is a match tuning value (`colorCycle`, the five color indexes in ring order) in each settings version, edited in Admin → Soccer balance → Color matchups by moving colors up or down round a live ring. Any order of five is balanced (each beats the next two), so the only check is that each color appears once. A version without it plays the built-in rainbow cycle, so seasons under way and replays are unchanged. The game guide shows the live cycle, and the season schedule the cycle its season plays by | M13 |
| D175 | Nov 5, 2026 | M14 plan (ADR 0005, Gary OK'd): a History tab on My team lists every season and opens each one (final table, bracket, results, top scorers, retirements); the club's hall of fame shows its all-time greats and honours; a public `/hall-of-fame` ranks clubs and players across the game by club name only (no manager names); each retiring player gets a tribute card. Season pages are for your own club only. Built on existing records; only indexes are added (bracket drawing added by D184) | M14 |
| D176 | Nov 5, 2026 | Versions (Gary): release-please had not cut `v1.5.0` before M13 and M14 merged, so M12, M13 and M14 all shipped together in `v1.5.0`, as M10 and M11 did in `v1.4.0` (D164). This replaces D164's plan of `v1.6.0` and `v1.7.0`. The next milestone takes the next minor version | M14 |
| D177 | Nov 5, 2026 | AI world runs reliably (Gary): GitHub's schedule ran 1 of about 9 due runs on its first day, so Supabase's scheduler (`pg_cron` and `pg_net` on `lfs-prod`) starts the AI world workflow every 2 hours with a token that can only start workflows (`docs/ai-world-scheduler.sql`); GitHub's schedule stays as a fallback. Each run plays the time since the last finished run (runs owed = hours since it / hours between runs, at most 6), so late, missed or extra runs keep each club at its pace; energy still caps how many weeks a club can play at once | M9 |
| D178 | Nov 5, 2026 | Form by position (Gary): every position averages the same match rating, so a centre-back or defensive midfielder builds form as easily as a striker. Each stat (goals, assists, tackles, saves, clean sheets) gets a weight per position in admin, tuned until the harness's average match rating by position is level. How far form moves after a match scales with the minutes played, up and down alike: a full 90 moves it most, a short cameo little (replaces the cameo halving). Form's effect on skill stays the same for every position | M15 |
| D179 | Nov 5, 2026 | Elo-scaled packs (Gary): each tier's skill range (minimum and maximum) shifts with the club's Elo when the pack is bought, and so does its price, so every tier stays useful as a club climbs. AI clubs follow the same rules. The shop shows the odds and price for the club's current Elo. The scaling is set per sport in admin; Claude Code proposes a formula and checks it doesn't make strong clubs run away | M15 |
| D180 | Nov 5, 2026 | Color exclusion (Gary): a pack can leave out 1, 2 or 3 chemistry colors, for +25%, +60% and +120% on the price (admin settings). It combines with position focus (the surcharges add up) (Gary OK'd, Nov 5, 2026) | M15 |
| D181 | Nov 5, 2026 | New pack types (Gary): Prospect packs (ages 17–20, lower overall, higher potential), Veteran packs (ages 30+, ready now, cheaper), Wildcard packs (wider odds: more busts and more stars), and Reward packs given free at season end for playoff finishes (champion a Gold pack, finalist Silver, semi-finalist Basic). Not planned for now: nationality, attribute, pick-1 and bulk packs (Gary OK'd, Nov 5, 2026) | M15 |
| D182 | Nov 5, 2026 | Roster limits (Gary): minimum and maximum roster size are per-sport settings in admin. Soccer becomes 11 minimum and 33 maximum (was 22 and 30). The matchday squad is 11 starters and up to 11 substitutes. Starter scouting keeps 11–33 players. Releasing or reselling below the minimum is blocked; above the maximum the next match is blocked, as D54 | M15 |
| D183 | Nov 5, 2026 | Playing a man down (Gary): injured or suspended players never fill in. If fewer than 11 players are available, the club starts a man (or more) down, and the empty slots add no influence, so the opponent dominates that area of the pitch. Auto-pick and the AI leave those slots empty. If no keeper is available, the best available outfield player goes in goal with the out-of-position penalty, leaving an outfield slot empty instead (Gary OK'd, Nov 5, 2026) | M15 |
| D184 | Nov 5, 2026 | Playoff bracket (Gary): the season page draws the bracket (play-in, quarter-finals, semi-finals, final) with each club's seed and results, filling in as rounds are played. Each past season in History shows the same bracket (planned in ADR 0005, not yet built) | M15 |
| D185 | Nov 5, 2026 | Soccer feature freeze (Gary): after M15, soccer gets only bug fixes and balance tweaks; new soccer ideas go into the backlog until baseball ships. Baseball (backlog #1) is split into three milestones: making `packages/game` and the web app sport-agnostic through the `Sport` interface (with an ADR), the baseball engine and harness, then baseball's UI, AI clubs and settings | M15 |
| D186 | Nov 5, 2026 | M15 plan (ADR 0006, Gary OK'd): rosters 11–33 with a bench of 0–11 in `sport_settings`; empty slots add no influence and a club with fewer than 7 available players forfeits 3–0; form weights per position line tuned until every line averages within ±0.1, and form moves with minutes / 90; bought packs shift 1 overall per 40 Elo (−10 to +15) with prices +3% per point; color exclusion +25/60/120% on top of focus; Prospect (17–20, Basic −10, potential +10, Silver price), Veteran (30–33, Silver +3, 70% of Silver), Wildcard (15% at 40–49 and 15% at 80–89) and Reward packs; a drawn playoff bracket. Match changes switch on with a settings version | M15 |

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
| Budget | $0 beyond the domain (now Vercel Pro + Supabase Pro for `lfs-prod`, D128) | Vercel Hobby + Supabase free tier at launch |

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
- [ ] **M9 AI world and 12-club seasons (L, high-risk) → `v1.3.0`:** data retention first (D120), then the AI manager module and the pool of 250 clubs (D113), scheduled AI runs (D114), Elo-nearest 12-club leagues of frozen clones (D115), one best ghost per real player (D116), 26-week seasons with play-in and 8-club bracket (D117), new playoff bonuses. Plan: ADR 0002 (`docs/adr/0002-ai-world.md`). *Done when:* AI clubs play seasons on their own for a week, a new season draws the 11 nearest clubs, database size holds steady, and backups stay small.
- [x] **M10 Fixes and settings (M) → `v1.4.0`:** (done Nov 5, 2026: #82–#87) data persistence guarantees and CI check (D131), variant warnings and tests (D132), fixed dropdowns, Light / Dark / System setting and the shared searchable dropdown (D133), idle weeks free and skippable (D134), secondary-position heatmaps (D136), player stats (D143). *Done when:* a deploy with a migration leaves every club and setting intact, new players always have variants for both positions, dropdowns are readable in both modes, and player cards show stats.
- [x] **M11 Color matchups and planning (M, high-risk) → `v1.4.0`:** (done Nov 5, 2026: #89–#94; harness with everything on: 2.60 goals per match, 27.4% draws for even teams) the color cycle and matchups in the engine (D119, D138), out-of-position penalty (D135), game guide (D137), season schedule and chemistry on the matchday squad page (D139). Retuned with the harness. *Done when:* harness metrics stay on target, matchups visibly shift influence on the heatmap, and a new manager can read in the guide which colors beat which.
- [x] **M12 Squad balance and polish (M, high-risk) → `v1.5.0`:** (done Nov 5, 2026: #98–#105; harness with everything on: 2.60 goals per match, 27.1% draws for even teams, 63% of teams use all 5 subs) growth from playing time (D154), centered tooltips (D155), roster table that fits without scrolling (D156), fatigue per match in plain terms (D157), weekly recovery and other fitness, ban and form settings in admin (D158), logical substitutions (D159), free admin AI turns (D160), form from assists, tackles, saves and clean sheets (D161), squad score explained (D162). *Done when:* the harness stays on target with the new subs, a full match uses all 5 subs in 3 windows when needed, regulars grow more than benchwarmers over a season, and the roster fits on a laptop screen.
- [x] **M13 Admin tools (M, high-risk) → `v1.5.0` (D176):** admin view of public pages (D163), formation creator with on/off (D140), color cycle editor (D149), account reset (D141), soft reset for AI, real or all clubs (D142). *Done when:* a formation can be created and turned off for everyone, and a soft reset on `lfs-dev` leaves rosters intact and history empty.
- [x] **M14 History and hall of fame (M) → `v1.5.0` (D176):** season history pages, hall of fame global and per club, retirement tributes (D121), using player stats (D143). *Done when:* you can browse every past season and see your club's all-time greats with their stats.
- [ ] **M15 Packs, rosters and playoffs (M, high-risk) → `v1.6.0`:** per-sport roster limits with soccer at 11–33 (D182), playing a man down (D183), form by position and by minutes (D178), Elo-scaled packs and prices (D179), color exclusion (D180), Prospect, Veteran, Wildcard and Reward packs (D181), playoff bracket on the season page and in History (D184). Form, roster and short-handed changes affect matches, so they switch on with a settings version and are checked with the harness. *Done when:* the harness shows every position averaging the same match rating, a club with 10 available players plays a man down, the shop shows Elo-based odds and prices with color exclusion, and the bracket is drawn for the current and past seasons.

## 6. Post-MVP backlog

*[x] Agreed in Step 6 (D60–D64).*

These wait until M7–M15 ship; from then on soccer is frozen (D185) and baseball comes first. They are listed in build order; check each one off as it ships. Items 10–12 moved into M14 (D121).

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
| → M14 | 10 | Season history | A page per past season: standings, results, top players | S | v1 |
| → M14 | 11 | Hall of fame | The best ghost teams of all time, per sport | S | Season history |
| → M14 | 12 | Retirement tributes | A career summary when a player retires | S | v1 |
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
