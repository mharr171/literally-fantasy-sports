-- Signed-in players can read the switches; only admins can change them
-- (row-level security checks is_admin), and only these columns.
REVOKE ALL ON public.sport_settings FROM anon, authenticated;--> statement-breakpoint
GRANT SELECT ON public.sport_settings TO authenticated;--> statement-breakpoint
GRANT UPDATE (energy_enabled, energy_refill_minutes, energy_max, updated_at)
  ON public.sport_settings TO authenticated;--> statement-breakpoint

-- Soccer starts with energy on: 1 point every 15 minutes, up to 3 (D93).
INSERT INTO public.sport_settings (sport) VALUES ('soccer')
ON CONFLICT (sport) DO NOTHING;--> statement-breakpoint

-- Teams that had energy before this start full.
UPDATE public.teams SET energy = 3, energy_updated_at = now();--> statement-breakpoint

-- record_week also saves the manager's energy after the week (when energy is
-- on), in the same transaction as the results.
DROP FUNCTION public.record_week(uuid, integer, jsonb, jsonb, integer, jsonb, text, integer);--> statement-breakpoint
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
  p_energy_updated_at timestamptz
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

REVOKE EXECUTE ON FUNCTION public.record_week(uuid, integer, jsonb, jsonb, integer, jsonb, text, integer, integer, timestamptz) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.record_week(uuid, integer, jsonb, jsonb, integer, jsonb, text, integer, integer, timestamptz) TO service_role;
