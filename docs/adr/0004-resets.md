# ADR 0004: Account reset and admin soft reset (M13)

Status: accepted (Nov 5, 2026: Gary OK'd the confirmations and what a soft
reset keeps and wipes). Covers D141 and D142. Both delete game data, so
they are the only ways to remove it besides deleting an account (D131).

## Context

- **D141, account reset:** a manager can start over as if new.
- **D142, admin soft reset:** an admin can wipe history for AI clubs, real
  clubs or all clubs, while keeping their rosters.

Several points in D141 and D142 were marked "(proposed)". This ADR settles
them.

## Decisions

### 1. Account reset (D141)

**Where:** a "Start over" section on the Account page (`/account`).

**Confirmation:**
- The manager types the club's exact name. The button stays disabled until
  it matches.
- The server checks the name again and refuses if it doesn't match.
- Nothing else is asked, and nothing waits on a confirmation email.

**What is deleted:** the manager's club row. The database's existing
cascades then remove everything that belongs to it:
- players
- packs
- matchday squad
- every season, with its fixtures and league copies
- season records
- player careers
- the ghost

**What stays:**
- **The account:** sign-in, display name and theme.
- **Copies in other leagues:** other managers' leagues that are under way
  keep their frozen copy of the club (D115). Its link to the source club
  is cleared, so those copies play on as normal until their seasons end.

**Afterwards:** the manager lands on Team → "Name your club", like a new
sign-up.

**Logging:** the reset is logged in `admin_actions`, as action
`account_reset`, with the club name and counts.

It runs as one database function, `reset_account(owner)`, inside a single
transaction, through the server with the service role. A manager can only
reset their own account.

### 2. Admin soft reset (D142)

**Where:** a "Soft reset" section on Admin → Testing tools.

**Scope:** AI clubs, real clubs, or all clubs.

**Confirmation:**
- A preview first shows exactly how many clubs, players, seasons, season
  records, ghosts and careers are affected.
- The admin then types `RESET AI`, `RESET REAL` or `RESET ALL` to match the
  scope.
- The server checks the typed text again.

**For every club in scope:**

| What | After the reset |
| --- | --- |
| Elo | Back to the start, 1500 |
| Funds | Back to the start, 10,000 |
| Energy | Full (6) |
| Morale | Neutral (0) |
| Seasons | All deleted, the current one included, with their fixtures and league copies. The next season is season 1 |
| History | Season records, the ghost and retired players' careers deleted. Leaderboards and the hall of fame read from these, so they empty for that scope |
| Players | All kept, with attributes, age, potential, colors and template variants unchanged. Fully healed: fitness 100, no injuries or bans, yellow cards cleared, form 0 |
| Player stats | Zeroed: games, W-D-L, goals, assists, tackles, saves, appearances, seasons played and this season's minutes. Best overall is set to the current overall |
| Matchday squad | Kept, re-picked automatically if it doesn't fit the roster |
| Packs | Packs still waiting to be sorted are kept |

**Not touched:**
- accounts and profiles
- settings versions
- AI settings
- the admin log
- clubs outside the scope

**Real clubs' copies in other leagues:** an AI-only reset doesn't touch the
league copies that real clubs' seasons hold. Those seasons finish with
their frozen opponents, as for an account reset.

**AI clubs afterwards:** they start season 1 on their next scheduled turn.
Real managers see "Start season 1".

**Logging:** the reset runs as one database function,
`admin_soft_reset(scope)`, in a single transaction. It is logged in
`admin_actions`, as action `soft_reset`, with the scope and every count.

### 3. A backup first

**Production:**
- Admin → Testing tools offers a **"Back up now"** link to the backup
  workflow before a soft reset.
- The reset button says when the last nightly backup ran.

**lfs-dev:** there is no backup step on lfs-dev, where resets are expected
to be tried first.

### 4. Tests

The database tests for both functions check:

**Account reset:**
- The club and everything above is gone.
- The profile remains.
- Another manager's league copy keeps playing.
- A wrong club name is refused.
- A manager can't reset anyone else.

**Soft reset:**
- Rosters are intact, with the same players and attributes.
- The players are healed.
- History is empty for the scope only.
- Elo and funds are back to the start.
- Clubs outside the scope are untouched.
- Only admins can run it.

CI's persistence check (D131) still guards migrations. These functions
aren't migrations, and they only run when someone asks.

## Order of work (M13)

| Step | PR | Risk |
| --- | --- | --- |
| 1 | This ADR | Docs |
| 2 | Account reset (D141) | Migration and auth; waits for Gary |
| 3 | Soft reset (D142), tried on lfs-dev first | Migration; waits for Gary |
| 4 | Admin view of public pages (D163) | Auth and data: admin-only fields; waits for Gary |
| 5 | Formation creator with on/off (D140) | Migration |
| 6 | Color cycle editor (D149) | Balance |

## Needs Gary

- Done: Gary OK'd the confirmations and what a soft reset keeps and wipes
  (Nov 5, 2026).
