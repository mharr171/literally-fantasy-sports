-- Admin soft reset (D142, ADR 0004). For every club in scope (AI clubs, real
-- clubs or all): all seasons (with their fixtures and league copies),
-- season records, ghosts and retired players' careers are deleted; Elo,
-- funds, energy and morale go back to the start; every player is kept,
-- fully healed with form 0, and their stats are zeroed. Squads and packs
-- are kept. Only an admin can run it, by typing RESET AI / RESET REAL /
-- RESET ALL, and every run is logged. Only the server (service role) can
-- call either function.

-- The clubs a scope covers.
CREATE FUNCTION public.soft_reset_teams(p_scope text)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT id FROM public.teams
  WHERE (p_scope = 'ai' AND kind = 'ai')
     OR (p_scope = 'real' AND kind = 'human')
     OR p_scope = 'all'
$$;--> statement-breakpoint

-- What a soft reset of this scope would touch, without changing anything.
CREATE FUNCTION public.admin_soft_reset_preview(p_scope text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = ''
AS $$
BEGIN
  IF p_scope NOT IN ('ai', 'real', 'all') THEN
    RAISE EXCEPTION 'unknown scope %', p_scope;
  END IF;
  RETURN jsonb_build_object(
    'clubs', (SELECT count(*) FROM public.soft_reset_teams(p_scope)),
    'players', (SELECT count(*) FROM public.players
                WHERE team_id IN (SELECT public.soft_reset_teams(p_scope))),
    'seasons', (SELECT count(*) FROM public.seasons
                WHERE team_id IN (SELECT public.soft_reset_teams(p_scope))),
    'season_records', (SELECT count(*) FROM public.season_records
                WHERE team_id IN (SELECT public.soft_reset_teams(p_scope))),
    'ghosts', (SELECT count(*) FROM public.ghosts
                WHERE team_id IN (SELECT public.soft_reset_teams(p_scope))),
    'careers', (SELECT count(*) FROM public.player_careers
                WHERE team_id IN (SELECT public.soft_reset_teams(p_scope)))
  );
END
$$;--> statement-breakpoint

CREATE FUNCTION public.admin_soft_reset(p_admin uuid, p_scope text, p_confirm text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
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
      injured_weeks = 0,
      suspended_weeks = 0,
      yellow_cards = 0,
      form = 0,
      appearances = 0,
      goals = 0,
      seasons = 0,
      best_overall = overall,
      wins = 0,
      draws = 0,
      losses = 0,
      assists = 0,
      tackles = 0,
      saves = 0,
      stat_games = 0,
      stat_goals = 0,
      season_minutes = 0
  WHERE team_id IN (SELECT public.soft_reset_teams(p_scope));

  INSERT INTO public.admin_actions (admin_id, team_id, team_name, action, details)
  VALUES (p_admin, NULL, 'Soft reset: ' || v_label, 'soft_reset',
          v_counts || jsonb_build_object('scope', p_scope));

  RETURN v_counts;
END
$$;--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.soft_reset_teams(text) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.admin_soft_reset_preview(text) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.admin_soft_reset(uuid, text, text) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.soft_reset_teams(text) TO service_role;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.admin_soft_reset_preview(text) TO service_role;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.admin_soft_reset(uuid, text, text) TO service_role;
