-- Managers can read the new season columns too (still not the seed).
GRANT SELECT (closed_at, review, intake_taken, intake_resolved_at)
  ON public.seasons TO authenticated;--> statement-breakpoint

-- Season end (D35): saves every player's new age, attributes, overall and
-- worth, removes retired players and records a short review, all at once.
-- Only for a finished season that hasn't been closed yet.
CREATE FUNCTION public.close_season(
  p_season uuid,
  p_updates jsonb,
  p_retired jsonb,
  p_review jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_team uuid;
BEGIN
  SELECT team_id INTO v_team FROM public.seasons
  WHERE id = p_season AND status = 'finished' AND closed_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'season cannot be closed';
  END IF;

  UPDATE public.players p
  SET age = x.age,
      attributes = x.attributes,
      overall = x.overall,
      worth = x.worth
  FROM jsonb_to_recordset(p_updates) AS x(id uuid, age integer, attributes jsonb, overall integer, worth integer)
  WHERE p.id = x.id AND p.team_id = v_team;

  DELETE FROM public.players
  WHERE team_id = v_team
    AND id IN (SELECT (jsonb_array_elements_text(p_retired))::uuid);

  UPDATE public.seasons SET closed_at = now(), review = p_review WHERE id = p_season;
END
$$;--> statement-breakpoint

-- Youth intake (D53): adds the prospects the manager took, for free, and
-- marks the intake answered. Only once per closed season.
CREATE FUNCTION public.resolve_youth_intake(
  p_season uuid,
  p_players jsonb,
  p_taken jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_team uuid;
  v_sport text;
BEGIN
  SELECT team_id, sport INTO v_team, v_sport FROM public.seasons
  WHERE id = p_season AND closed_at IS NOT NULL AND intake_resolved_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'youth intake is not open';
  END IF;

  INSERT INTO public.players (
    team_id, sport, first_name, last_name, display_name, nationality, age,
    primary_position, secondary_position, attributes, overall, potential,
    potential_low, potential_high, worth, chemistry_color, template_variant,
    from_starter_pack
  )
  SELECT v_team, v_sport, x.first_name, x.last_name, x.display_name,
         x.nationality, x.age, x.primary_position, x.secondary_position,
         x.attributes, x.overall, x.potential, x.potential_low,
         x.potential_high, x.worth, x.chemistry_color, x.template_variant, false
  FROM jsonb_to_recordset(p_players) AS x(
    first_name text, last_name text, display_name text, nationality text,
    age integer, primary_position text, secondary_position text,
    attributes jsonb, overall integer, potential integer,
    potential_low integer, potential_high integer, worth integer,
    chemistry_color integer, template_variant text
  );

  UPDATE public.seasons
  SET intake_taken = p_taken, intake_resolved_at = now()
  WHERE id = p_season;
END
$$;--> statement-breakpoint

-- Starting a season now also needs the last one wrapped up: closed and its
-- youth intake answered, so no season skips ageing (D90).
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

REVOKE EXECUTE ON FUNCTION public.close_season(uuid, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.resolve_youth_intake(uuid, jsonb, jsonb) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.close_season(uuid, jsonb, jsonb, jsonb) TO service_role;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.resolve_youth_intake(uuid, jsonb, jsonb) TO service_role;
