-- Baseball's season writers (ADR 0009 §4, §5), expand only: soccer's
-- calls today keep working unchanged.
-- record_week: stat deltas by key, optional fitness and cards, rest days,
--   skipped best-of games, and new fixtures with event and game number.
-- start_season: fixtures with event and game number, a season that starts
--   at week 0, and clones that carry traits.
-- The pack and youth writers carry traits.
CREATE OR REPLACE FUNCTION public.record_week(p_season uuid, p_week integer, p_results jsonb, p_elo jsonb, p_funds integer, p_new_fixtures jsonb, p_status text, p_next_week integer, p_energy integer, p_energy_updated_at timestamp with time zone, p_players jsonb, p_morale double precision)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE
  v_team uuid;
  v_updated integer;
  v_expected integer;
  v_bad text;
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

  -- Every game of the week gets a score, or is marked skipped: a best-of
  -- game its series didn't need (ADR 0009 §2).
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_results) AS x(home_score integer, away_score integer, skipped boolean)
    WHERE CASE WHEN coalesce(x.skipped, false)
               THEN x.home_score IS NOT NULL OR x.away_score IS NOT NULL
               ELSE x.home_score IS NULL OR x.away_score IS NULL END
  ) THEN
    RAISE EXCEPTION 'a game needs a score, or is skipped without one';
  END IF;
  SELECT count(*) INTO v_expected FROM public.fixtures
  WHERE season_id = p_season AND week = p_week AND home_score IS NULL AND NOT skipped;
  UPDATE public.fixtures f
  SET home_score = x.home_score,
      away_score = x.away_score,
      winner = x.winner,
      summary = x.summary,
      manager_team = x.manager_team,
      skipped = coalesce(x.skipped, false),
      played_at = CASE WHEN coalesce(x.skipped, false) THEN NULL ELSE now() END
  FROM jsonb_to_recordset(p_results) AS x(id uuid, home_score integer, away_score integer, winner text, summary jsonb, manager_team jsonb, skipped boolean)
  WHERE f.id = x.id AND f.season_id = p_season AND f.week = p_week AND f.home_score IS NULL AND NOT f.skipped;
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

  -- Stat deltas by key (ADR 0009 §5): the sport's own keys, whole numbers
  -- of 0 or more.
  SELECT e.key INTO v_bad
  FROM jsonb_to_recordset(p_players) AS x(stats jsonb),
       jsonb_each(CASE WHEN jsonb_typeof(x.stats) = 'object' THEN x.stats ELSE '{}'::jsonb END) AS e
  WHERE e.key !~ '^[a-z][a-zA-Z0-9_]{0,31}$'
     OR jsonb_typeof(e.value) <> 'number'
     OR (e.value #>> '{}')::numeric < 0
     OR (e.value #>> '{}')::numeric <> trunc((e.value #>> '{}')::numeric)
  LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'stat % must be a whole number of 0 or more', v_bad;
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_players) AS x(stats jsonb)
    WHERE x.stats IS NOT NULL AND jsonb_typeof(x.stats) <> 'object'
  ) THEN
    RAISE EXCEPTION 'stats must be an object of stat keys';
  END IF;

  -- The club's players after the week (M4): fitness, injuries, bans,
  -- cards, pitchers' rest, and the career totals kept when they retire
  -- (D120, D143). A sport without in-game fitness or cards leaves them out.
  UPDATE public.players p
  SET fitness = coalesce(x.fitness, p.fitness),
      injured_days = coalesce(x.injured_days, x.injured_weeks, p.injured_days),
      suspended_games = coalesce(x.suspended_games, x.suspended_weeks, p.suspended_games),
      yellow_cards = coalesce(x.yellow_cards, p.yellow_cards),
      rest_days = coalesce(x.rest_days, p.rest_days),
      form = coalesce(x.form, p.form),
      appearances = p.appearances + CASE WHEN coalesce(x.appeared, false) THEN 1 ELSE 0 END,
      goals = p.goals + greatest(coalesce(x.goals, (x.stats ->> 'goals')::integer, 0), 0),
      season_minutes = p.season_minutes + greatest(coalesce(x.minutes, 0), 0),
      -- Career stats by key (ADR 0007 §2): each total grows by the week's,
      -- sent as a `stats` object of deltas (ADR 0009 §5) or, until soccer
      -- switches, as soccer's own fields.
      stats = CASE WHEN x.stats IS NOT NULL THEN p.stats || coalesce((
        SELECT jsonb_object_agg(e.key, coalesce((p.stats ->> e.key)::numeric, 0) + (e.value #>> '{}')::numeric)
        FROM jsonb_each(x.stats) AS e
      ), '{}'::jsonb) ELSE p.stats || jsonb_build_object(
        'games', coalesce((p.stats ->> 'games')::integer, 0) + greatest(coalesce(x.games, 0), 0),
        'goals', coalesce((p.stats ->> 'goals')::integer, 0) + greatest(coalesce(x.goals, 0), 0),
        'wins', coalesce((p.stats ->> 'wins')::integer, 0) + greatest(coalesce(x.wins, 0), 0),
        'draws', coalesce((p.stats ->> 'draws')::integer, 0) + greatest(coalesce(x.draws, 0), 0),
        'losses', coalesce((p.stats ->> 'losses')::integer, 0) + greatest(coalesce(x.losses, 0), 0),
        'assists', coalesce((p.stats ->> 'assists')::integer, 0) + greatest(coalesce(x.assists, 0), 0),
        'tackles', coalesce((p.stats ->> 'tackles')::integer, 0) + greatest(coalesce(x.tackles, 0), 0),
        'saves', coalesce((p.stats ->> 'saves')::integer, 0) + greatest(coalesce(x.saves, 0), 0)
      ) END
  FROM jsonb_to_recordset(p_players) AS x(
    id uuid, fitness integer, injured_days integer, suspended_games integer,
    injured_weeks integer, suspended_weeks integer,
    yellow_cards integer, form double precision, appeared boolean, goals integer,
    games integer, minutes integer, wins integer, draws integer, losses integer, assists integer,
    tackles integer, saves integer, stats jsonb, rest_days integer
  )
  WHERE p.id = x.id AND p.team_id = v_team;

  IF p_morale IS NOT NULL THEN
    UPDATE public.teams SET morale = p_morale WHERE id = v_team;
  END IF;

  -- The next fixtures (the next playoff round), with their event and game
  -- number in a series (ADR 0007 §4).
  INSERT INTO public.fixtures (season_id, week, event, stage, game_no, home_slot, away_slot)
  SELECT p_season, x.week, coalesce(x.event, 'main'), x.stage, coalesce(x.game_no, 1), x.home_slot, x.away_slot
  FROM jsonb_to_recordset(p_new_fixtures) AS x(week integer, event text, stage text, game_no integer, home_slot integer, away_slot integer);

  UPDATE public.seasons
  SET status = p_status,
      week = p_next_week,
      finished_at = CASE WHEN p_status = 'finished' THEN now() ELSE NULL END
  WHERE id = p_season;
END
$function$;
--> statement-breakpoint
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

  -- The season starts at its first fixture's week: 1, or 0 for a sport
  -- whose club sits out the opening week (baseball's bye, ADR 0009 §2).
  INSERT INTO public.seasons (team_id, sport, number, seed, start_elo, config_version, week)
  VALUES (p_team, v_sport, v_number, p_seed, v_elo, p_config_version, coalesce(
    (SELECT min(x.week) FROM jsonb_to_recordset(p_fixtures) AS x(week integer)), 1))
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
                 -- A sport's traits (ADR 0009 §4), left out for soccer.
                 ) || CASE WHEN p.traits = '{}'::jsonb THEN '{}'::jsonb
                           ELSE jsonb_build_object('traits', p.traits) END
                 ORDER BY p.id), '[]'::jsonb)
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

  INSERT INTO public.fixtures (season_id, week, event, stage, game_no, home_slot, away_slot)
  SELECT v_season, x.week, coalesce(x.event, 'main'), x.stage, coalesce(x.game_no, 1), x.home_slot, x.away_slot
  FROM jsonb_to_recordset(p_fixtures) AS x(week integer, event text, stage text, game_no integer, home_slot integer, away_slot integer);

  RETURN v_season;
