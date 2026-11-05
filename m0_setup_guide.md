# M0 Setup Guide

LiterallyFantasySports · for @Gary · Nov 3, 2026

This guide lists the setup only you can do: creating accounts, approving access, and changing settings that need your login. Claude Code does everything else (code, configuration files, CI, database migrations) and will point back to this guide when it needs one of these steps finished.

**How to use it:** work through Part A now. Part B happens after Claude Code has created the first code in the repo (it will tell you when). Part C is for later milestones. Check boxes as you go.

**Before you start**

- Use a password manager (Bitwarden is free) for the passwords and keys in this guide.
- Never paste a key marked **secret** into a chat, issue or file. Secret keys go only into the GitHub, Vercel or Supabase settings named below.
- Button and menu names can shift slightly as these services update. If something doesn't match, ask Claude and describe what you see.

## Part A: Before the first code (about 1–2 hours)

### A1. Claude Code

- [ ] Confirm your Claude plan includes Claude Code (Pro or Max).
- [ ] Open Claude Code from the **Code** tab in the Claude desktop app, or at claude.ai/code.
- [ ] When asked, connect your GitHub account (after step A2).

### A2. GitHub

- [ ] Sign in to github.com and turn on two-factor authentication (**Settings → Password and authentication**) if it isn't already on.
- [ ] Create the main repo: **New repository**
  - Name: `literally-fantasy-sports`
  - Visibility: **Public**
  - Add a README: yes · License: **MIT** · .gitignore: none (Claude Code adds it)
- [ ] Create the backup repo: **New repository**
  - Name: `lfs-backups`
  - Visibility: **Private**
  - Add a README: yes
- [ ] In `literally-fantasy-sports`, open **Settings → Code security** and make sure **Secret scanning** and **Push protection** are on.

### A3. Supabase (two projects)

- [ ] Sign up at supabase.com using **Continue with GitHub**.
- [ ] Turn on two-factor authentication for your Supabase account (**Account → Security**).
- [ ] Create project **`lfs-prod`**: choose a US West region and generate a strong database password. Save the password in your password manager.
- [ ] Create project **`lfs-dev`** the same way, with its own password.
- [ ] **Don't connect either project to GitHub or Vercel.** Skip any "Connect GitHub repository", "Branching" or Vercel integration options in Supabase. Signing up with GitHub only uses it as your login. Database changes reach Supabase through GitHub Actions (D28, D69), and Supabase Branching isn't part of the free plan.
- [ ] For each project, note these values from **Project Settings** (Claude Code will ask for them):

| Value | Where | Secret? |
| --- | --- | --- |
| Project URL and project reference | Project Settings → General / API | No |
| Publishable (anon) key | Project Settings → API Keys | No |
| Secret (service role) key | Project Settings → API Keys | **Yes** |
| Database connection string | Connect button → connection string | **Yes** (contains the password) |

### A4. Google sign-in

This lets players use "Continue with Google".

- [ ] Go to console.cloud.google.com and create a project named `LiterallyFantasySports`.
- [ ] Check that the project picker (top left) shows `LiterallyFantasySports`.
- [ ] Open **console.cloud.google.com/auth/overview** and click **Get started**:
  - App information: app name `LiterallyFantasySports`, user support email = your email
  - Audience: **External**
  - Contact information: your email
  - Finish: agree to the policy → **Create**
- [ ] Left menu → **Branding**. Fill in and **Save**:
  - Application home page: `https://www.literallyfantasysports.com`
  - Application privacy policy link: `https://www.literallyfantasysports.com/privacy-policy`
  - Application terms of service link: `https://www.literallyfantasysports.com/terms-of-service`
  - Authorized domains → **Add domain**: `literallyfantasysports.com`
  - These pages go live in Part B. Google only checks them if it reviews the app, so it's fine to enter them now.
- [ ] Create credentials: **Clients → Create client**, type **Web application**, name `LFS Web`.
  - Authorized JavaScript origins: `https://www.literallyfantasysports.com`
  - Authorized redirect URIs (one for each Supabase project). Copy each from Supabase: **Authentication → Sign In / Providers → Google → Callback URL**. They look like:
    - `https://<lfs-prod project reference>.supabase.co/auth/v1/callback`
    - `https://<lfs-dev project reference>.supabase.co/auth/v1/callback`
- [ ] Copy the **Client ID** and **Client secret** (secret).
- [ ] In **both** Supabase projects: **Authentication → Sign In / Providers → Google**, turn it on and paste the Client ID and Client secret.
- [ ] Publish the app (**Audience → Publish app**) so anyone can sign in, not just test users.

### A4b. Privacy policy and terms of service

The policy and terms are in `docs/legal/` (`privacy_policy.md`, `terms_of_service.md`), with placeholders filled in (governing law: California; effective date: November 1, 2026). The site publishes them at `/privacy-policy` and `/terms-of-service`, linked from the footer (and from the sign-in page once it exists).

- [x] Fill in the placeholders and add the files to `docs/legal/`.
- [ ] If the pages go live after November 1, 2026, update the effective date in both files to the go-live day.
- [ ] Optional: have them looked over by someone with legal knowledge. They are plain starting points, not legal advice.

