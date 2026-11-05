-- Player stats (D143): record_week adds each player's wins, draws, losses,
-- assists, tackles and saves from the club's own match, and close_season
-- carries them into the career record. Managers can read their players'
-- totals. Existing totals start at 0: nothing is reset or deleted (D131).
GRANT SELECT (wins, draws, losses, assists, tackles, saves) ON public.players TO authenticated;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.record_week(
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
      manager_team = x.manager_team,
      played_at = now()
  FROM jsonb_to_recordset(p_results) AS x(id uuid, home_score integer, away_score integer, winner text, summary jsonb, manager_team jsonb)
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

  -- The club's players after the week (M4): fitness, injuries, bans,
  -- cards, and the career totals kept when they retire (D120, D143).
  UPDATE public.players p
  SET fitness = x.fitness,
      injured_weeks = x.injured_weeks,
      suspended_weeks = x.suspended_weeks,
      yellow_cards = x.yellow_cards,
      form = coalesce(x.form, p.form),
      appearances = p.appearances + CASE WHEN coalesce(x.appeared, false) THEN 1 ELSE 0 END,
      goals = p.goals + greatest(coalesce(x.goals, 0), 0),
      wins = p.wins + greatest(coalesce(x.wins, 0), 0),
      draws = p.draws + greatest(coalesce(x.draws, 0), 0),
      losses = p.losses + greatest(coalesce(x.losses, 0), 0),
      assists = p.assists + greatest(coalesce(x.assists, 0), 0),
      tackles = p.tackles + greatest(coalesce(x.tackles, 0), 0),
      saves = p.saves + greatest(coalesce(x.saves, 0), 0)
  FROM jsonb_to_recordset(p_players) AS x(
    id uuid, fitness integer, injured_weeks integer, suspended_weeks integer,
    yellow_cards integer, form double precision, appeared boolean, goals integer,
    wins integer, draws integer, losses integer, assists integer,
    tackles integer, saves integer
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

  -- Retired players keep a career record (D120, D143), with their best overall
  -- before this season's decline.
  INSERT INTO public.player_careers (
    team_id, sport, first_name, last_name, display_name, nationality,
    primary_position, retired_age, seasons, appearances, goals, wins, draws,
    losses, assists, tackles, saves, best_overall, clubs, retired_season
  )
  SELECT p.team_id, p.sport, p.first_name, p.last_name, p.display_name,
         p.nationality, p.primary_position, p.age, p.seasons, p.appearances,
         p.goals, p.wins, p.draws, p.losses, p.assists, p.tackles, p.saves,
         coalesce(p.best_overall, p.overall), ARRAY[tm.name], v_number
  FROM public.players p JOIN public.teams tm ON tm.id = p.team_id
  WHERE p.team_id = v_team
    AND p.id IN (SELECT (jsonb_array_elements_text(p_retired))::uuid);

  DELETE FROM public.players
  WHERE team_id = v_team
    AND id IN (SELECT (jsonb_array_elements_text(p_retired))::uuid);

  UPDATE public.seasons SET closed_at = now(), review = p_review WHERE id = p_season;
END
$$;--> statement-breakpoint
