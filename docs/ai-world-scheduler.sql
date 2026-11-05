-- Supabase scheduler for the AI world (D177). Run once in lfs-prod:
-- Supabase → lfs-prod → SQL Editor → New query, paste this whole file,
-- then Run. It needs the pg_cron and pg_net extensions switched on and a
-- GitHub token saved in Vault as 'github_ai_world_token' (see
-- m0_setup_guide.md, "AI world scheduler"). Only for lfs-prod: lfs-dev
-- must not start the production AI world.
--
-- Every 2 hours at :23 it asks GitHub to start the "AI world" workflow,
-- which plays the AI clubs. GitHub's own schedule stays on as a fallback;
-- each run plays only the time since the last one, so two runs close
-- together don't double the AI clubs' pace.

-- Replace any earlier version of this job.
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'ai-world';

SELECT cron.schedule(
  'ai-world',
  '23 */2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://api.github.com/repos/mharr171/literally-fantasy-sports/actions/workflows/ai-world.yml/dispatches',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || (
        SELECT decrypted_secret FROM vault.decrypted_secrets
        WHERE name = 'github_ai_world_token'
      ),
      'Accept', 'application/vnd.github+json',
      'X-GitHub-Api-Version', '2022-11-28',
      'User-Agent', 'lfs-ai-world-scheduler',
      'Content-Type', 'application/json'
    ),
    body := '{"ref": "main"}'::jsonb
  );
  $$
);

-- To check it later (204 means GitHub started the run):
--   SELECT start_time, status, return_message FROM cron.job_run_details
--     WHERE jobid = (SELECT jobid FROM cron.job WHERE jobname = 'ai-world')
--     ORDER BY start_time DESC LIMIT 5;
--   SELECT created, status_code, left(content::text, 200)
--     FROM net._http_response ORDER BY created DESC LIMIT 5;
-- To stop it: SELECT cron.unschedule('ai-world');