END
$function$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.resolve_starter_packs(
  p_team uuid,
  p_players jsonb,
  p_kept jsonb
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_sport text;
  v_total integer;
  v_ready integer;
BEGIN
  SELECT sport INTO v_sport FROM public.teams WHERE id = p_team FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'team % not found', p_team;
  END IF;

  SELECT count(*),
         count(*) FILTER (WHERE opened_at IS NOT NULL AND resolved_at IS NULL)
  INTO v_total, v_ready
  FROM public.packs
  WHERE team_id = p_team AND kind = 'starter';
  IF v_total = 0 OR v_ready <> v_total THEN
    RAISE EXCEPTION 'starter packs are not ready to resolve (% of % ready)', v_ready, v_total;
  END IF;

  INSERT INTO public.players (
    team_id, sport, first_name, last_name, display_name, nationality, age,
    primary_position, secondary_position, attributes, overall, potential,
    potential_low, potential_high, worth, chemistry_color, template_variant,
    secondary_template_variant, from_starter_pack, traits
  )
  SELECT p_team, v_sport, x.first_name, x.last_name, x.display_name,
         x.nationality, x.age, x.primary_position, x.secondary_position,
         x.attributes, x.overall, x.potential, x.potential_low,
         x.potential_high, x.worth, x.chemistry_color, x.template_variant,
         coalesce(x.secondary_template_variant, 'default'), true,
         coalesce(x.traits, '{}'::jsonb)
  FROM jsonb_to_recordset(p_players) AS x(
    first_name text, last_name text, display_name text, nationality text,
    age integer, primary_position text, secondary_position text,
    attributes jsonb, overall integer, potential integer,
    potential_low integer, potential_high integer, worth integer,
    chemistry_color integer, template_variant text,
    secondary_template_variant text, traits jsonb
  );

  UPDATE public.packs
  SET resolved_at = now(),
      kept = coalesce(p_kept -> id::text, '[]'::jsonb)
  WHERE team_id = p_team AND kind = 'starter';
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.resolve_bought_pack(
  p_team uuid,
  p_pack uuid,
  p_players jsonb,
  p_kept jsonb,
  p_refund integer
)
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_sport text;
BEGIN
  IF p_refund < 0 THEN
    RAISE EXCEPTION 'resale money cannot be negative';
  END IF;
  SELECT sport INTO v_sport FROM public.packs
  WHERE id = p_pack AND team_id = p_team AND kind IN ('bought', 'reward')
    AND opened_at IS NOT NULL AND resolved_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pack is not open';
  END IF;

  INSERT INTO public.players (
    team_id, sport, first_name, last_name, display_name, nationality, age,
    primary_position, secondary_position, attributes, overall, potential,
    potential_low, potential_high, worth, chemistry_color, template_variant,
    secondary_template_variant, from_starter_pack, traits
  )
  SELECT p_team, v_sport, x.first_name, x.last_name, x.display_name,
         x.nationality, x.age, x.primary_position, x.secondary_position,
         x.attributes, x.overall, x.potential, x.potential_low,
         x.potential_high, x.worth, x.chemistry_color, x.template_variant,
         coalesce(x.secondary_template_variant, 'default'), false,
         coalesce(x.traits, '{}'::jsonb)
  FROM jsonb_to_recordset(p_players) AS x(
    first_name text, last_name text, display_name text, nationality text,
    age integer, primary_position text, secondary_position text,
    attributes jsonb, overall integer, potential integer,
    potential_low integer, potential_high integer, worth integer,
    chemistry_color integer, template_variant text,
    secondary_template_variant text, traits jsonb
  );

  UPDATE public.teams SET funds = funds + p_refund WHERE id = p_team;
  UPDATE public.packs SET resolved_at = now(), kept = p_kept WHERE id = p_pack;
END
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.resolve_youth_intake(
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
    secondary_template_variant, from_starter_pack, traits
  )
  SELECT v_team, v_sport, x.first_name, x.last_name, x.display_name,
         x.nationality, x.age, x.primary_position, x.secondary_position,
         x.attributes, x.overall, x.potential, x.potential_low,
         x.potential_high, x.worth, x.chemistry_color, x.template_variant,
         coalesce(x.secondary_template_variant, 'default'), false,
         coalesce(x.traits, '{}'::jsonb)
  FROM jsonb_to_recordset(p_players) AS x(
    first_name text, last_name text, display_name text, nationality text,
    age integer, primary_position text, secondary_position text,
    attributes jsonb, overall integer, potential integer,
    potential_low integer, potential_high integer, worth integer,
    chemistry_color integer, template_variant text,
    secondary_template_variant text, traits jsonb
  );

  UPDATE public.seasons
  SET intake_taken = p_taken, intake_resolved_at = now()
  WHERE id = p_season;
END
$$;
