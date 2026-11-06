-- Account reset is for the soccer club (D141): a manager can now hold a club
-- in another sport too (D192), so the reset picks the soccer one. Same
-- signature, so the site running during a deploy keeps working.
CREATE OR REPLACE FUNCTION public.reset_account(p_owner uuid, p_confirm text)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_team uuid;
  v_name text;
  v_counts jsonb;
BEGIN
  SELECT id, name INTO v_team, v_name FROM public.teams
  WHERE owner_id = p_owner AND kind = 'human' AND sport = 'soccer'
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'no club to reset';
  END IF;
  IF p_confirm IS DISTINCT FROM v_name THEN
    RAISE EXCEPTION 'club name does not match';
  END IF;

  SELECT jsonb_build_object(
    'players', (SELECT count(*) FROM public.players WHERE team_id = v_team),
    'seasons', (SELECT count(*) FROM public.seasons WHERE team_id = v_team),
    'season_records', (SELECT count(*) FROM public.season_records WHERE team_id = v_team),
    'careers', (SELECT count(*) FROM public.player_careers WHERE team_id = v_team),
    'ghost', (SELECT count(*) FROM public.ghosts WHERE team_id = v_team)
  ) INTO v_counts;

  DELETE FROM public.teams WHERE id = v_team;

  INSERT INTO public.admin_actions (admin_id, team_id, team_name, action, details)
  VALUES (p_owner, v_team, v_name, 'account_reset', v_counts);

  RETURN v_counts;
END
$$;
