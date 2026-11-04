-- Club colors (D107): picked when the club is created, and changeable later.
-- Only the server calls these, after checking the colors against the palette.
DROP FUNCTION public.create_team_with_starter_packs(uuid, text, text, jsonb);--> statement-breakpoint
CREATE FUNCTION public.create_team_with_starter_packs(
  p_owner uuid,
  p_sport text,
  p_name text,
  p_packs jsonb,
  p_colors text[]
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_team uuid;
BEGIN
  INSERT INTO public.teams (owner_id, sport, name, colors)
  VALUES (p_owner, p_sport, p_name, coalesce(p_colors, '{}'))
  RETURNING id INTO v_team;

  INSERT INTO public.packs (team_id, sport, kind, focus, tier, seed)
  SELECT v_team, p_sport, 'starter', x.focus, x.tier, gen_random_uuid()::text
  FROM jsonb_to_recordset(p_packs) AS x(focus text, tier text);

  RETURN v_team;
END
$$;--> statement-breakpoint

CREATE FUNCTION public.set_team_colors(p_team uuid, p_colors text[])
RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  UPDATE public.teams SET colors = p_colors WHERE id = p_team;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'team not found';
  END IF;
END
$$;--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.create_team_with_starter_packs(uuid, text, text, jsonb, text[]) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
REVOKE EXECUTE ON FUNCTION public.set_team_colors(uuid, text[]) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.create_team_with_starter_packs(uuid, text, text, jsonb, text[]) TO service_role;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.set_team_colors(uuid, text[]) TO service_role;
