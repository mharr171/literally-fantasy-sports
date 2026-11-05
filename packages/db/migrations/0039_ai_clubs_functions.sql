-- AI clubs (D113, ADR 0002 step 6b): ordinary teams with kind 'ai', no
-- owner, an invented manager and a profile. ai_settings is server-only.
REVOKE ALL ON public.ai_settings FROM anon, authenticated;--> statement-breakpoint
INSERT INTO public.ai_settings (sport) VALUES ('soccer') ON CONFLICT DO NOTHING;--> statement-breakpoint

-- An AI club starts like a new manager: 22 starter packs to scout (D83).
CREATE FUNCTION public.create_ai_team(
  p_sport text,
  p_name text,
  p_colors text[],
  p_manager_name text,
  p_ai jsonb,
  p_packs jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_team uuid;
BEGIN
  INSERT INTO public.teams (owner_id, sport, name, colors, kind, manager_name, ai)
  VALUES (NULL, p_sport, p_name, coalesce(p_colors, '{}'), 'ai', p_manager_name, p_ai)
  RETURNING id INTO v_team;

  INSERT INTO public.packs (team_id, sport, kind, focus, tier, seed)
  SELECT v_team, p_sport, 'starter', x.focus, x.tier, gen_random_uuid()::text
  FROM jsonb_to_recordset(p_packs) AS x(focus text, tier text);

  RETURN v_team;
END
$$;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.create_ai_team(text, text, text[], text, jsonb, jsonb) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.create_ai_team(text, text, text[], text, jsonb, jsonb) TO service_role;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.close_season(
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
  v_start_elo integer;
BEGIN
  SELECT team_id, sport, number, start_elo INTO v_team, v_sport, v_number, v_start_elo FROM public.seasons
  WHERE id = p_season AND status = 'finished' AND closed_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'season cannot be closed';
  END IF;

  -- A real club's ghost (D116): frozen as it finished, before anyone ages,
  -- and kept only if this is its best season by Elo so far. AI clubs play
  -- in leagues as themselves, so they have no ghost.
  INSERT INTO public.ghosts (
    team_id, season_id, sport, team_name, season_number, elo, players, squad,
    game_version
  )
  SELECT v_team, p_season, v_sport, tm.name, v_number, tm.elo,
         p_snapshot -> 'players', p_snapshot -> 'squad',
         p_snapshot ->> 'game_version'
  FROM public.teams tm WHERE tm.id = v_team AND tm.kind = 'human'
  ON CONFLICT (team_id) DO UPDATE
  SET season_id = excluded.season_id,
      team_name = excluded.team_name,
      season_number = excluded.season_number,
      elo = excluded.elo,
      players = excluded.players,
      squad = excluded.squad,
      game_version = excluded.game_version,
      frozen_at = now()
  WHERE excluded.elo > public.ghosts.elo;

  -- The season's permanent line (D120).
  INSERT INTO public.season_records (
    team_id, season_id, sport, season_number, team_name, colors, elo_before,
    elo_after, position, played, won, drawn, lost, scored, conceded, points,
    playoffs
  )
  SELECT v_team, p_season, v_sport, v_number, tm.name, tm.colors, v_start_elo,
         tm.elo, coalesce(s.position, 0), coalesce(s.played, 0), coalesce(s.won, 0),
         coalesce(s.drawn, 0), coalesce(s.lost, 0), coalesce(s.scored, 0),
         coalesce(s.conceded, 0), coalesce(s.points, 0), coalesce(s.playoffs, 'none')
  FROM public.teams tm,
       jsonb_to_record(p_snapshot -> 'stats') AS s(
         position integer, played integer, won integer, drawn integer, lost integer,
         scored integer, conceded integer, points integer, playoffs text
       )
  WHERE tm.id = v_team;

  -- Everyone who played the season counts it; best overall so far.
  UPDATE public.players p
  SET seasons = p.seasons + 1,
      best_overall = greatest(coalesce(p.best_overall, p.overall), p.overall)
  WHERE p.team_id = v_team;

  UPDATE public.players p
  SET age = x.age,
      attributes = x.attributes,
      overall = x.overall,
      worth = x.worth,
      fitness = coalesce(x.fitness, p.fitness),
      injured_weeks = coalesce(x.injured_weeks, p.injured_weeks),
      suspended_weeks = coalesce(x.suspended_weeks, p.suspended_weeks),
      yellow_cards = coalesce(x.yellow_cards, p.yellow_cards)
  FROM jsonb_to_recordset(p_updates) AS x(
    id uuid, age integer, attributes jsonb, overall integer, worth integer,
    fitness integer, injured_weeks integer, suspended_weeks integer, yellow_cards integer
  )
  WHERE p.id = x.id AND p.team_id = v_team;

  -- Retired players keep a career record (D120), with their best overall
  -- before this season's decline.
  INSERT INTO public.player_careers (
    team_id, sport, first_name, last_name, display_name, nationality,
    primary_position, retired_age, seasons, appearances, goals, best_overall,
    clubs, retired_season
  )
  SELECT p.team_id, p.sport, p.first_name, p.last_name, p.display_name,
         p.nationality, p.primary_position, p.age, p.seasons, p.appearances,
         p.goals, coalesce(p.best_overall, p.overall), ARRAY[tm.name], v_number
  FROM public.players p JOIN public.teams tm ON tm.id = p.team_id
  WHERE p.team_id = v_team
    AND p.id IN (SELECT (jsonb_array_elements_text(p_retired))::uuid);

  DELETE FROM public.players
  WHERE team_id = v_team
    AND id IN (SELECT (jsonb_array_elements_text(p_retired))::uuid);

  UPDATE public.seasons SET closed_at = now(), review = p_review WHERE id = p_season;
END
$$;--> statement-breakpoint
