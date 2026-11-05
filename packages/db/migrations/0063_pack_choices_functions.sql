-- Buys a pack with the club's choices (D179, D180): the Elo shift its odds
-- moved by and the colors it leaves out, kept on the pack so it always
-- opens the same. Same rules as buy_pack, which stays for the version
-- running during a deploy. Only the server may call this.
CREATE FUNCTION public.buy_pack_with_choices(
  p_team uuid,
  p_focus text,
  p_tier text,
  p_price integer,
  p_elo_shift integer,
  p_excluded integer[]
)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  v_sport text;
  v_funds integer;
  v_pack uuid;
BEGIN
  IF p_price <= 0 THEN
    RAISE EXCEPTION 'pack price must be positive';
  END IF;
  SELECT sport, funds INTO v_sport, v_funds
  FROM public.teams WHERE id = p_team FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'team % not found', p_team;
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.packs
    WHERE team_id = p_team AND kind = 'bought' AND resolved_at IS NULL
  ) THEN
    RAISE EXCEPTION 'finish your open pack first';
  END IF;
  IF v_funds < p_price THEN
    RAISE EXCEPTION 'not enough funds';
  END IF;

  UPDATE public.teams SET funds = funds - p_price WHERE id = p_team;
  INSERT INTO public.packs (team_id, sport, kind, focus, tier, seed, opened_at,
                            elo_shift, excluded_colors)
  VALUES (p_team, v_sport, 'bought', p_focus, p_tier, gen_random_uuid()::text, now(),
          p_elo_shift, coalesce(p_excluded, '{}'))
  RETURNING id INTO v_pack;
  RETURN v_pack;
END
$$;--> statement-breakpoint

REVOKE EXECUTE ON FUNCTION public.buy_pack_with_choices(uuid, text, text, integer, integer, integer[]) FROM PUBLIC, anon, authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.buy_pack_with_choices(uuid, text, text, integer, integer, integer[]) TO service_role;
