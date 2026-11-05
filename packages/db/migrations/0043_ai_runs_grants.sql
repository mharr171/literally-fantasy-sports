-- The AI run log (D114) is server-only, and the nightly prune keeps two weeks of it.
REVOKE ALL ON public.ai_runs FROM anon, authenticated;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.prune_old_data()
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_fixtures integer;
  v_replays integer;
  v_summaries integer;
  v_packs integer;
  v_clones integer;
  v_ai_fixtures integer;
  v_ai_clones integer;
  v_ai_runs integer;
BEGIN
  -- Seasons older than each club's previous one (1 = current, 2 = previous).
  -- Older seasons: only the club's own matches stay, without replay data.
  DELETE FROM public.fixtures f
  USING (
    SELECT id FROM (
      SELECT id, row_number() OVER (PARTITION BY team_id ORDER BY number DESC) AS age
      FROM public.seasons
    ) ranked WHERE age > 2
  ) old
  WHERE f.season_id = old.id AND f.home_slot <> 0 AND f.away_slot <> 0;
  GET DIAGNOSTICS v_fixtures = ROW_COUNT;

  UPDATE public.fixtures f
  SET manager_team = NULL
  FROM (
    SELECT id FROM (
      SELECT id, row_number() OVER (PARTITION BY team_id ORDER BY number DESC) AS age
      FROM public.seasons
    ) ranked WHERE age > 2
  ) old
  WHERE f.season_id = old.id AND f.manager_team IS NOT NULL;
  GET DIAGNOSTICS v_replays = ROW_COUNT;

  -- League copies go with the replays they were kept for (D115, D120).
  UPDATE public.season_teams st
  SET clone = NULL
  FROM (
    SELECT id FROM (
      SELECT id, row_number() OVER (PARTITION BY team_id ORDER BY number DESC) AS age
      FROM public.seasons
    ) ranked WHERE age > 2
  ) old
  WHERE st.season_id = old.id AND st.clone IS NOT NULL;
  GET DIAGNOSTICS v_clones = ROW_COUNT;

  -- AI clubs keep only their season records once a season is closed
  -- (ADR 0002): no fixtures, no copies.
  DELETE FROM public.fixtures f
  USING public.seasons s JOIN public.teams tm ON tm.id = s.team_id
  WHERE f.season_id = s.id AND tm.kind = 'ai' AND s.closed_at IS NOT NULL;
  GET DIAGNOSTICS v_ai_fixtures = ROW_COUNT;

  UPDATE public.season_teams st
  SET clone = NULL
  FROM public.seasons s JOIN public.teams tm ON tm.id = s.team_id
  WHERE st.season_id = s.id AND tm.kind = 'ai' AND s.closed_at IS NOT NULL
    AND st.clone IS NOT NULL;
  GET DIAGNOSTICS v_ai_clones = ROW_COUNT;

  -- Other clubs' matches keep only their score (and a shoot-out result).
  UPDATE public.fixtures f
  SET summary = CASE
      WHEN f.summary ? 'penalties'
        THEN jsonb_build_object('decidedBy', f.summary -> 'decidedBy', 'penalties', f.summary -> 'penalties')
      WHEN f.summary ? 'decidedBy'
        THEN jsonb_build_object('decidedBy', f.summary -> 'decidedBy')
      ELSE NULL
    END
  WHERE f.home_slot <> 0 AND f.away_slot <> 0
    AND f.summary IS NOT NULL
    AND f.summary - 'decidedBy' - 'penalties' <> '{}'::jsonb;
  GET DIAGNOSTICS v_summaries = ROW_COUNT;

  -- Bought packs are only needed until they're sorted. Starter packs stay:
  -- they show a club has picked its first squad.
  DELETE FROM public.packs
  WHERE kind = 'bought' AND resolved_at IS NOT NULL AND resolved_at < now() - interval '1 day';
  GET DIAGNOSTICS v_packs = ROW_COUNT;

  -- The AI run log is kept for two weeks.
  DELETE FROM public.ai_runs WHERE started_at < now() - interval '14 days';
  GET DIAGNOSTICS v_ai_runs = ROW_COUNT;

  RETURN jsonb_build_object(
    'fixtures_deleted', v_fixtures,
    'replays_cleared', v_replays,
    'summaries_trimmed', v_summaries,
    'packs_deleted', v_packs,
    'clones_cleared', v_clones,
    'ai_fixtures_deleted', v_ai_fixtures,
    'ai_clones_cleared', v_ai_clones,
    'ai_runs_deleted', v_ai_runs
  );
END
$$;
