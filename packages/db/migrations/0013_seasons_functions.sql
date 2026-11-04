-- Managers can read their own seasons, league teams and fixtures, but not a
-- season's seed: it decides every match, so knowing it would let them test
-- lineups against the real results. Only the server writes.
REVOKE ALL ON public.seasons, public.season_teams, public.fixtures FROM anon, authenticated;--> statement-breakpoint
GRANT SELECT (
  id, team_id, sport, number, status, week, start_elo, config_version,
  created_at, finished_at
) ON public.seasons TO authenticated;--> statement-breakpoint
GRANT SELECT ON public.season_teams, public.fixtures TO authenticated;--> statement-breakpoint

-- Starts a team's next season: the league's teams and its schedule, all at
-- once. The server builds the league with the engine first. Refuses while
-- the team has an unfinished season (also enforced by seasons_one_active).
CREATE FUNCTION public.start_season(
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
  SELECT coalesce(max(number), 0) + 1 INTO v_number FROM public.seasons WHERE team_id = p_team;

  INSERT INTO public.seasons (team_id, sport, number, seed, start_elo, config_version)
  VALUES (p_team, v_sport, v_number, p_seed, v_elo, p_config_version)
  RETURNING id INTO v_season;

  INSERT INTO public.season_teams (season_id, slot, kind, name, start_rating, elo)
  SELECT v_season, x.slot, x.kind, x.name, x.start_rating, x.start_rating
  FROM jsonb_to_recordset(p_slots) AS x(slot integer, kind text, name text, start_rating integer);

  INSERT INTO public.fixtures (season_id, week, stage, home_slot, away_slot)
  SELECT v_season, x.week, x.stage, x.home_slot, x.away_slot
  FROM jsonb_to_recordset(p_fixtures) AS x(week integer, stage text, home_slot integer, away_slot integer);

  RETURN v_season;
END
$$;--> statement-breakpoint

-- Saves one played week: results, new ratings, the manager's earnings,
-- any playoff fixtures and where the season goes next. Refuses unless the
-- season is still on p_week, so playing the same week twice can't pay or
-- move Elo twice (the season row is locked while it checks).
CREATE FUNCTION public.record_week(
  p_season uuid,
  p_week integer,
  p_results jsonb,
  p_elo jsonb,
  p_funds integer,
  p_new_fixtures jsonb,
  p_status text,
  p_next_week integer
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_team uuid;
  v_updated integer;
  v_expected integer;
BEGIN
  IF p_funds < 0 THEN
    RAISE EXCEPTION 'earnings cannot be negative';
  END IF;
  SELECT team_id INTO v_team FROM public.seasons
  WHERE id = p_season AND week = p_week AND status <> 'finished'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'week already played';
  END IF;

  SELECT count(*) INTO v_expected FROM public.fixtures
  WHERE season_id = p_season AND week = p_week AND home_score IS NULL;
  UPDATE public.fixtures f
  SET home_score = x.home_score,
      away_score = x.away_score,
      winner = x.winner,
      summary = x.summary,
      played_at = now()
  FROM jsonb_to_recordset(p_results) AS x(id uuid, home_score integer, away_score integer, winner text, summary jsonb)
  WHERE f.id = x.id AND f.season_id = p_season AND f.week = p_week AND f.home_score IS NULL;
  GET DIAGNOSTICS v_updated = ROW_COUNT;
  IF v_updated <> v_expected OR v_updated <> jsonb_array_length(p_results) THEN
    RAISE EXCEPTION 'results do not match week % (% of % fixtures)', p_week, v_updated, v_expected;
  END IF;

  UPDATE public.season_teams st
  SET elo = (p_elo ->> st.slot::text)::integer
  WHERE st.season_id = p_season AND p_elo ? st.slot::text;

  UPDATE public.teams
  SET funds = funds + p_funds,
      elo = coalesce((p_elo ->> '0')::integer, elo)
  WHERE id = v_team;

  INSERT INTO public.fixtures (season_id, week, stage, home_slot, away_slot)
  SELECT p_season, x.week, x.stage, x.home_slot, x.away_slot
  FROM jsonb_to_recordset(p_new_fixtures) AS x(week integer, stage text, home_slot integer, away_slot integer);

  UPDATE public.seasons
  SET status = p_status,
      week = p_next_week,
      finished_at = CASE WHEN p_status = 'finished' THEN now() ELSE NULL END
  WHERE id = p_season;
END
$$;--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.start_season(uuid, text, text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.record_week(uuid, integer, jsonb, jsonb, integer, jsonb, text, integer) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.start_season(uuid, text, text, jsonb, jsonb) TO service_role;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.record_week(uuid, integer, jsonb, jsonb, integer, jsonb, text, integer) TO service_role;