### A4c. Contact email (forwarding + reply)

- [ ] Squarespace → **Domains** → `literallyfantasysports.com` → **Email** → **Email forwarding** → add `admin` → forward to your personal email. Squarespace adds the MX records itself.
- [ ] Confirm forwarding works by sending a test from another account.
- [ ] After Resend is verified (A5): create a second Resend API key named `gmail-send-as`, then in Gmail **Settings → Accounts → Send mail as → Add another email address**: `admin@literallyfantasysports.com`, leave "Treat as an alias" ticked; SMTP server `smtp.resend.com`, port `465`, username `resend`, password = that API key, SSL. Confirm with the code Gmail sends.
- [ ] In Gmail, choose **Reply from the same address the message was sent to**.

### A5. Resend (sign-in emails)

- [ ] Sign up at resend.com.
- [ ] **Domains → Add domain:** `literallyfantasysports.com`. Resend shows several DNS records (TXT and MX). Keep that page open.
- [ ] Add those records in Squarespace (step A6), then click **Verify** in Resend. Verification can take from a few minutes to a few hours.
- [ ] **API Keys → Create API key** with "Sending access" (secret).
- [ ] In **both** Supabase projects: **Authentication → Emails → SMTP Settings**, turn on custom SMTP:
  - Sender email: `noreply@literallyfantasysports.com` · Sender name: `LiterallyFantasySports`
  - Host: `smtp.resend.com` · Port: `465`
  - Username: `resend` · Password: your Resend API key

### A6. Squarespace DNS (email records)

- [ ] Sign in at account.squarespace.com → **Domains** → `literallyfantasysports.com` → **DNS** (DNS Settings).
- [ ] Under **Custom records**, add each record Resend showed, copying the type, host and value exactly.
- [ ] Don't delete existing records yet. If the domain already has email (MX records) for another service, tell Claude before adding Resend's records, so the two don't conflict.

**Part A is done when:** both Supabase projects exist, Google sign-in is configured in both, and Resend shows the domain as verified. Tell Claude Code you've finished Part A.

## Part B: After the first code (about 30–60 minutes)

Claude Code will tell you when the repo has a working app. Then:

### B1. Vercel (hosting)

- [ ] Sign up at vercel.com with **Continue with GitHub** and choose the **Hobby** (free) plan.
- [ ] **Add New → Project →** import `literally-fantasy-sports`. Build settings: **Root Directory** `apps/web` (leave "Include files outside the root directory" on). Framework preset: Next.js. Leave the build and install commands at their defaults. `apps/web/vercel.json` turns off deploys for the release-please branch and skips builds when nothing the site uses changed (D100); leave **Settings → Git → Ignored Build Step** on its default so the file is used.
- [ ] **Settings → Environment Variables:** add these two variables twice, once for **Production** and once for **Preview** (both are public values, not secrets):

| Name | Production (`lfs-prod`) | Preview (`lfs-dev`) |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://nyplzwdxffuchnbsewhy.supabase.co` | `https://wpgolvexlcpjmzoentnk.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_nU2CkyNMqlFm6OX3Bk5BKw_U6iW-ty6` | `sb_publishable_eIMxzJMr9q1gqGSRfYAzNg_EYollaBM` |

- [ ] **Settings → Domains:** add `www.literallyfantasysports.com`, then add `literallyfantasysports.com` and set it to **redirect to www**.
- [ ] Vercel shows the DNS records to create (usually an **A** record for the root domain and a **CNAME** for `www`). Add them in Squarespace under **Custom records**. If Squarespace has default records for the same hosts (`@` or `www`), remove those first.
- [ ] Wait until Vercel shows both domains as **Valid**.

### B2. Supabase sign-in URLs and emails

Supabase only sends people back to addresses on its allow list, so set these in each project under **Authentication → URL Configuration**:

- [ ] `lfs-prod`: **Site URL** `https://www.literallyfantasysports.com`. **Redirect URLs → Add URL:** `https://www.literallyfantasysports.com/**`
- [ ] `lfs-dev`: **Site URL** `http://localhost:3000`. **Redirect URLs → Add URL** for each of:
  - `http://localhost:3000/**`
  - `https://*-live-full-stack.vercel.app/**` (any preview deploy from the `live-full-stack` Vercel team)

So that email sign-in links work even when opened in a different browser or on another device (e.g. requested on the PC, opened on the phone), change two email templates in **both** projects under **Authentication → Emails → Templates**:

- [ ] **Magic Link** and **Confirm signup**: in the message body, replace `{{ .ConfirmationURL }}` with:

```
{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email
```

  Save each one. The rest of the template text can stay as it is.

### B3. GitHub settings

Claude Code will try to do these itself and only ask you for the ones it can't.

