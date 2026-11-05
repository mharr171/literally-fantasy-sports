-- Ghosts (D116): one per real club, from its best season, replacing the
-- per-season team_snapshots (dropped in the next migration). Leagues copy
-- each ghost when they start (D115). Only the server reads ghosts.
REVOKE ALL ON public.ghosts FROM anon, authenticated;--> statement-breakpoint
-- Managers may read their league's places but not the copies' rosters
-- (attributes stay server-side, D111).
REVOKE SELECT ON public.season_teams FROM authenticated;--> statement-breakpoint
GRANT SELECT (season_id, slot, kind, name, start_rating, elo, source_team_id) ON public.season_teams TO authenticated;--> statement-breakpoint

-- Each club's best snapshot by Elo (latest on a tie) becomes its ghost.
INSERT INTO public.ghosts (
  team_id, season_id, sport, team_name, season_number, elo, players, squad,
  game_version, frozen_at
)
SELECT DISTINCT ON (ts.team_id)
       ts.team_id, ts.season_id, ts.sport, ts.team_name, ts.season_number,
       ts.elo, ts.players, ts.squad, ts.game_version, ts.completed_at
FROM public.team_snapshots ts
ORDER BY ts.team_id, ts.elo DESC, ts.completed_at DESC;--> statement-breakpoint

-- Leagues already under way keep the ghost they started with.
UPDATE public.season_teams st
SET source_team_id = ts.team_id,
    clone = jsonb_build_object('players', ts.players, 'squad', ts.squad)
FROM public.team_snapshots ts
WHERE st.snapshot_id = ts.id;--> statement-breakpoint

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

  -- Ghosts are copied as they are now, frozen for the season (D115).
  INSERT INTO public.season_teams (season_id, slot, kind, name, start_rating, elo, source_team_id, clone)
  SELECT v_season, x.slot, x.kind, x.name, x.start_rating, x.start_rating, x.source_team_id,
         CASE WHEN x.kind = 'ghost' THEN (
           SELECT jsonb_build_object('players', g.players, 'squad', g.squad)
           FROM public.ghosts g WHERE g.team_id = x.source_team_id
         ) END
  FROM jsonb_to_recordset(p_slots) AS x(slot integer, kind text, name text, start_rating integer, source_team_id uuid);

  INSERT INTO public.fixtures (season_id, week, stage, home_slot, away_slot)
  SELECT v_season, x.week, x.stage, x.home_slot, x.away_slot
  FROM jsonb_to_recordset(p_fixtures) AS x(week integer, stage text, home_slot integer, away_slot integer);

  RETURN v_season;
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

  -- The club's ghost (D116): frozen as it finished, before anyone ages,
  -- and kept only if this is its best season by Elo so far.
  INSERT INTO public.ghosts (
    team_id, season_id, sport, team_name, season_number, elo, players, squad,
    game_version
  )
  SELECT v_team, p_season, v_sport, tm.name, v_number, tm.elo,
         p_snapshot -> 'players', p_snapshot -> 'squad',
         p_snapshot ->> 'game_version'
  FROM public.teams tm WHERE tm.id = v_team
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
    'clones_cleared', v_clones
  );
END
$$;--> statement-breakpoint
