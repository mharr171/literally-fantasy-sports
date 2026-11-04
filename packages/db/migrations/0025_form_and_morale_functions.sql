-- Managers can see their players' form (team morale is already readable).
GRANT SELECT (form) ON public.players TO authenticated;--> statement-breakpoint

-- record_week also saves each player's form and the team's morale (M4).
DROP FUNCTION public.record_week(uuid, integer, jsonb, jsonb, integer, jsonb, text, integer, integer, timestamptz, jsonb);--> statement-breakpoint
CREATE FUNCTION public.record_week(
  p_season uuid,
  p_week integer,
  p_results jsonb,
  p_elo jsonb,
  p_funds integer,
  p_new_fixtures jsonb,
  p_status text,
  p_next_week integer,
  p_energy integer,
  p_energy_updated_at timestamptz,
  p_players jsonb,
  p_morale double precision
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
  IF p_energy IS NOT NULL AND p_energy < 0 THEN
    RAISE EXCEPTION 'energy cannot be negative';
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
      elo = coalesce((p_elo ->> '0')::integer, elo),
      energy = coalesce(p_energy, energy),
      energy_updated_at = coalesce(p_energy_updated_at, energy_updated_at)
  WHERE id = v_team;

  -- The manager's players after the week (M4): fitness, injuries, bans, cards.
  UPDATE public.players p
  SET fitness = x.fitness,
      injured_weeks = x.injured_weeks,
      suspended_weeks = x.suspended_weeks,
      yellow_cards = x.yellow_cards,
      form = coalesce(x.form, p.form)
  FROM jsonb_to_recordset(p_players) AS x(
    id uuid, fitness integer, injured_weeks integer, suspended_weeks integer,
    yellow_cards integer, form double precision
  )
  WHERE p.id = x.id AND p.team_id = v_team;

  IF p_morale IS NOT NULL THEN
    UPDATE public.teams SET morale = p_morale WHERE id = v_team;
  END IF;

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

REVOKE EXECUTE ON FUNCTION public.record_week(uuid, integer, jsonb, jsonb, integer, jsonb, text, integer, integer, timestamptz, jsonb, double precision) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.record_week(uuid, integer, jsonb, jsonb, integer, jsonb, text, integer, integer, timestamptz, jsonb, double precision) TO service_role;
