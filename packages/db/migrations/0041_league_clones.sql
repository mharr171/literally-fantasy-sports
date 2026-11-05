-- Leagues of the nearest clubs (D115, ADR 0002 step 7): start_season now
-- copies AI clubs as they are (roster and matchday squad) and real clubs
-- from their ghost, with their colors. The nightly prune drops AI clubs'
-- closed seasons' fixtures and copies (they keep their season records).
GRANT SELECT (colors) ON public.season_teams TO authenticated;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.start_season(
  p_team uuid,
  p_seed text,
  p_config_version text,
  p_slots jsonb,
  p_fixtures jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_sport text;
  v_elo integer;
  v_number integer;
  v_season uuid;
BEGIN
  SELECT sport, elo INTO v_sport, v_elo FROM public.teams WHERE id = p_team FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'team % not found', p_team;
  END IF;
  IF EXISTS (SELECT 1 FROM public.seasons WHERE team_id = p_team AND status <> 'finished') THEN
    RAISE EXCEPTION 'season already in progress';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.seasons
    WHERE team_id = p_team AND (closed_at IS NULL OR intake_resolved_at IS NULL)
  ) THEN
    RAISE EXCEPTION 'last season is not wrapped up';
  END IF;
  -- A club never meets its own ghost (D115).
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_slots) AS x(slot integer, source_team_id uuid)
    WHERE x.slot <> 0 AND x.source_team_id = p_team
  ) THEN
    RAISE EXCEPTION 'a club cannot play its own ghost';
  END IF;
  SELECT coalesce(max(number), 0) + 1 INTO v_number FROM public.seasons WHERE team_id = p_team;

  INSERT INTO public.seasons (team_id, sport, number, seed, start_elo, config_version)
  VALUES (p_team, v_sport, v_number, p_seed, v_elo, p_config_version)
  RETURNING id INTO v_season;

  -- Other clubs are copied as they are now, frozen for the season (D115):
  -- an AI club from its roster and matchday squad, a real club from its
  -- best ghost (D116). Without a copy, a place plays as a generated club.
  INSERT INTO public.season_teams (season_id, slot, kind, name, start_rating, elo, source_team_id, clone, colors)
  SELECT v_season, x.slot, x.kind, x.name, x.start_rating, x.start_rating, x.source_team_id,
         CASE
           WHEN x.kind <> 'ghost' THEN NULL
           WHEN src.kind = 'ai' THEN (
             SELECT jsonb_build_object(
               'players', (
                 SELECT coalesce(jsonb_agg(jsonb_build_object(
                   'id', p.id,
                   'displayName', p.display_name,
                   'attributes', p.attributes,
                   'primaryPosition', p.primary_position,
                   'secondaryPosition', p.secondary_position,
                   'chemistryColor', p.chemistry_color,
                   'overall', p.overall,
                   'templateVariant', p.template_variant
                 ) ORDER BY p.id), '[]'::jsonb)
                 FROM public.players p WHERE p.team_id = src.id
               ),
               'squad', jsonb_build_object(
                 'formation', ms.formation,
                 'lineup', ms.lineup,
                 'bench', ms.bench,
                 'subPlan', ms.sub_plan
               )
             )
             FROM public.matchday_squads ms WHERE ms.team_id = src.id
           )
           ELSE (
             SELECT jsonb_build_object('players', g.players, 'squad', g.squad)
             FROM public.ghosts g WHERE g.team_id = x.source_team_id
           )
         END,
         coalesce(src.colors, '{}')
  FROM jsonb_to_recordset(p_slots) AS x(slot integer, kind text, name text, start_rating integer, source_team_id uuid)
  LEFT JOIN public.teams src ON src.id = x.source_team_id;

  INSERT INTO public.fixtures (season_id, week, stage, home_slot, away_slot)
  SELECT v_season, x.week, x.stage, x.home_slot, x.away_slot
  FROM jsonb_to_recordset(p_fixtures) AS x(week integer, stage text, home_slot integer, away_slot integer);

  RETURN v_season;
END
$$;--> statement-breakpoint

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

  RETURN jsonb_build_object(
    'fixtures_deleted', v_fixtures,
    'replays_cleared', v_replays,
    'summaries_trimmed', v_summaries,
    'packs_deleted', v_packs,
    'clones_cleared', v_clones,
    'ai_fixtures_deleted', v_ai_fixtures,
    'ai_clones_cleared', v_ai_clones
  );
END
$$;--> statement-breakpoint
