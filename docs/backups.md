# Backups

A GitHub Action (`.github/workflows/backup.yml`) saves `lfs-prod` every night
to the private repo [`mharr171/lfs-backups`](https://github.com/mharr171/lfs-backups)
as `lfs-prod.sql` (D70). The file is replaced each night; the repo's Git history
holds every earlier night. A night with no changes adds no commit.

**What is saved:** all game data (`public` schema), the migration history
(`drizzle` schema) and the accounts (`auth.users`, `auth.identities`), so
players can still sign in after a restore.

**What is not:** Supabase settings (sign-in providers, URLs, email templates),
storage files, and the secrets in GitHub and Vercel. Those are recreated from
`m0_setup_guide.md`.

**Needs:** repository secrets `PROD_DATABASE_URL` (Session pooler) and
`BACKUP_REPO_TOKEN` (fine-grained token with Contents read/write on
`lfs-backups` only; renew yearly).

**Run one now:** Actions → Nightly backup → Run workflow.

## Restoring

Restoring overwrites data, so it is done on purpose, tested on `lfs-dev`
first, and never in a hurry. Ask Claude Code for a restore plan for the
situation (whole database, one table, or a single player's data); it will
prepare and test the exact commands. The basics:

1. Pick the version: in `lfs-backups`, open the history of `lfs-prod.sql` and
   download the night you want.
2. The file is plain SQL: accounts first, then the `public` and `drizzle`
   schemas with their data. It can be read in any text editor to check what
   it contains.
3. Load it with the Postgres 17 `psql` against the target project's Session
   pooler URL, after preparing the project as the restore plan says.
4. Check the site, then record what happened in the roadmap's decision log.
