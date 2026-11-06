-- M17 step 1 (ADR 0007 §13, ADR 0008): soccer's writers move to the new
-- columns. First a check that old and new agree on every row, as the
-- contract step needs: if any differ, this migration stops and nothing
-- changes. Then record_week, close_season, start_season and the soft reset
-- use stats, injured_days, suspended_games and lineup_data only (taking
-- either JSON key from the app, so today's code keeps working); the copy
-- triggers go; the old squad columns may be empty. A later migration drops
-- the old columns once no code writes them.
DO $$
DECLARE
  v_players integer;
  v_careers integer;
  v_condition integer;
  v_squads integer;
BEGIN
  SELECT count(*) INTO v_players FROM public.players
  WHERE sport = 'soccer' AND (
    coalesce((stats ->> 'games')::integer, 0) <> stat_games OR
    coalesce((stats ->> 'goals')::integer, 0) <> stat_goals OR
    coalesce((stats ->> 'wins')::integer, 0) <> wins OR
    coalesce((stats ->> 'draws')::integer, 0) <> draws OR
    coalesce((stats ->> 'losses')::integer, 0) <> losses OR
    coalesce((stats ->> 'assists')::integer, 0) <> assists OR
    coalesce((stats ->> 'tackles')::integer, 0) <> tackles OR
    coalesce((stats ->> 'saves')::integer, 0) <> saves);
  SELECT count(*) INTO v_careers FROM public.player_careers
  WHERE sport = 'soccer' AND (
    coalesce((stats ->> 'games')::integer, 0) <> stat_games OR
    coalesce((stats ->> 'goals')::integer, 0) <> stat_goals OR
    coalesce((stats ->> 'wins')::integer, 0) <> wins OR
    coalesce((stats ->> 'draws')::integer, 0) <> draws OR
    coalesce((stats ->> 'losses')::integer, 0) <> losses OR
    coalesce((stats ->> 'assists')::integer, 0) <> assists OR
    coalesce((stats ->> 'tackles')::integer, 0) <> tackles OR
    coalesce((stats ->> 'saves')::integer, 0) <> saves);
  SELECT count(*) INTO v_condition FROM public.players
  WHERE sport = 'soccer' AND (injured_days <> injured_weeks OR suspended_games <> suspended_weeks);
  SELECT count(*) INTO v_squads FROM public.matchday_squads ms
  JOIN public.teams tm ON tm.id = ms.team_id AND tm.sport = 'soccer'
  WHERE ms.lineup_data -> 'formation' IS DISTINCT FROM to_jsonb(ms.formation)
     OR ms.lineup_data -> 'starters' IS DISTINCT FROM ms.lineup
     OR ms.lineup_data -> 'bench' IS DISTINCT FROM ms.bench
     OR ms.lineup_data -> 'subPlan' IS DISTINCT FROM ms.sub_plan;
  IF v_players + v_careers + v_condition + v_squads > 0 THEN
    RAISE EXCEPTION 'old and new soccer columns differ: % players, % careers, % conditions, % squads',
      v_players, v_careers, v_condition, v_squads;
  END IF;
END
$$;--> statement-breakpoint

DROP TRIGGER players_sync_soccer_stats ON public.players;--> statement-breakpoint
DROP TRIGGER player_careers_sync_soccer_stats ON public.player_careers;--> statement-breakpoint
DROP TRIGGER players_sync_soccer_condition ON public.players;--> statement-breakpoint
DROP TRIGGER matchday_squads_sync_soccer_lineup ON public.matchday_squads;--> statement-breakpoint
DROP FUNCTION public.sync_soccer_stats();--> statement-breakpoint
DROP FUNCTION public.sync_soccer_condition();--> statement-breakpoint
DROP FUNCTION public.sync_soccer_lineup();--> statement-breakpoint

-- Saves can stop writing the old squad columns.
ALTER TABLE public.matchday_squads ALTER COLUMN formation DROP NOT NULL;--> statement-breakpoint
ALTER TABLE public.matchday_squads ALTER COLUMN lineup DROP NOT NULL;--> statement-breakpoint
ALTER TABLE public.matchday_squads ALTER COLUMN bench DROP NOT NULL;--> statement-breakpoint
ALTER TABLE public.matchday_squads ALTER COLUMN sub_plan DROP NOT NULL;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.record_week(p_season uuid, p_week integer, p_results jsonb, p_elo jsonb, p_funds integer, p_new_fixtures jsonb, p_status text, p_next_week integer, p_energy integer, p_energy_updated_at timestamp with time zone, p_players jsonb, p_morale double precision)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
      injured_days = coalesce(x.injured_days, x.injured_weeks),
      suspended_games = coalesce(x.suspended_games, x.suspended_weeks),
      yellow_cards = x.yellow_cards,
      form = coalesce(x.form, p.form),
      appearances = p.appearances + CASE WHEN coalesce(x.appeared, false) THEN 1 ELSE 0 END,
      goals = p.goals + greatest(coalesce(x.goals, 0), 0),
      season_minutes = p.season_minutes + greatest(coalesce(x.minutes, 0), 0),
      -- Career stats by key (ADR 0007 §2): each total grows by the week's.
      stats = p.stats || jsonb_build_object(
        'games', coalesce((p.stats ->> 'games')::integer, 0) + greatest(coalesce(x.games, 0), 0),
        'goals', coalesce((p.stats ->> 'goals')::integer, 0) + greatest(coalesce(x.goals, 0), 0),
        'wins', coalesce((p.stats ->> 'wins')::integer, 0) + greatest(coalesce(x.wins, 0), 0),
        'draws', coalesce((p.stats ->> 'draws')::integer, 0) + greatest(coalesce(x.draws, 0), 0),
        'losses', coalesce((p.stats ->> 'losses')::integer, 0) + greatest(coalesce(x.losses, 0), 0),
        'assists', coalesce((p.stats ->> 'assists')::integer, 0) + greatest(coalesce(x.assists, 0), 0),
        'tackles', coalesce((p.stats ->> 'tackles')::integer, 0) + greatest(coalesce(x.tackles, 0), 0),
        'saves', coalesce((p.stats ->> 'saves')::integer, 0) + greatest(coalesce(x.saves, 0), 0)
      )
  FROM jsonb_to_recordset(p_players) AS x(
    id uuid, fitness integer, injured_days integer, suspended_games integer,
    injured_weeks integer, suspended_weeks integer,
    yellow_cards integer, form double precision, appeared boolean, goals integer,
    games integer, minutes integer, wins integer, draws integer, losses integer, assists integer,
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
$function$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.close_season(p_season uuid, p_updates jsonb, p_retired jsonb, p_review jsonb, p_snapshot jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
      injured_days = coalesce(x.injured_days, x.injured_weeks, p.injured_days),
      suspended_games = coalesce(x.suspended_games, x.suspended_weeks, p.suspended_games),
      yellow_cards = coalesce(x.yellow_cards, p.yellow_cards)
  FROM jsonb_to_recordset(p_updates) AS x(
    id uuid, age integer, attributes jsonb, overall integer, worth integer,
    fitness integer, injured_days integer, suspended_games integer,
    injured_weeks integer, suspended_weeks integer, yellow_cards integer
  )
  WHERE p.id = x.id AND p.team_id = v_team;

  -- Retired players keep a career record (D120, D143), with their best overall
  -- before this season's decline.
  INSERT INTO public.player_careers (
    team_id, sport, first_name, last_name, display_name, nationality,
    primary_position, retired_age, seasons, appearances, goals, stats, best_overall,
    clubs, retired_season
  )
  SELECT p.team_id, p.sport, p.first_name, p.last_name, p.display_name,
         p.nationality, p.primary_position, p.age, p.seasons, p.appearances,
         p.goals, p.stats,
         coalesce(p.best_overall, p.overall), ARRAY[tm.name], v_number
  FROM public.players p JOIN public.teams tm ON tm.id = p.team_id
  WHERE p.team_id = v_team
    AND p.id IN (SELECT (jsonb_array_elements_text(p_retired))::uuid);

  DELETE FROM public.players
  WHERE team_id = v_team
    AND id IN (SELECT (jsonb_array_elements_text(p_retired))::uuid);

  -- A new season starts its playing-time count from zero (D154).
  UPDATE public.players SET season_minutes = 0 WHERE team_id = v_team;

  UPDATE public.seasons SET closed_at = now(), review = p_review WHERE id = p_season;
END
$function$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.start_season(p_team uuid, p_seed text, p_config_version text, p_slots jsonb, p_fixtures jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
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
                   'templateVariant', p.template_variant,
                   'secondaryTemplateVariant', p.secondary_template_variant
                 ) ORDER BY p.id), '[]'::jsonb)
                 FROM public.players p WHERE p.team_id = src.id
               ),
               'squad', jsonb_build_object(
                 'formation', ms.lineup_data -> 'formation',
                 'lineup', ms.lineup_data -> 'starters',
                 'bench', ms.lineup_data -> 'bench',
                 'subPlan', ms.lineup_data -> 'subPlan'
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
$function$;--> statement-breakpoint

CREATE OR REPLACE FUNCTION public.admin_soft_reset(p_admin uuid, p_scope text, p_confirm text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_counts jsonb;
  v_label text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = p_admin AND is_admin) THEN
    RAISE EXCEPTION 'only admins can soft reset';
  END IF;
  v_label := CASE p_scope WHEN 'ai' THEN 'AI' WHEN 'real' THEN 'REAL' WHEN 'all' THEN 'ALL' END;
  IF v_label IS NULL THEN
    RAISE EXCEPTION 'unknown scope %', p_scope;
  END IF;
  IF p_confirm IS DISTINCT FROM 'RESET ' || v_label THEN
    RAISE EXCEPTION 'type RESET % to confirm', v_label;
  END IF;

  -- Lock the clubs in scope so nothing plays a week while they reset.
  PERFORM 1 FROM public.teams
  WHERE id IN (SELECT public.soft_reset_teams(p_scope)) FOR UPDATE;

  v_counts := public.admin_soft_reset_preview(p_scope);

  -- History: seasons (fixtures and league copies go with them), season
  -- records, ghosts and careers.
  DELETE FROM public.season_records
  WHERE team_id IN (SELECT public.soft_reset_teams(p_scope));
  DELETE FROM public.ghosts
  WHERE team_id IN (SELECT public.soft_reset_teams(p_scope));
  DELETE FROM public.player_careers
  WHERE team_id IN (SELECT public.soft_reset_teams(p_scope));
  DELETE FROM public.seasons
  WHERE team_id IN (SELECT public.soft_reset_teams(p_scope));

  -- Clubs back to the start.
  UPDATE public.teams t
  SET elo = 1500,
      funds = 10000,
      energy = coalesce(
        (SELECT s.energy_max FROM public.sport_settings s WHERE s.sport = t.sport), 6),
      energy_updated_at = now(),
      morale = 0
  WHERE t.id IN (SELECT public.soft_reset_teams(p_scope));

  -- Every player kept, healed, with stats zeroed.
  UPDATE public.players
  SET fitness = 100,
      injured_days = 0,
      suspended_games = 0,
      yellow_cards = 0,
      form = 0,
      appearances = 0,
      goals = 0,
      seasons = 0,
      best_overall = overall,
      stats = '{}'::jsonb,
      season_minutes = 0
  WHERE team_id IN (SELECT public.soft_reset_teams(p_scope));

  INSERT INTO public.admin_actions (admin_id, team_id, team_name, action, details)
  VALUES (p_admin, NULL, 'Soft reset: ' || v_label, 'soft_reset',
          v_counts || jsonb_build_object('scope', p_scope));

  RETURN v_counts;
END
$function$;
