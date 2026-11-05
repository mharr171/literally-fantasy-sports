-- Secondary-position heatmaps (D136): new players are saved with a template
-- variant for their secondary position, AI clubs' league copies carry it,
-- and existing players get one picked once, at random, from the live
-- version's enabled templates for that position. Nothing is deleted (D131).
GRANT SELECT (secondary_template_variant) ON public.players TO authenticated;--> statement-breakpoint

-- Pack players and youth prospects: the server sends the secondary variant
-- with the rest of the player. Missing means the default, so the functions
-- also accept players sent by the version before this one during a deploy.
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
    secondary_template_variant, from_starter_pack
  )
  SELECT p_team, v_sport, x.first_name, x.last_name, x.display_name,
         x.nationality, x.age, x.primary_position, x.secondary_position,
         x.attributes, x.overall, x.potential, x.potential_low,
         x.potential_high, x.worth, x.chemistry_color, x.template_variant,
         coalesce(x.secondary_template_variant, 'default'), true
  FROM jsonb_to_recordset(p_players) AS x(
    first_name text, last_name text, display_name text, nationality text,
    age integer, primary_position text, secondary_position text,
    attributes jsonb, overall integer, potential integer,
    potential_low integer, potential_high integer, worth integer,
    chemistry_color integer, template_variant text,
    secondary_template_variant text
  );

  UPDATE public.packs
  SET resolved_at = now(),
      kept = coalesce(p_kept -> id::text, '[]'::jsonb)
  WHERE team_id = p_team AND kind = 'starter';
END
$$;--> statement-breakpoint

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
  WHERE id = p_pack AND team_id = p_team AND kind = 'bought'
    AND opened_at IS NOT NULL AND resolved_at IS NULL
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'pack is not open';
  END IF;

  INSERT INTO public.players (
    team_id, sport, first_name, last_name, display_name, nationality, age,
    primary_position, secondary_position, attributes, overall, potential,
    potential_low, potential_high, worth, chemistry_color, template_variant,
    secondary_template_variant, from_starter_pack
  )
  SELECT p_team, v_sport, x.first_name, x.last_name, x.display_name,
         x.nationality, x.age, x.primary_position, x.secondary_position,
         x.attributes, x.overall, x.potential, x.potential_low,
         x.potential_high, x.worth, x.chemistry_color, x.template_variant,
         coalesce(x.secondary_template_variant, 'default'), false
  FROM jsonb_to_recordset(p_players) AS x(
    first_name text, last_name text, display_name text, nationality text,
    age integer, primary_position text, secondary_position text,
    attributes jsonb, overall integer, potential integer,
    potential_low integer, potential_high integer, worth integer,
    chemistry_color integer, template_variant text,
    secondary_template_variant text
  );

  UPDATE public.teams SET funds = funds + p_refund WHERE id = p_team;
  UPDATE public.packs SET resolved_at = now(), kept = p_kept WHERE id = p_pack;
END
$$;--> statement-breakpoint

-- Releases (p_refund 0) or bulk-sells a player from the roster (D49, D54).
-- Refuses when the team would drop below p_min_roster players. The team row--> statement-breakpoint

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
    secondary_template_variant, from_starter_pack
  )
  SELECT v_team, v_sport, x.first_name, x.last_name, x.display_name,
         x.nationality, x.age, x.primary_position, x.secondary_position,
         x.attributes, x.overall, x.potential, x.potential_low,
         x.potential_high, x.worth, x.chemistry_color, x.template_variant,
         coalesce(x.secondary_template_variant, 'default'), false
  FROM jsonb_to_recordset(p_players) AS x(
    first_name text, last_name text, display_name text, nationality text,
    age integer, primary_position text, secondary_position text,
    attributes jsonb, overall integer, potential integer,
    potential_low integer, potential_high integer, worth integer,
    chemistry_color integer, template_variant text,
    secondary_template_variant text
  );

  UPDATE public.seasons
  SET intake_taken = p_taken, intake_resolved_at = now()
  WHERE id = p_season;
END
$$;--> statement-breakpoint

-- Starting a season now also needs the last one wrapped up: closed and its--> statement-breakpoint

-- AI clubs are copied into leagues with both template variants.
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
                 'formation', ms.formation,
                 'lineup', ms.lineup,
                 'bench', ms.bench,
                 'subPlan', ms.sub_plan
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
$$;--> statement-breakpoint

-- One-time backfill: every player with a secondary position gets a random
-- enabled template for it from the live version, or the default when none
-- is enabled for that position.
WITH live AS (
  SELECT c.value AS enabled
  FROM public.game_config c
  JOIN (
    SELECT v.version FROM public.game_config_versions v
    WHERE v.scope = 'soccer' AND v.published_at IS NOT NULL
    ORDER BY v.version DESC LIMIT 1
  ) lv ON lv.version = c.version
  WHERE c.scope = 'soccer' AND c.key = 'variants.enabled'
)
UPDATE public.players p
SET secondary_template_variant = coalesce((
  SELECT l.enabled -> p.secondary_position
           ->> floor(random() * jsonb_array_length(l.enabled -> p.secondary_position))::integer
  FROM live l
  WHERE jsonb_typeof(l.enabled -> p.secondary_position) = 'array'
    AND jsonb_array_length(l.enabled -> p.secondary_position) > 0
), 'default')
WHERE p.sport = 'soccer' AND p.secondary_position IS NOT NULL;