- [ ] **Production approval:** in the main repo, **Settings → Environments → New environment** named `production`. Under **Required reviewers**, add yourself. This makes production database changes wait for your click.
- [ ] **Protect `main`:** **Settings → Rules → Rulesets** (or **Branches**). Block direct pushes and require the CI checks Claude Code names.
- [ ] **Repository secrets:** **Settings → Secrets and variables → Actions**. Add the secrets Claude Code lists (for example the `lfs-prod` and `lfs-dev` database connection strings).
- [ ] **Backup access token:** on GitHub, open **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
  - Repository access: **Only `lfs-backups`**
  - Permissions: **Contents: Read and write**
  - Expiration: 1 year (set a calendar reminder to renew it)
  - Save it as a repository secret in `literally-fantasy-sports` under the name Claude Code gives (for example `BACKUP_REPO_TOKEN`).

- [ ] **Release token** (for release-please, D71): **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**.
  - Name: `release-please` · Expiration: 1 year (calendar reminder to renew)
  - Repository access: **Only `literally-fantasy-sports`**
  - Permissions: **Contents**, **Pull requests** and **Issues**: Read and write
  - Save it as a repository secret in `literally-fantasy-sports` named `RELEASE_PLEASE_TOKEN`.

**Part B is done when:** you can open www.literallyfantasysports.com, see the privacy policy and terms pages, sign in with Google or an email link, and the first PR shows green CI and a preview link. That completes M0 (`v0.1`).

## Part C: Later milestones

- [ ] **Make yourself admin** (once the profiles migration has reached `lfs-prod`): in Supabase open **`lfs-prod` → SQL Editor**, paste the line below with your sign-in email, and click **Run**. It should report 1 row updated. Repeat in `lfs-dev` if you want admin there too.

```sql
update public.profiles set is_admin = true where id = (select id from auth.users where email = 'you@example.com');
```
- [ ] **M3 (friends alpha):** invite a few friends and share the link.
- [ ] ~~**M5:** turn on two-factor (authenticator app) on your game account.~~ On the back burner (D103): the admin panel doesn't require it.
- [ ] ~~**M6:** sign up at sentry.io (free Developer plan) and connect it to Vercel; turn on **Web Analytics** in the Vercel project.~~ Skipped for now (D104).
- [ ] **M9, AI world** (D114): the scheduled AI runs (`.github/workflows/ai-world.yml`) need two repository secrets in `literally-fantasy-sports`, under **Settings → Secrets and variables → Actions → New repository secret**:
  - `PROD_SUPABASE_URL`: in Supabase, **`lfs-prod` → Project Settings → API → Project URL** (it looks like `https://xxxx.supabase.co`).
  - `PROD_SUPABASE_SECRET_KEY`: in the same place, the **secret** key (`sb_secret_…`), the same value Vercel has as `SUPABASE_SECRET_KEY`. Paste it straight into GitHub, never into a chat.
  - Then **Actions → AI world → Run workflow** once: it should say the AI world is switched off. Switch it on in **Admin → AI clubs** when you're ready.
- [ ] **AI world scheduler** (D177): GitHub's own schedule often skips runs, so Supabase starts the AI world every 2 hours instead. Do this in **`lfs-prod` only**:
  1. **A GitHub token that can only start workflows.** GitHub → your avatar → **Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token**. Name it `lfs-ai-world-scheduler`, expiry 1 year, **Repository access → Only select repositories → `literally-fantasy-sports`**, and under **Repository permissions** set **Actions** to **Read and write** (nothing else). Generate it and keep the page open.
  2. **Switch on two extensions.** Supabase → `lfs-prod` → **Database → Extensions**: search for and enable **`pg_cron`** and **`pg_net`** (accept the default schema).
  3. **Save the token in Vault.** Supabase → `lfs-prod` → **Project Settings → Vault → Secrets → Add new secret** (or **Integrations → Vault**): name **`github_ai_world_token`**, value: the token from step 1. If you can't find Vault there, use **SQL Editor → New query** instead and run `select vault.create_secret('PASTE-THE-TOKEN-HERE', 'github_ai_world_token');` with the token in place of `PASTE-THE-TOKEN-HERE`. Never paste it into a chat.
  4. **Schedule it.** Supabase → `lfs-prod` → **SQL Editor → New query**: paste the whole of [`docs/ai-world-scheduler.sql`](docs/ai-world-scheduler.sql) and **Run**. It should return one row with a job number.
  5. **Check it.** After the next :23 past an even hour (UTC), GitHub → **Actions → AI world** shows a new run started by **workflow_dispatch**. If not, run the two check queries at the bottom of that file and send me what they say (no token appears in them).
- [ ] **Every year:** renew the domain at Squarespace, the backup access token (`BACKUP_REPO_TOKEN`) the release token (`RELEASE_PLEASE_TOKEN`) and the AI world scheduler token (`github_ai_world_token` in Vault).

## Accounts summary

| Service | Plan | Used for |
| --- | --- | --- |
| Claude | Your current plan | Claude Code builds everything |
| GitHub | Free | Code, CI, project board, backups repo |
| Supabase | Free (2 projects) | Database and sign-in (`lfs-prod`, `lfs-dev`) |
| Google Cloud | Free | "Continue with Google" sign-in |
| Resend | Free | Sign-in emails |
| Vercel | Hobby (free) | Hosting and preview deploys |
| Squarespace | Existing domain | DNS for the site and email |
| Sentry | Not needed for now (D104) | Error tracking |
