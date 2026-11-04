-- Snapshots hold other managers' rosters: only the server reads them. The
-- leaderboard is rendered on the server from the public fields.
REVOKE ALL ON public.team_snapshots FROM anon, authenticated;--> statement-breakpoint

-- Season end now also freezes the team into a snapshot (D19, D59): the
-- ghost other managers will meet and the season's leaderboard entry.
DROP FUNCTION public.close_season(uuid, jsonb, jsonb, jsonb);--> statement-breakpoint
CREATE FUNCTION public.close_season(
  p_season uuid,
  p_updates jsonb,
  p_retired jsonb,
  p_review jsonb,
  p_snapshot jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_team uuid;
  v_sport text;
  v_number integer;
BEGIN
  SELECT team_id, sport, number INTO v_team, v_sport, v_number FROM public.seasons
  WHERE id = p_season AND status = 'finished' AND closed_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'season cannot be closed';
  END IF;

  -- Freeze the team as it finished the season, before anyone ages.
  INSERT INTO public.team_snapshots (
    team_id, season_id, sport, team_name, season_number, elo, players, squad,
    stats, game_version
  )
  SELECT v_team, p_season, v_sport, tm.name, v_number, tm.elo,
         p_snapshot -> 'players', p_snapshot -> 'squad', p_snapshot -> 'stats',
         p_snapshot ->> 'game_version'
  FROM public.teams tm WHERE tm.id = v_team;

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

-- Leagues can now include ghosts: each slot may name the snapshot it plays as.
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

  INSERT INTO public.season_teams (season_id, slot, kind, name, start_rating, elo, snapshot_id)
  SELECT v_season, x.slot, x.kind, x.name, x.start_rating, x.start_rating, x.snapshot_id
  FROM jsonb_to_recordset(p_slots) AS x(slot integer, kind text, name text, start_rating integer, snapshot_id uuid);

  INSERT INTO public.fixtures (season_id, week, stage, home_slot, away_slot)
  SELECT v_season, x.week, x.stage, x.home_slot, x.away_slot
  FROM jsonb_to_recordset(p_fixtures) AS x(week integer, stage text, home_slot integer, away_slot integer);

  RETURN v_season;
END
$$;--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.close_season(uuid, jsonb, jsonb, jsonb, jsonb) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.close_season(uuid, jsonb, jsonb, jsonb, jsonb) TO service_role;
